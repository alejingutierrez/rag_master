import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { runRagPipeline } from "@/lib/rag-pipeline";
import { askClaude } from "@/lib/claude";
import { planResearch, type ResearchPlan } from "@/lib/deep-research-planner";
import { generateAnnexes } from "@/lib/deep-research-annexes";
import { stripDuplicateBibliography } from "@/lib/apa-citations";
import type { SearchResult } from "@/lib/vector-search";

export const dynamic = "force-dynamic";
export const maxDuration = 900; // 15 min en after(), independiente del HTTP response

/**
 * Deep Research v2 — pipeline agéntico para investigación histórica seria.
 *
 * Diseño: POST devuelve `{deliverableId}` en <1s; todo el procesamiento corre
 * en `after()` y va actualizando el Deliverable + metadata.deepResearch para
 * que el cliente lo lea vía polling de `/api/deliverables/{id}`.
 *
 * Este patrón es robusto a desconexión del cliente (App Runner / proxies pueden
 * cortar el socket en streams largos). La versión anterior usaba SSE acoplado
 * al procesamiento → si el cliente se caía, el server abortaba sin persistir.
 *
 * Pipeline:
 *   1. Planner (Opus): descompone en 6-8 sub-preguntas + scope + entidades
 *   2. Por cada sub-pregunta: runRagPipeline completo (expansion + BM25 + RRF + rerank)
 *   3. Fusión RRF entre sub-preguntas → top 100 chunks únicos
 *   4. Síntesis principal (Opus + paper-academico, 5000-7000 palabras, citas [#N])
 *   5. Anexos en paralelo (Sonnet): cronología, tabla de actores, vacíos
 *   6. Update final: status=COMPLETE, answer compuesto, chunksUsed, metadata
 */

