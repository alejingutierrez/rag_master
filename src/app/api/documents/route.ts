import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFromS3 } from "@/lib/s3";
import { parsePDF } from "@/lib/pdf-parser";
import { chunkPages } from "@/lib/chunking";

export const dynamic = "force-dynamic";

// Fase 1: parsear PDF + guardar chunks (sin embeddings) — cabe en timeout Lambda
export const maxDuration = 120;

// GET /api/documents - Listar documentos
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status");
  const enriched = searchParams.get("enriched");

  const where = {
    ...(status && { status: status as "PENDING" | "PROCESSING" | "READY" | "ERROR" }),
    ...(enriched !== null && enriched !== undefined && enriched !== "" && { enriched: enriched === "true" }),
  };

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

// POST /api/documents - Parsear PDF, chunkear y guardar chunks (sin embeddings)
// Los embeddings se generan por lotes via POST /api/documents/[id]/process
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

    try {
      // 2. Descargar PDF de S3
      const buffer = await getFromS3(s3Key);

      // 3. Parsear PDF
      const parsed = await parsePDF(buffer);
      await prisma.document.update({
        where: { id: document.id },
        data: { pageCount: parsed.pageCount },
      });

      // 4. Chunkear
      const chunks = chunkPages(parsed.pages, {
        chunkSize: chunkSize || 3000,
        chunkOverlap: chunkOverlap || 750,
        strategy: (strategy as "FIXED" | "PARAGRAPH" | "SENTENCE") || "FIXED",
      });

      // Si no se extrajo texto útil del PDF (escaneado/imagen)
      if (chunks.length === 0) {
        await prisma.document.update({
          where: { id: document.id },
          data: {
            status: "ERROR",
            error: "No se pudo extraer texto del PDF. Es posible que sea un documento escaneado o basado en imágenes.",
          },
        });
        return NextResponse.json(
          { error: "No se pudo extraer texto del PDF" },
          { status: 422 }
        );
      }

      // 5. Guardar todos los chunks (rápido, solo DB)
      for (const chunk of chunks) {
        await prisma.chunk.create({
          data: {
            documentId: document.id,
            content: chunk.content,
            pageNumber: chunk.pageNumber,
            chunkIndex: chunk.chunkIndex,
            chunkSize: chunkSize || 3000,
            overlap: chunkOverlap || 750,
            strategy: strategy || "FIXED",
            metadata: { sourceFile: filename },
          },
        });
      }

      // Retornar inmediatamente — embeddings se generan via /api/documents/[id]/process
      const updated = await prisma.document.findUnique({
        where: { id: document.id },
        include: { _count: { select: { chunks: true } } },
      });

      return NextResponse.json({ document: updated }, { status: 201 });
    } catch (processingError) {
      console.error(`Error processing document ${document.id}:`, processingError);
      await prisma.document.update({
        where: { id: document.id },
        data: {
          status: "ERROR",
          error: processingError instanceof Error ? processingError.message : "Error desconocido",
        },
      });
      return NextResponse.json(
        { error: "Error al procesar el documento" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: "Error al subir el documento" },
      { status: 500 }
    );
  }
}
