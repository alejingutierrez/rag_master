import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveDeliverableTaxonomy } from "@/lib/deliverable-taxonomy";

// GET /api/deliverables — List deliverables with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get("questionId");
    const templateId = searchParams.get("templateId");
    const source = searchParams.get("source"); // "chat" | "batch" | null (all)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    const where: Record<string, unknown> = {};
    if (questionId) where.questionId = questionId;
    if (templateId) where.templateId = templateId;
    if (source && (source === "chat" || source === "batch" || source === "deep_research"))
      where.source = source;

    // Conteos estables: independientes de la pestaña/tipo seleccionado (solo
    // acotados por questionId si viene). Evita que los números bailen al paginar
    // o cambiar de filtro.
    const countScope = questionId ? { questionId } : {};

    const [deliverables, total, bySourceRaw, byTemplateRaw] = await Promise.all([
      prisma.deliverable.findMany({
        where,
        select: {
          id: true,
          questionId: true,
          userQuestion: true,
          source: true,
          templateId: true,
          status: true,
          answer: false,
          chunksUsed: true,
          modelUsed: true,
          batchId: true,
          createdAt: true,
          updatedAt: true,
          question: {
            select: {
              id: true,
              pregunta: true,
              periodoCode: true,
              periodoNombre: true,
              categoriaCode: true,
              categoriaNombre: true,
              documentId: true,
              document: { select: { id: true, filename: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.deliverable.count({ where }),
      prisma.deliverable.groupBy({ by: ["source"], _count: true, where: countScope }),
      prisma.deliverable.groupBy({ by: ["templateId"], _count: true, where: countScope }),
    ]);

    const bySource: Record<string, number> = {};
    for (const r of bySourceRaw) bySource[(r.source as string | null) ?? "unknown"] = r._count;
    const byTemplate: Record<string, number> = {};
    for (const r of byTemplateRaw) byTemplate[r.templateId] = r._count;
    const countsAll = Object.values(bySource).reduce((a, b) => a + b, 0);

    // Cargar metadata de los docs referenciados por chunksUsed (para deliverables sin question).
    const chunkDocIds = new Set<string>();
    for (const d of deliverables) {
      if (d.question) continue;
      const chunks = Array.isArray(d.chunksUsed)
        ? (d.chunksUsed as Array<{ documentId?: string }>)
        : [];
      for (const c of chunks) {
        if (c.documentId) chunkDocIds.add(c.documentId);
      }
    }
    const refDocs = chunkDocIds.size
      ? await prisma.document.findMany({
          where: { id: { in: Array.from(chunkDocIds) } },
          select: { id: true, metadata: true },
        })
      : [];
    const docMap = new Map(refDocs.map((d) => [d.id, d]));

    // Add answer preview
    const deliverablesWithPreview = await prisma.deliverable.findMany({
      where: { id: { in: deliverables.map((d) => d.id) } },
      select: { id: true, answer: true },
    });

    const previewMap = new Map(
      deliverablesWithPreview.map((d) => [
        d.id,
        d.answer.slice(0, 200) + (d.answer.length > 200 ? "..." : ""),
      ])
    );

    const result = deliverables.map((d) => {
      const tax = resolveDeliverableTaxonomy(d, docMap);
      // Sanear: no devolver chunksUsed completo en list (puede ser grande).
      const { chunksUsed: _omit, ...rest } = d;
      void _omit;
      return {
        ...rest,
        answerPreview: previewMap.get(d.id) || "",
        resolvedPeriodoCode: tax.periodoCode ?? null,
        resolvedCategoriaCode: tax.categoriaCode ?? null,
      };
    });

    return NextResponse.json({
      deliverables: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts: { all: countsAll, bySource, byTemplate },
    });
  } catch (error) {
    console.error("Error fetching deliverables:", error);
    return NextResponse.json(
      { error: "Error al obtener entregables" },
      { status: 500 }
    );
  }
}
