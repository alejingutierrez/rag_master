import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/deliverables — List deliverables with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get("questionId");
    const templateId = searchParams.get("templateId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    const where: Record<string, unknown> = {};
    if (questionId) where.questionId = questionId;
    if (templateId) where.templateId = templateId;

    const [deliverables, total] = await Promise.all([
      prisma.deliverable.findMany({
        where,
        select: {
          id: true,
          questionId: true,
          templateId: true,
          status: true,
          answer: false,
          modelUsed: true,
          batchId: true,
          createdAt: true,
          question: {
            select: {
              id: true,
              pregunta: true,
              periodoCode: true,
              periodoNombre: true,
              categoriaCode: true,
              categoriaNombre: true,
              document: { select: { id: true, filename: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.deliverable.count({ where }),
    ]);

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

    const result = deliverables.map((d) => ({
      ...d,
      answerPreview: previewMap.get(d.id) || "",
    }));

    return NextResponse.json({
      deliverables: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching deliverables:", error);
    return NextResponse.json(
      { error: "Error al obtener entregables" },
      { status: 500 }
    );
  }
}
