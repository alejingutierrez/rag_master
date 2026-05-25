import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFromS3 } from "@/lib/s3";
import { parsePDF } from "@/lib/pdf-parser";
import { chunkPages } from "@/lib/chunking";
import { processAllEmbeddings } from "@/lib/embedding-processor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/documents/[id]/reprocess - Re-chunkear y re-embedder
// Borra chunks viejos, re-parse + re-chunk (síncrono, rápido), responde inmediato.
// Los embeddings se generan en background vía after() — el cliente debe pollear
// GET /api/documents/[id]/process para conocer el progreso.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const {
    chunkSize = 2000,
    chunkOverlap = 500,
    strategy = "FIXED",
  }: { chunkSize?: number; chunkOverlap?: number; strategy?: "FIXED" | "PARAGRAPH" | "SENTENCE" } = body;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  try {
    await prisma.document.update({
      where: { id },
      data: { status: "PROCESSING", error: null },
    });

    // 1. Borrar chunks anteriores
    await prisma.chunk.deleteMany({ where: { documentId: id } });

    // 2. Descargar PDF de S3
    const buffer = await getFromS3(document.s3Key);

    // 3. Parsear + re-chunkear (palabras, cross-page)
    const parsed = await parsePDF(buffer);
    const chunks = chunkPages(parsed.pages, { chunkSize, chunkOverlap, strategy });

    if (chunks.length === 0) {
      await prisma.document.update({
        where: { id },
        data: {
          status: "ERROR",
          error: "No se pudo extraer texto del PDF (escaneado/imágenes o sin contenido de calidad)",
        },
      });
      return NextResponse.json(
        { error: "No se extrajeron chunks de calidad del PDF" },
        { status: 422 }
      );
    }

    // 4. Insertar nuevos chunks (sin embeddings — se generan en background)
    for (const chunk of chunks) {
      await prisma.chunk.create({
        data: {
          documentId: id,
          content: chunk.content,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          chunkSize,
          overlap: chunkOverlap,
          strategy,
          metadata: { sourceFile: document.filename, unit: "words" },
        },
      });
    }

    await prisma.document.update({
      where: { id },
      data: { pageCount: parsed.pageCount },
    });

    // 5. Disparar embeddings en background — la respuesta NO espera
    after(async () => {
      await processAllEmbeddings(id);
    });

    const updated = await prisma.document.findUnique({
      where: { id },
      include: { _count: { select: { chunks: true } } },
    });

    return NextResponse.json({
      document: updated,
      chunks: chunks.length,
      message: "Re-chunkeo completado, embeddings en background",
    });
  } catch (error) {
    console.error(`Error reprocessing document ${id}:`, error);
    await prisma.document.update({
      where: { id },
      data: {
        status: "ERROR",
        error: error instanceof Error ? error.message : "Error al reprocesar",
      },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al reprocesar" },
      { status: 500 }
    );
  }
}
