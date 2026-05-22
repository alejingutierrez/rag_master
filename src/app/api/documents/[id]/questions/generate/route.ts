import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateQuestionsForDocument,
  computeTargetCount,
} from "@/lib/questions-generator";
import { reorderQuestions, ensureQuestionEmbeddings } from "@/lib/questions-orderer";
import { periodOrderOf } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";
// Libros grandes pasados completos a Opus 4.7 pueden tardar 3-5 min.
export const maxDuration = 600;

// POST /api/documents/[id]/questions/generate — SSE streaming.
// El N de preguntas se calcula automáticamente según el número de chunks del libro
// (computeTargetCount). No acepta override desde el cliente.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  const encoder = new TextEncoder();
  const reqStart = Date.now();
  const tag = `[questions/generate ${documentId.slice(-6)}]`;
  console.log(`${tag} POST received`);

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
        if (closed) { clearInterval(heartbeat); return; }
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          closed = true;
          clearInterval(heartbeat);
        }
      }, 5_000);

      try {
        // 1. Verificar documento
        const document = await prisma.document.findUnique({
          where: { id: documentId },
          select: { id: true, filename: true, status: true },
        });

        if (!document) {
          send({ type: "error", message: "Documento no encontrado" });
          clearInterval(heartbeat);
          if (!closed) controller.close();
          return;
        }

        send({
          type: "start",
          documentId,
          documentName: document.filename,
        });

        // 2. Obtener chunks del documento
        send({ type: "progress", step: "fetching_chunks", message: "Obteniendo chunks del documento..." });

        const chunks = await prisma.chunk.findMany({
          where: { documentId },
          select: { content: true, pageNumber: true, chunkIndex: true },
          orderBy: { chunkIndex: "asc" },
        });

        if (chunks.length === 0) {
          send({ type: "error", message: "El documento no tiene chunks procesados" });
          clearInterval(heartbeat);
          if (!closed) controller.close();
          return;
        }

        // N adaptativo: depende del tamaño del libro (chunks).
        const targetCount = computeTargetCount(chunks.length);

        send({
          type: "progress",
          step: "selecting_chunks",
          message: `Preparando contexto completo del libro (${chunks.length} chunks) → ${targetCount} preguntas...`,
          totalChunks: chunks.length,
          targetCount,
        });

        // 3. Llamar a Claude
        send({
          type: "progress",
          step: "calling_claude",
          message: `Llamando a Claude Opus 4.7 para generar ${targetCount} preguntas...`,
          targetCount,
        });

        console.log(
          `${tag} calling Opus 4.7: ${chunks.length} chunks, target=${targetCount}`
        );
        const claudeStart = Date.now();
        const questions = await generateQuestionsForDocument(
          chunks,
          document.filename,
          { targetCount }
        );
        console.log(
          `${tag} Opus returned ${questions.length} questions in ${(
            (Date.now() - claudeStart) /
            1000
          ).toFixed(1)}s`
        );

        send({
          type: "progress",
          step: "parsing",
          message: `${questions.length} preguntas generadas. Guardando en base de datos...`,
        });

        // 4. Eliminar preguntas anteriores del documento
        await prisma.question.deleteMany({ where: { documentId } });

        // 5. Guardar preguntas con un batchId común
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const baseTs = Date.now();
        for (let qi = 0; qi < questions.length; qi++) {
          const q = questions[qi];
          const saved = await prisma.question.create({
            data: {
              id: `q_${baseTs}_${qi}_${Math.random().toString(36).slice(2, 8)}`,
              documentId,
              questionNumber: q.questionNumber,
              pregunta: q.pregunta,
              periodoCode: q.periodoCode,
              periodoNombre: q.periodoNombre,
              periodoRango: q.periodoRango,
              categoriaCode: q.categoriaCode,
              categoriaNombre: q.categoriaNombre,
              subcategoriaCode: q.subcategoriaCode,
              subcategoriaNombre: q.subcategoriaNombre,
              periodosRelacionados: q.periodosRelacionados,
              categoriasRelacionadas: q.categoriasRelacionadas,
              justificacion: q.justificacion,
              batchId,
              targetCount,
              periodoOrden: periodOrderOf(q.periodoCode),
            },
          });

          send({
            type: "question",
            index: q.questionNumber,
            question: {
              id: saved.id,
              pregunta: q.pregunta,
              periodoCode: q.periodoCode,
              periodoNombre: q.periodoNombre,
              categoriaCode: q.categoriaCode,
              categoriaNombre: q.categoriaNombre,
              subcategoriaCode: q.subcategoriaCode,
              justificacion: q.justificacion,
            },
          });
        }

        // Generar embeddings de las preguntas nuevas (Cohere v4, vector 1536).
        // Sin esto el reorder cae a un fallback determinístico. Es barato:
        // ~60 preguntas × 1 llamada Cohere por lote.
        try {
          await ensureQuestionEmbeddings(documentId);
        } catch (e) {
          console.warn(`[questions] embeddings failed for ${documentId}:`, e);
        }

        // Reordenar TODAS las preguntas del documento con greedy chain narrativa
        // dentro de cada período + cronología entre períodos. Sin LLM, idempotente.
        try {
          await reorderQuestions({ documentId });
        } catch (e) {
          console.warn(`[questions] reorder failed for ${documentId}:`, e);
        }

        console.log(
          `${tag} ✅ saved ${questions.length} questions in ${(
            (Date.now() - reqStart) /
            1000
          ).toFixed(1)}s total`
        );

        send({
          type: "complete",
          saved: questions.length,
          batchId,
          documentId,
          targetCount,
        });

        clearInterval(heartbeat);
        if (!closed) controller.close();
      } catch (error) {
        console.error(
          `${tag} ❌ error after ${(
            (Date.now() - reqStart) /
            1000
          ).toFixed(1)}s:`,
          error
        );
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Error desconocido",
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
