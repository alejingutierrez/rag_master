import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/bedrock";
import { saveChunkEmbedding } from "@/lib/vector-search";

export const dynamic = "force-dynamic";

// GET /api/chunks/[id] — Contenido COMPLETO de un fragmento (read-only).
// El snippet persistido en deliverable.chunksUsed va recortado a ~400 chars;
// el modal de "Fuentes" pide aquí el texto íntegro al abrirse.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const chunk = await prisma.chunk.findUnique({
    where: { id },
    select: {
      id: true,
      documentId: true,
      content: true,
      pageNumber: true,
      chunkIndex: true,
      document: { select: { filename: true } },
    },
  });

  if (!chunk) {
    return NextResponse.json({ error: "Chunk no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    id: chunk.id,
    documentId: chunk.documentId,
    documentFilename: chunk.document?.filename ?? null,
    content: chunk.content,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
  });
}

// PATCH /api/chunks/[id] - Editar contenido de un chunk
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { content, metadata } = body;

  const chunk = await prisma.chunk.findUnique({ where: { id } });
  if (!chunk) {
    return NextResponse.json(
      { error: "Chunk no encontrado" },
      { status: 404 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (content !== undefined) updateData.content = content;
  if (metadata !== undefined) {
    const currentMeta =
      typeof chunk.metadata === "object" && chunk.metadata !== null
        ? chunk.metadata
        : {};
    updateData.metadata = { ...(currentMeta as Record<string, unknown>), ...metadata };
  }

  const updated = await prisma.chunk.update({
    where: { id },
    data: updateData,
  });

  // Si se cambió el contenido, regenerar embedding
  if (content !== undefined) {
    const embedding = await generateEmbedding(content);
    await saveChunkEmbedding(id, embedding);
  }

  return NextResponse.json({ chunk: updated });
}
