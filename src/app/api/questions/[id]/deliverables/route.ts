import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ATELIER_FORMAT_LIST } from "@/lib/atelier-formats";

export const dynamic = "force-dynamic";

// GET /api/questions/[id]/deliverables
// Devuelve un agregado: la pregunta + sus entregables + qué templates faltan.
// Útil para el badge de estado en /questions y para la vista de detalle.
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
        deliverables: {
          select: {
            id: true,
            templateId: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            modelUsed: true,
            batchId: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Pregunta no encontrada" },
        { status: 404 }
      );
    }

    // Mapa estado por template para los templates que existen
    const byTemplate: Record<string, {
      deliverableId: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    } | null> = {};

    for (const f of ATELIER_FORMAT_LIST) {
      const d = question.deliverables.find((d) => d.templateId === f.id);
      byTemplate[f.id] = d
        ? {
            deliverableId: d.id,
            status: d.status,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          }
        : null;
    }

    const completedCount = Object.values(byTemplate).filter(
      (s) => s?.status === "COMPLETE"
    ).length;
    const totalTemplates = ATELIER_FORMAT_LIST.length;
    const missingTemplateIds = ATELIER_FORMAT_LIST.filter(
      (f) => byTemplate[f.id]?.status !== "COMPLETE"
    ).map((f) => f.id);

    return NextResponse.json({
      question: {
        id: question.id,
        pregunta: question.pregunta,
        periodoCode: question.periodoCode,
        periodoNombre: question.periodoNombre,
        categoriaCode: question.categoriaCode,
        categoriaNombre: question.categoriaNombre,
        subcategoriaCode: question.subcategoriaCode,
        subcategoriaNombre: question.subcategoriaNombre,
        documentId: question.documentId,
        document: question.document,
        deliverableCount: question.deliverableCount,
        completedTemplateIds: question.completedTemplateIds,
        lastDeliveredAt: question.lastDeliveredAt,
      },
      byTemplate,
      completedCount,
      totalTemplates,
      missingTemplateIds,
      deliverables: question.deliverables,
    });
  } catch (error) {
    console.error("Error fetching deliverables for question:", error);
    return NextResponse.json(
      { error: "Error al obtener entregables" },
      { status: 500 }
    );
  }
}
