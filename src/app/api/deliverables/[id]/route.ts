import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/deliverables/[id] — Get single deliverable with full answer
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deliverable = await prisma.deliverable.findUnique({
      where: { id },
      include: {
        question: {
          select: {
            id: true,
            pregunta: true,
            periodoCode: true,
            periodoNombre: true,
            periodoRango: true,
            categoriaCode: true,
            categoriaNombre: true,
            subcategoriaCode: true,
            subcategoriaNombre: true,
            document: { select: { id: true, filename: true } },
          },
        },
      },
    });

    if (!deliverable) {
      return NextResponse.json(
        { error: "Entregable no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(deliverable);
  } catch (error) {
    console.error("Error fetching deliverable:", error);
    return NextResponse.json(
      { error: "Error al obtener entregable" },
      { status: 500 }
    );
  }
}

// DELETE /api/deliverables/[id] — Delete single deliverable
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.deliverable.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting deliverable:", error);
    return NextResponse.json(
      { error: "Error al eliminar entregable" },
      { status: 500 }
    );
  }
}