interface DeepResearchMetadata {
  stage:
    | "planning"
    | "executing"
    | "fusing"
    | "synthesizing"
    | "annexes"
    | "persisting"
    | "complete"
    | "error";
  message?: string;
  plan?: ResearchPlan;
  subqueriesProgress?: Array<{
    query: string;
    status: "pending" | "running" | "done" | "error";
    foundChunks?: number;
    error?: string;
  }>;
  paperWords?: number;
  startedAt: string;
  finishedAt?: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const question = body?.question;
  const questionId =
    typeof body?.questionId === "string" && body.questionId ? body.questionId : undefined;
  if (!question || typeof question !== "string" || question.length < 12) {
    return new Response(
      JSON.stringify({ error: "Pregunta requerida (≥12 chars)" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const modelUsed = process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-7";
  const batchId = `dr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 1. Crear Deliverable en GENERATING inmediatamente.
  const initialMetadata: DeepResearchMetadata = {
    stage: "planning",
    message: "Descomponiendo la pregunta en sub-investigaciones…",
    startedAt: new Date().toISOString(),
  };
  const deliverable = await prisma.deliverable.create({
    data: {
      userQuestion: question,
      templateId: "paper-academico",
      status: "GENERATING",
      answer: "",
      modelUsed,
      chunksUsed: [],
      metadata: initialMetadata as unknown as object,
      source: "deep_research",
      batchId,
      questionId,
    },
  });

  // 2. Procesamiento en background — independiente del HTTP response.
  after(async () => {
    const updateMetadata = async (patch: Partial<DeepResearchMetadata>) => {
      try {
        const cur = await prisma.deliverable.findUnique({
          where: { id: deliverable.id },
          select: { metadata: true },
        });
        const curMeta = (cur?.metadata as unknown as DeepResearchMetadata) ?? initialMetadata;
        const newMeta = { ...curMeta, ...patch };
        await prisma.deliverable.update({
          where: { id: deliverable.id },
          data: { metadata: newMeta as unknown as object },
        });
      } catch (e) {
        console.warn(`[deep-research ${deliverable.id}] updateMetadata failed:`, (e as Error).message);
      }
    };

    try {
      // ── 0. Detectar tabla ──
      const v2Available = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
        `SELECT COUNT(*) as c FROM chunks_v2 WHERE embedding IS NOT NULL LIMIT 1`
      )
        .then((r) => Number(r[0]?.c || 0) > 0)
        .catch(() => false);
      const effectiveTable: "chunks" | "chunks_v2" = v2Available ? "chunks_v2" : "chunks";

      // ── 1. Plan ──
      console.log(`[deep-research ${deliverable.id}] planning`);
      const plan = await planResearch(question);
      await updateMetadata({
        stage: "executing",
        message: `Recuperando evidencia para ${plan.subqueries.length} ángulos…`,
        plan,
        subqueriesProgress: plan.subqueries.map((q) => ({ query: q, status: "pending" as const })),
      });

      // ── 2. Retrieval por sub-pregunta (conc=2) ──
      console.log(`[deep-research ${deliverable.id}] retrieving ${plan.subqueries.length} subqueries`);
      const SUBQUERY_CONCURRENCY = 2;
      const allResults: SearchResult[][] = new Array(plan.subqueries.length).fill(null).map(() => []);
      const progress = plan.subqueries.map((q) => ({
        query: q,
        status: "pending" as "pending" | "running" | "done" | "error",
        foundChunks: undefined as number | undefined,
        error: undefined as string | undefined,
      }));

      for (let i = 0; i < plan.subqueries.length; i += SUBQUERY_CONCURRENCY) {
        const batch = plan.subqueries.slice(i, i + SUBQUERY_CONCURRENCY);
        const batchIndices = batch.map((_, j) => i + j);
        for (const idx of batchIndices) progress[idx].status = "running";
        await updateMetadata({ subqueriesProgress: progress });

        const batchResults = await Promise.all(
          batch.map(async (sq, j) => {
            const idx = i + j;
            try {
              const r = await runRagPipeline(sq, {
                tableName: effectiveTable,
                useParentExpansion: v2Available,
                retrievalCandidates: 100,
                finalTopK: 40,
              });
              progress[idx].status = "done";
              progress[idx].foundChunks = r.chunks.length;
              return r.chunks;
            } catch (err) {
              progress[idx].status = "error";
              progress[idx].error = err instanceof Error ? err.message : String(err);
              return [];
            }
          })
        );
        for (let j = 0; j < batchIndices.length; j++) {
          allResults[batchIndices[j]] = batchResults[j];
        }
        await updateMetadata({ subqueriesProgress: progress });
      }

      // ── 3. Fusión RRF ──
      console.log(`[deep-research ${deliverable.id}] fusing`);
      await updateMetadata({ stage: "fusing", message: "Fusionando evidencia…" });
      const RRF_K = 60;
      const fused = new Map<string, { chunk: SearchResult; score: number }>();
      for (const results of allResults) {
        for (let rank = 0; rank < results.length; rank++) {
          const c = results[rank];
          const score = 1 / (RRF_K + rank + 1);
          const existing = fused.get(c.id);
          if (existing) existing.score += score;
          else fused.set(c.id, { chunk: c, score });
        }
      }
      const fusedChunks = Array.from(fused.values())
        .sort((a, b) => b.score - a.score)
        .map((x) => x.chunk)
        .slice(0, 100);

      if (fusedChunks.length === 0) {
        await prisma.deliverable.update({
          where: { id: deliverable.id },
          data: {
            status: "ERROR",
            answer: "No se encontró evidencia en el corpus para ninguna sub-pregunta.",
            metadata: {
              ...initialMetadata,
              stage: "error",
              message: "Sin evidencia",
              finishedAt: new Date().toISOString(),
            } as unknown as object,
          },
        });
        return;
      }

      // ── 4. Síntesis principal (Opus + paper-academico) ──
      console.log(`[deep-research ${deliverable.id}] synthesizing paper with ${fusedChunks.length} chunks`);
      await updateMetadata({
        stage: "synthesizing",
        message: `Redactando paper con ${fusedChunks.length} fragmentos…`,
      });

      const claudeStream = await askClaude(
        question,
        fusedChunks.slice(0, 80),
        40000,
        { templateId: "paper-academico" }
      );

      let paperText = "";
      const reader = claudeStream.getReader();
      const decoder = new TextDecoder();
      let lastUpdate = Date.now();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (typeof data.text === "string") paperText += data.text;
            if (typeof data.error === "string") throw new Error(`Claude stream error: ${data.error}`);
          } catch (e) {
            if (e instanceof Error && e.message.startsWith("Claude stream error:")) throw e;
          }
        }
        // Update parcial cada 30s para reflejar progreso en UI
        if (Date.now() - lastUpdate > 30_000) {
          await updateMetadata({ paperWords: paperText.split(/\s+/).length });
          lastUpdate = Date.now();
        }
      }

      if (!paperText.trim()) throw new Error("La síntesis devolvió texto vacío.");

      // ── 5. Anexos en paralelo (Sonnet) ──
      console.log(`[deep-research ${deliverable.id}] generating annexes`);
      await updateMetadata({
        stage: "annexes",
        message: "Generando cronología, tabla de actores y vacíos…",
        paperWords: paperText.split(/\s+/).length,
      });

      const annexes = await generateAnnexes(question, fusedChunks);

      // ── 6. Componer texto final: paper + anexos + (APA del sistema ya viene en paperText) ──
      const cleanPaper = stripDuplicateBibliography(paperText);
      const referencesMatch = cleanPaper.match(/\n+---\n+## Referencias[\s\S]*$/);
      const paperBody = referencesMatch
        ? cleanPaper.slice(0, referencesMatch.index!)
        : cleanPaper;
      const referencesBlock = referencesMatch ? referencesMatch[0] : "";

      const annexBlock = [annexes.cronologia, annexes.actores, annexes.vacios]
        .filter(Boolean)
        .join("\n\n---\n\n");

      const finalAnswer = [
        paperBody.trimEnd(),
        annexBlock ? `\n\n---\n\n${annexBlock}` : "",
        referencesBlock,
      ]
        .join("")
        .trim() + "\n";

      // ── 7. Persistir ──
      console.log(`[deep-research ${deliverable.id}] persisting`);
      const chunksMetadata = fusedChunks.slice(0, 80).map((c) => ({
        id: c.id,
        similarity: c.similarity,
        documentFilename: c.documentFilename,
        pageNumber: c.pageNumber,
        content: c.content.slice(0, 400) + (c.content.length > 400 ? "…" : ""),
      }));

      await prisma.deliverable.update({
        where: { id: deliverable.id },
        data: {
          status: "COMPLETE",
          answer: finalAnswer,
          chunksUsed: chunksMetadata,
          metadata: {
            ...initialMetadata,
            stage: "complete",
            plan,
            subqueriesProgress: progress,
            paperWords: paperText.split(/\s+/).length,
            finishedAt: new Date().toISOString(),
          } as unknown as object,
        },
      });
      console.log(`[deep-research ${deliverable.id}] DONE`);
    } catch (err) {
      console.error(`[deep-research ${deliverable.id}] FAILED:`, err);
      const msg = err instanceof Error ? err.message : "Error desconocido";
      try {
        await prisma.deliverable.update({
          where: { id: deliverable.id },
          data: {
            status: "ERROR",
            answer: `Error: ${msg}`,
            metadata: {
              stage: "error",
              message: msg,
              startedAt: initialMetadata.startedAt,
              finishedAt: new Date().toISOString(),
            } as unknown as object,
          },
        });
      } catch (e) {
        console.error(`[deep-research ${deliverable.id}] failed to mark ERROR:`, e);
      }
    }
  });

  // 3. Respuesta inmediata.
  return Response.json({
    deliverableId: deliverable.id,
    status: "GENERATING",
    pollUrl: `/api/deliverables/${deliverable.id}`,
  });
}

// GET /api/deep-research?id=… — carga un deep-research previo persistido
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "id requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const d = await prisma.deliverable.findUnique({
    where: { id },
    select: {
      id: true,
      userQuestion: true,
      answer: true,
      chunksUsed: true,
      metadata: true,
      source: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      modelUsed: true,
    },
  });
  if (!d || d.source !== "deep_research") {
    return new Response(JSON.stringify({ error: "Deep research no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return Response.json(d);
}
