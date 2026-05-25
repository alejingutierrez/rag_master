import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runRagPipeline } from "@/lib/rag-pipeline";
import { askClaude } from "@/lib/claude";
import { getTemplateById } from "@/lib/chat-templates";
import { syncQuestionStats } from "@/lib/question-stats-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Consume el ReadableStream SSE de askClaude y acumula el texto completo.
 * Includes a per-chunk timeout to detect stalled streams.
 */
async function consumeClaudeStream(stream: ReadableStream<Uint8Array>): Promise<{
  text: string;
  modelUsed: string;
}> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  const modelUsed =
    process.env.BEDROCK_CLAUDE_MODEL_ID ||
    "us.anthropic.claude-opus-4-6-20250610-v1:0";

  const CHUNK_TIMEOUT_MS = 120_000; // 2 min max wait per chunk

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
          /* skip malformed */
        }
      }
    }

    // Process remaining buffer
    if (buffer.startsWith("data: ")) {
      try {
        const data = JSON.parse(buffer.slice(6));
        if (data.text) fullText += data.text;
      } catch {
        /* skip */
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!fullText) {
    throw new Error("Claude stream returned empty response");
  }

  return { text: fullText, modelUsed };
}

// POST /api/deliverables/generate — SSE generation for multiple templates
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { questionId, templateIds } = body as {
    questionId: string;
    templateIds: string[];
  };

  if (!questionId || !templateIds?.length) {
    return new Response(
      JSON.stringify({ error: "Se requiere questionId y templateIds" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate templates exist
  for (const tid of templateIds) {
    if (!getTemplateById(tid)) {
      return new Response(
        JSON.stringify({ error: `Template no encontrado: ${tid}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      };

      // Heartbeat cada 5s para mantener conexión viva en App Runner/ALB
      const heartbeat = setInterval(() => {
        if (closed) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          closed = true;
          clearInterval(heartbeat);
        }
      }, 5_000);

      try {
        // Obtener la pregunta
        const question = await prisma.question.findUnique({
          where: { id: questionId },
          include: { document: { select: { id: true, filename: true } } },
        });

        if (!question) {
          send({ type: "error", message: "Pregunta no encontrada" });
          clearInterval(heartbeat);
          controller.close();
          return;
        }

        const batchId = `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const total = templateIds.length;

        send({
          type: "start",
          totalTemplates: total,
          questionId,
          questionText: question.pregunta.slice(0, 200),
        });

        let generatedCount = 0;
        let failedCount = 0;

        // Pipeline RAG completo (mismo que /api/chat): query expansion + HyDE +
        // BM25 + RRF + Cohere Rerank + parent expansion si chunks_v2 disponible.
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
          send({
            type: "error",
            message: "No se encontraron fragmentos relevantes para esta pregunta",
          });
          clearInterval(heartbeat);
          if (!closed) controller.close();
          return;
        }

        // Guardamos también `content` truncado (para tooltip hover en el detalle).
        const chunksMetadata = chunks.slice(0, 50).map((c) => ({
          id: c.id,
          similarity: c.similarity,
          documentFilename: c.documentFilename,
          pageNumber: c.pageNumber,
          content: c.content.slice(0, 400) + (c.content.length > 400 ? "…" : ""),
        }));

        for (let i = 0; i < templateIds.length; i++) {
          if (closed) break;

          const templateId = templateIds[i];
          const template = getTemplateById(templateId)!;

          // Verificar si ya existe un deliverable COMPLETE para esta pregunta+template
          const existing = await prisma.deliverable.findUnique({
            where: { questionId_templateId: { questionId, templateId } },
          });

          if (existing && existing.status === "COMPLETE") {
            send({
              type: "template_complete",
              templateId,
              templateName: template.name,
              deliverableId: existing.id,
              answerPreview:
                existing.answer.slice(0, 150) +
                (existing.answer.length > 150 ? "..." : ""),
              index: i + 1,
              total,
              skipped: true,
            });
            generatedCount++;
            continue;
          }

          send({
            type: "template_start",
            templateId,
            templateName: template.name,
            index: i + 1,
            total,
          });

          // Upsert: crear o actualizar (si existe con status ERROR, regenerar)
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

            // Mantener Question.deliverableCount / completedTemplateIds /
            // lastDeliveredAt al día. No bloquea el SSE si falla — solo loggea.
            try {
              await syncQuestionStats(questionId);
            } catch (e) {
              console.warn(`[deliverables] syncQuestionStats failed for ${questionId}:`, e);
            }

            send({
              type: "template_complete",
              templateId,
              templateName: template.name,
              deliverableId: deliverable.id,
              answerPreview:
                result.text.slice(0, 150) +
                (result.text.length > 150 ? "..." : ""),
              index: i + 1,
              total,
            });

            generatedCount++;
          } catch (error) {
            console.error(
              `Error generating deliverable for template ${templateId}:`,
              error
            );

            await prisma.deliverable.update({
              where: { id: deliverable.id },
              data: {
                status: "ERROR",
                answer:
                  error instanceof Error ? error.message : "Error desconocido",
              },
            });

            // Si la pregunta tenía un Deliverable COMPLETE previo con este template
            // (lo estamos regenerando y falló), el sync revierte el conteo.
            try {
              await syncQuestionStats(questionId);
            } catch (e) {
              console.warn(`[deliverables] syncQuestionStats failed for ${questionId}:`, e);
            }

            send({
              type: "template_error",
              templateId,
              templateName: template.name,
              error:
                error instanceof Error ? error.message : "Error desconocido",
              index: i + 1,
              total,
            });

            failedCount++;
          }

          // Pausa entre templates para evitar throttling de Bedrock
          if (i < templateIds.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }

        send({
          type: "complete",
          generated: generatedCount,
          failed: failedCount,
          total,
          batchId,
        });

        clearInterval(heartbeat);
        if (!closed) controller.close();
      } catch (error) {
        console.error("Error in deliverable generation:", error);
        send({
          type: "error",
          message:
            error instanceof Error ? error.message : "Error desconocido",
        });
        clearInterval(heartbeat);
        if (!closed) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
