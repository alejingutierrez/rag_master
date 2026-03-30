import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/questions/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        document: { select: { id: true, filename: true } },
      },
    });

    if (!question) {
      return NextResponse.json({ error: "Pregunta no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ question });
  } catch (error) {
    console.error(`Error fetching question ${id}:`, error);
    return NextResponse.json(
      { error: "Error al obtener pregunta" },
      { status: 500 }
    );
  }
}

// DELETE /api/questions/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.question.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error(`Error deleting question ${id}:`, error);
    return NextResponse.json(
      { error: "Error al eliminar pregunta" },
      { status: 500 }
    );
  }
}
