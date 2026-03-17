import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToS3 } from "@/lib/s3";
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

// POST /api/documents - Subir y procesar un PDF
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const chunkSize = parseInt(formData.get("chunkSize") as string) || 1024;
    const chunkOverlap = parseInt(formData.get("chunkOverlap") as string) || 128;
    const strategy = (formData.get("strategy") as string) || "FIXED";

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Se requiere un archivo PDF" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const s3Key = `pdfs/${Date.now()}-${file.name}`;

    // 1. Crear documento en estado PENDING
    const document = await prisma.document.create({
      data: {
        filename: file.name,
        s3Key,
        s3Url: "",
        fileSize: file.size,
        status: "PROCESSING",
      },
    });

    // Procesar en background (no bloquear la respuesta)
    processDocument(document.id, buffer, s3Key, file.name, {
      chunkSize,
      chunkOverlap,
      strategy: strategy as "FIXED" | "PARAGRAPH" | "SENTENCE",
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
  buffer: Buffer,
  s3Key: string,
  filename: string,
  config: { chunkSize: number; chunkOverlap: number; strategy: "FIXED" | "PARAGRAPH" | "SENTENCE" }
) {
  try {
    // 2. Subir a S3
    const s3Url = await uploadToS3(s3Key, buffer, "application/pdf");
    await prisma.document.update({
      where: { id: documentId },
      data: { s3Url },
    });

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
