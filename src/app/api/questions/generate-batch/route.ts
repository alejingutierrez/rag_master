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

// POST /api/questions/generate-batch — Generacion secuencial con SSE + heartbeat
export async function POST() {
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

      // Heartbeat cada 5s para mantener la conexion viva en App Runner/ALB
      // (App Runner corta conexiones idle después de ~120s, Opus puede tardar 60-90s por doc)
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
        // Re-query cada vez para obtener solo docs que AUN no tienen preguntas
        // Esto permite reanudar automaticamente si la conexion se corto a mitad
        const documents = await prisma.document.findMany({
          where: { status: "READY", questions: { none: {} } },
          select: { id: true, filename: true },
          orderBy: { createdAt: "asc" },
        });

        if (documents.length === 0) {
          send({ type: "complete", generated: 0, failed: 0, total: 0, message: "No hay documentos pendientes" });
          clearInterval(heartbeat);
          controller.close();
          return;
        }

        send({ type: "start", totalDocuments: documents.length });

        let generatedCount = 0;
        let failedCount = 0;

        for (let i = 0; i < documents.length; i++) {
          if (closed) break;

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

            const questions = await generateQuestionsForDocument(chunks, doc.filename);

            await prisma.question.deleteMany({ where: { documentId: doc.id } });

            const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            const now = Date.now();
            await prisma.question.createMany({
              data: questions.map((q, idx) => ({
                id: `q_${now}_${idx}_${Math.random().toString(36).slice(2, 8)}`,
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
              })),
            });

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
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }

        send({
          type: "complete",
          generated: generatedCount,
          failed: failedCount,
          total: documents.length,
        });

        clearInterval(heartbeat);
        if (!closed) controller.close();
      } catch (error) {
        console.error("Error in batch question generation:", error);
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
