import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/documents/[id]/questions — Preguntas de un documento
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;

  try {
    const questions = await prisma.question.findMany({
      where: { documentId },
      orderBy: { questionNumber: "asc" },
    });

    // Agrupar por batchId para mostrar historial
    const batches = [...new Set(questions.map((q) => q.batchId))];
    const latestBatch = batches[batches.length - 1] ?? null;
    const latestDate = questions.length > 0
      ? questions[questions.length - 1].createdAt
      : null;

    return NextResponse.json({
      questions,
      count: questions.length,
      latestBatch,
      latestDate,
    });
  } catch (error) {
    console.error("Error fetching document questions:", error);
    return NextResponse.json(
      { error: "Error al obtener preguntas" },
      { status: 500 }
    );
  }
}

// DELETE /api/documents/[id]/questions — Eliminar todas las preguntas del documento
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;

  try {
    const result = await prisma.question.deleteMany({ where: { documentId } });

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("Error deleting questions:", error);
    return NextResponse.json(
      { error: "Error al eliminar preguntas" },
      { status: 500 }
    );
  }
}
