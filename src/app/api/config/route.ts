import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/config - Obtener configuración actual
export async function GET() {
  let config = await prisma.configuration.findFirst({
    where: { name: "default" },
  });

  // Si no existe, crear configuración por defecto
  if (!config) {
    config = await prisma.configuration.create({
      data: { name: "default" },
    });
  }

  return NextResponse.json({ config });
}

// PUT /api/config - Actualizar configuración
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const {
    chunkSize,
    chunkOverlap,
    chunkStrategy,
    embeddingModel,
    topK,
    similarityThreshold,
    maxTokens,
  } = body;

  let config = await prisma.configuration.findFirst({
    where: { name: "default" },
  });

  const data: Record<string, unknown> = {};
  if (chunkSize !== undefined) data.chunkSize = chunkSize;
  if (chunkOverlap !== undefined) data.chunkOverlap = chunkOverlap;
  if (chunkStrategy !== undefined) data.chunkStrategy = chunkStrategy;
  if (embeddingModel !== undefined) data.embeddingModel = embeddingModel;
  if (topK !== undefined) data.topK = topK;
  if (similarityThreshold !== undefined) data.similarityThreshold = similarityThreshold;
  if (maxTokens !== undefined) data.maxTokens = maxTokens;

  if (config) {
    config = await prisma.configuration.update({
      where: { id: config.id },
      data,
    });
  } else {
    config = await prisma.configuration.create({
      data: { name: "default", ...data },
    });
  }

  return NextResponse.json({ config });
}
