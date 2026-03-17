import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFromS3 } from "@/lib/s3";
import { parsePDF } from "@/lib/pdf-parser";
import { chunkPages } from "@/lib/chunking";
import { generateEmbedding } from "@/lib/bedrock";
import { saveChunkEmbedding } from "@/lib/vector-search";

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

    // Procesar en background (no bloquear la respuesta)
    processDocument(document.id, s3Key, filename, {
      chunkSize: chunkSize || 1024,
      chunkOverlap: chunkOverlap || 128,
      strategy: (strategy as "FIXED" | "PARAGRAPH" | "SENTENCE") || "FIXED",
    }).catch(console.error);

    return NextResponse.json({ document }, { status: 201 });
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

      // Generar y guardar embedding
      const embedding = await generateEmbedding(chunk.content);
      await saveChunkEmbedding(dbChunk.id, embedding);
    }

    // 6. Marcar como listo
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
