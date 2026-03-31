import { prisma } from "@/lib/prisma";
import { enrichDocument } from "@/lib/document-enricher";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/documents/enrich-batch — Enriquecimiento masivo con SSE + heartbeat
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

      // Heartbeat cada 15s para mantener la conexion viva en App Runner/ALB
      const heartbeat = setInterval(() => {
        if (closed) { clearInterval(heartbeat); return; }
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          closed = true;
          clearInterval(heartbeat);
        }
      }, 15_000);

      try {
        // Re-query docs no enriquecidos — permite resume automatico tras reconexion
        const documents = await prisma.document.findMany({
          where: { enriched: false, status: "READY" },
          select: { id: true, filename: true },
          orderBy: { createdAt: "asc" },
        });

        if (documents.length === 0) {
          send({ type: "complete", enriched: 0, failed: 0, total: 0, message: "No hay documentos pendientes de enriquecimiento" });
          clearInterval(heartbeat);
          controller.close();
          return;
        }

        send({ type: "start", totalDocuments: documents.length });

        let enrichedCount = 0;
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
            message: `Enriqueciendo: ${doc.filename}`,
          });

          try {
            const chunks = await prisma.chunk.findMany({
              where: { documentId: doc.id },
              select: { content: true, pageNumber: true, chunkIndex: true },
              orderBy: { chunkIndex: "asc" },
              take: 30,
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

            const enrichmentData = await enrichDocument(chunks, doc.filename);

            // Merge con metadata existente
            const current = await prisma.document.findUnique({
              where: { id: doc.id },
              select: { metadata: true },
            });
            const currentMetadata =
              current?.metadata && typeof current.metadata === "object"
                ? current.metadata
                : {};
            const merged = { ...(currentMetadata as Record<string, unknown>), ...enrichmentData };

            await prisma.document.update({
              where: { id: doc.id },
              data: { metadata: merged, enriched: true },
            });

            send({
              type: "document_complete",
              documentId: doc.id,
              filename: doc.filename,
              bookTitle: enrichmentData.bookTitle || null,
              author: enrichmentData.author || null,
              index: i + 1,
              total: documents.length,
            });

            enrichedCount++;
          } catch (error) {
            console.error(`Error enriching ${doc.id} (${doc.filename}):`, error);
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
          enriched: enrichedCount,
          failed: failedCount,
          total: documents.length,
        });

        clearInterval(heartbeat);
        if (!closed) controller.close();
      } catch (error) {
        console.error("Error in batch enrichment:", error);
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
