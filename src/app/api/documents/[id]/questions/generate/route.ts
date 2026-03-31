import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQuestionsForDocument } from "@/lib/questions-generator";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/documents/[id]/questions/generate — SSE streaming
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        // 1. Verificar documento
        const document = await prisma.document.findUnique({
          where: { id: documentId },
          select: { id: true, filename: true, status: true },
        });

        if (!document) {
          send({ type: "error", message: "Documento no encontrado" });
          controller.close();
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
          controller.close();
          return;
        }

        send({
          type: "progress",
          step: "selecting_chunks",
          message: `Seleccionando fragmentos representativos de ${chunks.length} chunks...`,
          totalChunks: chunks.length,
        });

        // 3. Llamar a Claude
        send({
          type: "progress",
          step: "calling_claude",
          message: "Llamando a Claude Opus para generar preguntas...",
        });

        const questions = await generateQuestionsForDocument(chunks, document.filename);

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

        send({
          type: "complete",
          saved: questions.length,
          batchId,
          documentId,
        });

        controller.close();
      } catch (error) {
        console.error(`Error generating questions for ${documentId}:`, error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "error",
              message: error instanceof Error ? error.message : "Error desconocido",
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
