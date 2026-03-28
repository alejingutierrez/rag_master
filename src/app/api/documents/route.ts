import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFromS3 } from "@/lib/s3";
import { parsePDF } from "@/lib/pdf-parser";
import { chunkPages } from "@/lib/chunking";
import { generateEmbedding } from "@/lib/bedrock";
import { saveChunkEmbedding } from "@/lib/vector-search";

// PDFs grandes necesitan más tiempo para parsear + generar embeddings
export const maxDuration = 300;

// GET /api/documents - Listar documentos
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status");

  const where = status ? { status: status as "PENDING" | "PROCESSING" | "READY" | "ERROR" } : {};

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { chunks: true } },
      },
    }),
    prisma.document.count({ where }),
  ]);

  return NextResponse.json({
    documents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// POST /api/documents - Registrar y procesar un PDF ya subido a S3
export async function POST(request: NextRequest) {
  try {
    const { s3Key, s3Url, filename, fileSize, chunkSize, chunkOverlap, strategy } =
      await request.json();

    if (!s3Key || !filename) {
      return NextResponse.json(
        { error: "Se requiere s3Key y filename" },
        { status: 400 }
      );
    }

    // 1. Crear documento en estado PROCESSING
    const document = await prisma.document.create({
      data: {
        filename,
        s3Key,
        s3Url: s3Url || "",
        fileSize: fileSize || 0,
        status: "PROCESSING",
      },
    });

    // Procesar síncronamente (en Lambda el background work se congela al enviar respuesta)
    await processDocument(document.id, s3Key, filename, {
      chunkSize: chunkSize || 6000,
      chunkOverlap: chunkOverlap || 1000,
      strategy: (strategy as "FIXED" | "PARAGRAPH" | "SENTENCE") || "FIXED",
    });

    const updated = await prisma.document.findUnique({
      where: { id: document.id },
      include: { _count: { select: { chunks: true } } },
    });

    return NextResponse.json({ document: updated }, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: "Error al subir el documento" },
      { status: 500 }
    );
  }
}

async function processDocument(
  documentId: string,
  s3Key: string,
  filename: string,
  config: { chunkSize: number; chunkOverlap: number; strategy: "FIXED" | "PARAGRAPH" | "SENTENCE" }
) {
  try {
    // 2. Descargar PDF de S3
    const buffer = await getFromS3(s3Key);

    // 3. Parsear PDF
    const parsed = await parsePDF(buffer);
    await prisma.document.update({
      where: { id: documentId },
      data: { pageCount: parsed.pageCount },
    });

    // 4. Chunkear
    const chunks = chunkPages(parsed.pages, {
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
      strategy: config.strategy,
    });

    // Si no se extrajo texto útil del PDF (escaneado/imagen), marcar como error
    if (chunks.length === 0) {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: "ERROR",
          error: "No se pudo extraer texto del PDF. Es posible que sea un documento escaneado o basado en imágenes.",
        },
      });
      return;
    }

    // 5. Guardar todos los chunks primero (rápido, solo DB)
    const dbChunks = [];
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
      dbChunks.push(dbChunk);
    }

    // 6. Generar embeddings en lotes paralelos (5 concurrentes)
    const BATCH_SIZE = 5;
    for (let i = 0; i < dbChunks.length; i += BATCH_SIZE) {
      const batch = dbChunks.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (dbChunk) => {
          const chunk = chunks.find((c) => c.chunkIndex === dbChunk.chunkIndex);
          if (!chunk) return;
          const embedding = await generateEmbedding(chunk.content);
          await saveChunkEmbedding(dbChunk.id, embedding);
        })
      );
    }

    // 7. Marcar como listo
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "READY" },
    });
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "ERROR",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
    });
  }
}
