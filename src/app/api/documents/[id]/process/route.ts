import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/bedrock";
import { saveChunkEmbedding } from "@/lib/vector-search";

export const dynamic = "force-dynamic";

// Cada llamada procesa un lote pequeño de embeddings — cabe en timeout Lambda
export const maxDuration = 120;

// Chunks a procesar por invocación Lambda (3 concurrentes × ~3-5s cada uno ≈ 30-50s)
const BATCH_SIZE = 10;

// POST /api/documents/[id]/process - Genera embeddings para el siguiente lote de chunks
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;

  try {
    // Verificar que el documento existe
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Documento no encontrado" },
        { status: 404 }
      );
    }

    // Contar chunks totales y sin embedding
    const [totalChunks, pendingChunks] = await Promise.all([
      prisma.chunk.count({ where: { documentId } }),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*) as count FROM chunks WHERE "documentId" = $1 AND embedding IS NULL`,
        documentId
      ),
    ]);

    const pending = Number(pendingChunks[0]?.count ?? 0);
    const processed = totalChunks - pending;

    // Si ya no quedan pendientes, marcar como READY
    if (pending === 0) {
      if (document.status !== "READY") {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: "READY" },
        });
      }
      return NextResponse.json({
        status: "READY",
        totalChunks,
        processedChunks: totalChunks,
        pendingChunks: 0,
      });
    }

    // Obtener siguiente lote de chunks sin embedding
    const chunksToProcess = await prisma.$queryRawUnsafe<
      Array<{ id: string; content: string }>
    >(
      `SELECT id, content FROM chunks WHERE "documentId" = $1 AND embedding IS NULL ORDER BY "chunkIndex" LIMIT $2`,
      documentId,
      BATCH_SIZE
    );

    // Generar embeddings en sub-lotes de 3 concurrentes
    const CONCURRENCY = 3;
    for (let i = 0; i < chunksToProcess.length; i += CONCURRENCY) {
      const batch = chunksToProcess.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (chunk) => {
          const embedding = await generateEmbedding(chunk.content);
          await saveChunkEmbedding(chunk.id, embedding);
        })
      );
    }

    const newProcessed = processed + chunksToProcess.length;
    const newPending = totalChunks - newProcessed;

    // Si completamos todos, marcar como READY
    if (newPending === 0) {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "READY" },
      });
    }

    return NextResponse.json({
      status: newPending === 0 ? "READY" : "PROCESSING",
      totalChunks,
      processedChunks: newProcessed,
      pendingChunks: newPending,
    });
  } catch (error) {
    console.error(`Error processing embeddings for ${documentId}:`, error);

    // Marcar documento como error solo si es un fallo irrecuperable
    const isThrottled =
      error instanceof Error &&
      (error.name === "ThrottlingException" ||
        error.message.includes("throttl"));

    if (!isThrottled) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: "ERROR",
          error: error instanceof Error ? error.message : "Error desconocido",
        },
      });
    }

    return NextResponse.json(
      {
        error: isThrottled
          ? "Bedrock throttling — reintenta en unos segundos"
          : "Error al generar embeddings",
        retryable: isThrottled,
      },
      { status: isThrottled ? 429 : 500 }
    );
  }
}
