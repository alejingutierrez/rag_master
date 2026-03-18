import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFromS3 } from "@/lib/s3";
import { parsePDF } from "@/lib/pdf-parser";
import { chunkPages } from "@/lib/chunking";
import { generateEmbedding } from "@/lib/bedrock";
import { saveChunkEmbedding } from "@/lib/vector-search";

export const maxDuration = 300;

// POST /api/documents/[id]/reprocess - Re-chunkear y re-embedder
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const {
    chunkSize = 1024,
    chunkOverlap = 128,
    strategy = "FIXED",
  } = body;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    return NextResponse.json(
      { error: "Documento no encontrado" },
      { status: 404 }
    );
  }

  // Marcar como procesando
  await prisma.document.update({
    where: { id },
    data: { status: "PROCESSING" },
  });

  // Procesar síncronamente (en Lambda el background work se congela)
  await reprocessDocument(id, document.s3Key, document.filename, {
    chunkSize,
    chunkOverlap,
    strategy,
  });

  const updated = await prisma.document.findUnique({
    where: { id },
    include: { _count: { select: { chunks: true } } },
  });

  return NextResponse.json({ document: updated });
}

async function reprocessDocument(
  documentId: string,
  s3Key: string,
  filename: string,
  config: { chunkSize: number; chunkOverlap: number; strategy: "FIXED" | "PARAGRAPH" | "SENTENCE" }
) {
  try {
    // 1. Eliminar chunks anteriores
    await prisma.chunk.deleteMany({ where: { documentId } });

    // 2. Descargar PDF de S3
    const buffer = await getFromS3(s3Key);

    // 3. Parsear
    const parsed = await parsePDF(buffer);

    // 4. Chunkear con nuevos parámetros
    const chunks = chunkPages(parsed.pages, {
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
      strategy: config.strategy,
    });

    // 5. Guardar chunks y generar embeddings
    for (const chunk of chunks) {
      const dbChunk = await prisma.chunk.create({
        data: {
          documentId,
          content: chunk.content,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          chunkSize: config.chunkSize,
          overlap: config.chunkOverlap,
          strategy: config.strategy,
          metadata: { sourceFile: filename },
        },
      });

      const embedding = await generateEmbedding(chunk.content);
      await saveChunkEmbedding(dbChunk.id, embedding);
    }

    // 6. Marcar como listo
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "READY" },
    });
  } catch (error) {
    console.error(`Error reprocessing document ${documentId}:`, error);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "ERROR",
        error: error instanceof Error ? error.message : "Error al reprocesar",
      },
    });
  }
}
