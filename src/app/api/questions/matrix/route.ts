import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ATELIER_FORMAT_LIST } from "@/lib/atelier-formats";

export const dynamic = "force-dynamic";

// GET /api/questions/matrix?documentId=...&periodo=...&categoria=...
// Devuelve la matriz preguntas × formatos del Taller para la vista /questions/matriz.
// El estado de cada celda se computa directo de los Deliverables (templateId =
// formatId para los del Taller), sin depender de completedTemplateIds.
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

    const totalFormats = ATELIER_FORMAT_LIST.length;

    // Por pregunta: estado por formato. Se computa directo de los Deliverables
    // (un entregable del Taller lleva templateId = formatId), no de los conteos
    // denormalizados — así no depende de syncQuestionStats.
    const rows = questions.map((q) => {
      const byFormat: Record<string, { deliverableId: string; status: string } | null> = {};
      let completedCount = 0;
      for (const f of ATELIER_FORMAT_LIST) {
        const d = q.deliverables.find((dd) => dd.templateId === f.id);
        byFormat[f.id] = d ? { deliverableId: d.id, status: d.status } : null;
        if (d?.status === "COMPLETE") completedCount++;
      }
      const stateLabel: "complete" | "partial" | "pending" =
        completedCount >= totalFormats ? "complete" : completedCount > 0 ? "partial" : "pending";
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
        byFormat,
      };
    });

    const filtered = status ? rows.filter((r) => r.stateLabel === status) : rows;

    return NextResponse.json({
      formats: ATELIER_FORMAT_LIST.map((f) => ({
        id: f.id,
        name: f.name,
        defaultWords: f.defaultWords,
      })),
      totalFormats,
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
