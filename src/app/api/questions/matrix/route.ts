import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CHAT_TEMPLATES } from "@/lib/chat-templates";

export const dynamic = "force-dynamic";

// GET /api/questions/matrix?documentId=...&periodo=...&categoria=...
// Devuelve la matriz preguntas × templates para la vista /questions/matriz.
// El cliente arma la grilla; aquí solo aplanamos lo que necesita.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const documentId = searchParams.get("documentId") || undefined;
  const periodoCode = searchParams.get("periodo") || undefined;
  const categoriaCode = searchParams.get("categoria") || undefined;
  const status = searchParams.get("status") || undefined; // pending | partial | complete

  try {
    const where = {
      ...(documentId && { documentId }),
      ...(periodoCode && { periodoCode }),
      ...(categoriaCode && { categoriaCode }),
    };

    const questions = await prisma.question.findMany({
      where,
      select: {
        id: true,
        questionNumber: true,
        pregunta: true,
        periodoCode: true,
        periodoNombre: true,
        categoriaCode: true,
        categoriaNombre: true,
        subcategoriaCode: true,
        documentId: true,
        document: { select: { id: true, filename: true } },
        deliverableCount: true,
        completedTemplateIds: true,
        lastDeliveredAt: true,
        ordenPeriodo: true,
        ordenCategoria: true,
        deliverables: {
          select: { id: true, templateId: true, status: true },
        },
      },
      orderBy: [
        { documentId: "asc" },
        { periodoOrden: "asc" },
        { ordenPeriodo: { sort: "asc", nulls: "last" } },
        { questionNumber: "asc" },
      ],
    });

    const totalTemplates = CHAT_TEMPLATES.length;

    // Por pregunta: estado por template (null | PENDING | GENERATING | COMPLETE | ERROR)
    const rows = questions.map((q) => {
      const byTemplate: Record<string, { deliverableId: string; status: string } | null> = {};
      for (const t of CHAT_TEMPLATES) {
        const d = q.deliverables.find((dd) => dd.templateId === t.id);
        byTemplate[t.id] = d ? { deliverableId: d.id, status: d.status } : null;
      }
      const completedCount = q.completedTemplateIds.length;
      const stateLabel: "complete" | "partial" | "pending" =
        completedCount >= totalTemplates
          ? "complete"
          : completedCount > 0
          ? "partial"
          : "pending";
      return {
        id: q.id,
        pregunta: q.pregunta,
        periodoCode: q.periodoCode,
        periodoNombre: q.periodoNombre,
        categoriaCode: q.categoriaCode,
        categoriaNombre: q.categoriaNombre,
        subcategoriaCode: q.subcategoriaCode,
        documentId: q.documentId,
        documentFilename: q.document.filename,
        completedCount,
        stateLabel,
        byTemplate,
      };
    });

    const filtered = status
      ? rows.filter((r) => r.stateLabel === status)
      : rows;

    return NextResponse.json({
      templates: CHAT_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        icon: t.icon,
      })),
      totalTemplates,
      rows: filtered,
      counts: {
        all: rows.length,
        complete: rows.filter((r) => r.stateLabel === "complete").length,
        partial: rows.filter((r) => r.stateLabel === "partial").length,
        pending: rows.filter((r) => r.stateLabel === "pending").length,
      },
    });
  } catch (error) {
    console.error("Error fetching question matrix:", error);
    return NextResponse.json(
      { error: "Error al obtener la matriz" },
      { status: 500 }
    );
  }
}
