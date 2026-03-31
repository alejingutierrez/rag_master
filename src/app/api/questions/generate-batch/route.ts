import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQuestionsForDocument } from "@/lib/questions-generator";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/questions/generate-batch — Conteo de documentos pendientes
export async function GET() {
  try {
    const pending = await prisma.document.findMany({
      where: { status: "READY", questions: { none: {} } },
      select: { id: true, filename: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      pendingCount: pending.length,
      pendingDocuments: pending,
    });
  } catch (error) {
    console.error("Error fetching pending documents:", error);
    return NextResponse.json(
      { error: "Error al obtener documentos pendientes" },
      { status: 500 }
    );
  }
}

// POST /api/questions/generate-batch — Generacion secuencial con SSE
export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const documents = await prisma.document.findMany({
          where: { status: "READY", questions: { none: {} } },
          select: { id: true, filename: true },
          orderBy: { createdAt: "asc" },
        });

        if (documents.length === 0) {
          send({ type: "complete", generated: 0, failed: 0, total: 0, message: "No hay documentos pendientes" });
          controller.close();
          return;
        }

        send({ type: "start", totalDocuments: documents.length });

        let generatedCount = 0;
        let failedCount = 0;

        for (let i = 0; i < documents.length; i++) {
          const doc = documents[i];

          send({
            type: "progress",
            documentId: doc.id,
            filename: doc.filename,
            index: i + 1,
            total: documents.length,
            message: `Generando preguntas: ${doc.filename}`,
          });

          try {
            // Obtener chunks del documento
            const chunks = await prisma.chunk.findMany({
              where: { documentId: doc.id },
              select: { content: true, pageNumber: true, chunkIndex: true },
              orderBy: { chunkIndex: "asc" },
            });

            if (chunks.length === 0) {
              send({
                type: "document_error",
                documentId: doc.id,
                filename: doc.filename,
                error: "Sin chunks procesados",
              });
              failedCount++;
              continue;
            }

            // Generar preguntas con Claude
            const questions = await generateQuestionsForDocument(chunks, doc.filename);

            // Eliminar preguntas anteriores (safety) y guardar nuevas
            await prisma.question.deleteMany({ where: { documentId: doc.id } });

            const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            for (const q of questions) {
              await prisma.question.create({
                data: {
                  id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  documentId: doc.id,
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
            }

            send({
              type: "document_complete",
              documentId: doc.id,
              filename: doc.filename,
              questionsGenerated: questions.length,
              index: i + 1,
              total: documents.length,
            });

            generatedCount++;
          } catch (error) {
            console.error(`Error generating questions for ${doc.id} (${doc.filename}):`, error);
            send({
              type: "document_error",
              documentId: doc.id,
              filename: doc.filename,
              error: error instanceof Error ? error.message : "Error desconocido",
            });
            failedCount++;
          }

          // Pausa entre documentos para evitar throttling de Bedrock
          if (i < documents.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        send({
          type: "complete",
          generated: generatedCount,
          failed: failedCount,
          total: documents.length,
        });

        controller.close();
      } catch (error) {
        console.error("Error in batch question generation:", error);
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Error desconocido",
        });
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
