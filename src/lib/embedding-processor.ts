import { prisma } from "./prisma";
import { generateEmbeddings } from "./bedrock";
import { saveChunkEmbedding } from "./vector-search";

/**
 * Procesa TODOS los embeddings pendientes de un documento de forma server-side.
 * Diseñado para correr dentro de `after()` / `waitUntil()` — continúa
 * aunque el cliente se haya desconectado.
 *
 * - Procesa en lotes de BATCH_SIZE con CONCURRENCY paralelo
 * - Reintentos automáticos ante throttling (backoff exponencial)
 * - Actualiza el estado del documento a READY al completar o ERROR al fallar
 */

// Cohere v4 acepta hasta 96 texts por request. generateEmbeddings hace
// el batching interno (24 textos por llamada) + semáforo global. Aquí
// BATCH_SIZE = chunks que pedimos a la BD por iteración del while loop.
const BATCH_SIZE = 48;
const MAX_RETRIES = 10; // más generoso, el semáforo global ya limita carga

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processAllEmbeddings(documentId: string): Promise<void> {
  console.log(`[embedding-processor] Starting full processing for document ${documentId}`);

  try {
    // Verificar que el documento existe y está en PROCESSING
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      console.error(`[embedding-processor] Document ${documentId} not found`);
      return;
    }

    // Si ya está READY o ERROR, no reprocesar
    if (document.status === "READY") {
      console.log(`[embedding-processor] Document ${documentId} already READY, skipping`);
      return;
    }

    // Asegurar estado PROCESSING
    if (document.status !== "PROCESSING") {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "PROCESSING" },
      });
    }

    let totalProcessed = 0;
    let consecutiveThrottles = 0;

    // Loop: procesar lotes hasta que no queden chunks pendientes
    while (true) {
      // Obtener siguiente lote de chunks sin embedding
      const chunksToProcess = await prisma.$queryRawUnsafe<
        Array<{ id: string; content: string }>
      >(
        `SELECT id, content FROM chunks WHERE "documentId" = $1 AND embedding IS NULL ORDER BY "chunkIndex" LIMIT $2`,
        documentId,
        BATCH_SIZE
      );

      // Si no quedan chunks pendientes, marcar como READY
      if (chunksToProcess.length === 0) {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: "READY" },
        });
        console.log(
          `[embedding-processor] Document ${documentId} READY — ${totalProcessed} embeddings generated`
        );
        return;
      }

      // Procesar TODO el lote en una sola llamada batched a Cohere v4
      try {
        const texts = chunksToProcess.map((c) => c.content);
        const embeddings = await generateEmbeddings(texts, "search_document");
        // Persistir cada embedding al chunk correspondiente
        await Promise.all(
          chunksToProcess.map((chunk, i) =>
            saveChunkEmbedding(chunk.id, embeddings[i])
          )
        );
        totalProcessed += chunksToProcess.length;
        consecutiveThrottles = 0; // reset on success
      } catch (error: unknown) {
        const isThrottled =
          error instanceof Error &&
          (error.name === "ThrottlingException" ||
            error.message.includes("throttl") ||
            error.message.includes("Too many tokens"));

        if (isThrottled) {
          consecutiveThrottles++;
          if (consecutiveThrottles > MAX_RETRIES) {
            console.error(
              `[embedding-processor] Document ${documentId} — max throttle retries exceeded`
            );
            // No marcamos como ERROR — queda en PROCESSING para reintentar luego
            return;
          }
          const delay = Math.pow(2, consecutiveThrottles) * 5000 + Math.random() * 3000;
          console.log(
            `[embedding-processor] Throttled, waiting ${(delay / 1000).toFixed(1)}s (attempt ${consecutiveThrottles}/${MAX_RETRIES})`
          );
          await sleep(delay);
          continue; // Reintentar el loop
        }

        // Error irrecuperable
        console.error(
          `[embedding-processor] Fatal error processing document ${documentId}:`,
          error
        );
        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: "ERROR",
            error:
              error instanceof Error ? error.message : "Error desconocido",
          },
        });
        return;
      }
    }
  } catch (error) {
    console.error(
      `[embedding-processor] Unexpected error for document ${documentId}:`,
      error
    );
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: "ERROR",
          error:
            error instanceof Error ? error.message : "Error inesperado",
        },
      });
    } catch {
      // Si no pudimos ni actualizar el status, solo loguear
      console.error(`[embedding-processor] Could not update document status`);
    }
  }
}

/**
 * Procesa todos los documentos que estén en estado PROCESSING con chunks pendientes.
 * Útil como endpoint de recuperación para documentos atascados.
 */
export async function processAllPendingDocuments(): Promise<{
  triggered: string[];
  alreadyReady: string[];
}> {
  // Encontrar documentos en PROCESSING que tengan chunks sin embedding
  const stuckDocuments = await prisma.$queryRawUnsafe<
    Array<{ id: string; filename: string; pending: bigint }>
  >(
    `SELECT d.id, d.filename, COUNT(c.id) FILTER (WHERE c.embedding IS NULL) AS pending
     FROM documents d
     JOIN chunks c ON c."documentId" = d.id
     WHERE d.status = 'PROCESSING'
     GROUP BY d.id, d.filename
     HAVING COUNT(c.id) FILTER (WHERE c.embedding IS NULL) > 0
     ORDER BY COUNT(c.id) FILTER (WHERE c.embedding IS NULL) ASC`
  );

  const triggered: string[] = [];
  const alreadyReady: string[] = [];

  for (const doc of stuckDocuments) {
    if (Number(doc.pending) === 0) {
      // Marcar como READY directamente
      await prisma.document.update({
        where: { id: doc.id },
        data: { status: "READY" },
      });
      alreadyReady.push(doc.id);
    } else {
      triggered.push(doc.id);
    }
  }

  return { triggered, alreadyReady };
}
