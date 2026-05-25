import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { runRagPipeline } from "@/lib/rag-pipeline";
import { askClaude } from "@/lib/claude";
import { getTemplateById } from "@/lib/chat-templates";
import { syncQuestionStats } from "@/lib/question-stats-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

// Concurrencia limitada para no saturar Bedrock con muchas preguntas en paralelo.
// Cada (questionId, templateId) hace 1 embedding + 1 vector-search + 1 llamada a Claude.
const PAIR_CONCURRENCY = 2;
const PAUSE_BETWEEN_BATCHES_MS = 3000;

interface ConsumeResult {
  text: string;
  modelUsed: string;
}

async function consumeClaudeStream(
  stream: ReadableStream<Uint8Array>
): Promise<ConsumeResult> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  const modelUsed =
    process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-7";
  const CHUNK_TIMEOUT_MS = 120_000;

  try {
    while (true) {
      const readPromise = reader.read();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Stream read timeout")), CHUNK_TIMEOUT_MS)
      );
      const { done, value } = await Promise.race([readPromise, timeoutPromise]);
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.text) fullText += data.text;
          if (data.error) throw new Error(`Claude stream error: ${data.error}`);
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("Claude stream error:")) throw e;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!fullText) throw new Error("Claude stream returned empty response");
  return { text: fullText, modelUsed };
}

/**
 * Genera un único (question, template). Idempotente: si ya existe COMPLETE,
 * lo deja como está y reporta "skipped".
 */
async function generateOne(
  questionId: string,
  templateId: string,
  batchId: string
): Promise<"generated" | "skipped" | "failed"> {
  const template = getTemplateById(templateId);
  if (!template) return "failed";

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { pregunta: true },
  });
  if (!question) return "failed";

  const existing = await prisma.deliverable.findUnique({
    where: { questionId_templateId: { questionId, templateId } },
  });
  if (existing && existing.status === "COMPLETE") return "skipped";

  // Upsert estado a GENERATING antes de llamar a Claude.
  const deliverable = await prisma.deliverable.upsert({
    where: { questionId_templateId: { questionId, templateId } },
    create: {
      questionId,
      templateId,
      status: "GENERATING",
      batchId,
      answer: "",
      modelUsed: "",
      chunksUsed: [],
    },
    update: {
      status: "GENERATING",
      batchId,
      answer: "",
      modelUsed: "",
      chunksUsed: [],
    },
  });

  try {
    // Pipeline RAG completo (mismo que /api/chat): expansion + BM25 + RRF + rerank.
    const v2Available = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT COUNT(*) as c FROM chunks_v2 WHERE embedding IS NOT NULL LIMIT 1`
    ).then((r) => Number(r[0]?.c || 0) > 0).catch(() => false);
    const effectiveTable: "chunks" | "chunks_v2" = v2Available ? "chunks_v2" : "chunks";

    const ragResult = await runRagPipeline(question.pregunta, {
      tableName: effectiveTable,
      useParentExpansion: v2Available,
    });
    const chunks = ragResult.chunks;
    if (chunks.length === 0) {
      await prisma.deliverable.update({
        where: { id: deliverable.id },
        data: { status: "ERROR", answer: "No se encontraron fragmentos relevantes" },
      });
      await syncQuestionStats(questionId).catch(() => {});
      return "failed";
    }

    const chunksMetadata = chunks.slice(0, 50).map((c) => ({
      id: c.id,
      similarity: c.similarity,
      documentFilename: c.documentFilename,
      pageNumber: c.pageNumber,
      content: c.content.slice(0, 400) + (c.content.length > 400 ? "…" : ""),
    }));

    const claudeStream = await askClaude(
      question.pregunta,
      chunks,
      template.maxTokens,
      { templateId }
    );
    const result = await consumeClaudeStream(claudeStream);
    const { stripDuplicateBibliography } = await import("@/lib/apa-citations");
    const cleanText = stripDuplicateBibliography(result.text);

    await prisma.deliverable.update({
      where: { id: deliverable.id },
      data: {
        status: "COMPLETE",
        answer: cleanText,
        modelUsed: result.modelUsed,
        chunksUsed: chunksMetadata,
      },
    });
    await syncQuestionStats(questionId).catch(() => {});
    return "generated";
  } catch (err) {
    console.error(
      `[bulk-generate] failed for q=${questionId} t=${templateId}:`,
      err instanceof Error ? err.message : err
    );
    await prisma.deliverable.update({
      where: { id: deliverable.id },
      data: {
        status: "ERROR",
        answer: err instanceof Error ? err.message : "Error desconocido",
      },
    }).catch(() => {});
    await syncQuestionStats(questionId).catch(() => {});
    return "failed";
  }
}

interface BulkBody {
  questionIds?: string[];
  templateIds?: string[];
  /**
   * Si true, solo genera los pares que NO están COMPLETE (default true).
   * Si false, regenera todo aunque ya esté completo.
   */
  onlyMissing?: boolean;
}

// POST /api/deliverables/bulk-generate
// Body: { questionIds: string[], templateIds: string[], onlyMissing?: boolean }
// Devuelve {jobId, totalPairs} y dispara la generación en background con after().
// Polling: el cliente refresca /api/questions/matrix para ver progreso.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as BulkBody;
    const questionIds = Array.isArray(body.questionIds) ? body.questionIds : [];
    const templateIds = Array.isArray(body.templateIds) ? body.templateIds : [];
    const onlyMissing = body.onlyMissing !== false;

    if (questionIds.length === 0 || templateIds.length === 0) {
      return NextResponse.json(
        { error: "Se requieren questionIds y templateIds no vacíos" },
        { status: 400 }
      );
    }
    for (const tid of templateIds) {
      if (!getTemplateById(tid)) {
        return NextResponse.json(
          { error: `Template no encontrado: ${tid}` },
          { status: 400 }
        );
      }
    }

    // Calcular pares a procesar.
    let pairs: Array<{ questionId: string; templateId: string }> = [];
    for (const qid of questionIds) {
      for (const tid of templateIds) {
        pairs.push({ questionId: qid, templateId: tid });
      }
    }

    if (onlyMissing) {
      const existing = await prisma.deliverable.findMany({
        where: {
          questionId: { in: questionIds },
          templateId: { in: templateIds },
          status: "COMPLETE",
        },
        select: { questionId: true, templateId: true },
      });
      const completedSet = new Set(
        existing.map((d) => `${d.questionId}::${d.templateId}`)
      );
      pairs = pairs.filter(
        (p) => !completedSet.has(`${p.questionId}::${p.templateId}`)
      );
    }

    if (pairs.length === 0) {
      return NextResponse.json({
        message: "Nada que generar — todos los entregables ya están completos",
        totalPairs: 0,
      });
    }

    const jobId = `bulkgen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 🚀 Background: procesa todos los pares con concurrencia limitada.
    after(async () => {
      console.log(
        `[bulk-generate] job=${jobId} starting: ${pairs.length} pairs, concurrency=${PAIR_CONCURRENCY}`
      );
      let generated = 0;
      let skipped = 0;
      let failed = 0;

      for (let i = 0; i < pairs.length; i += PAIR_CONCURRENCY) {
        const batch = pairs.slice(i, i + PAIR_CONCURRENCY);
        const results = await Promise.all(
          batch.map((p) => generateOne(p.questionId, p.templateId, jobId))
        );
        for (const r of results) {
          if (r === "generated") generated++;
          else if (r === "skipped") skipped++;
          else failed++;
        }
        if (i + PAIR_CONCURRENCY < pairs.length) {
          await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_BATCHES_MS));
        }
      }
      console.log(
        `[bulk-generate] job=${jobId} done: generated=${generated}, skipped=${skipped}, failed=${failed}`
      );
    });

    return NextResponse.json({
      jobId,
      totalPairs: pairs.length,
      questionCount: questionIds.length,
      templateCount: templateIds.length,
      onlyMissing,
      message: `${pairs.length} entregables encolados — generándose en background`,
    });
  } catch (error) {
    console.error("Error in bulk-generate:", error);
    return NextResponse.json(
      { error: "Error al iniciar bulk-generate" },
      { status: 500 }
    );
  }
}
