import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/questions — Lista con filtros y stats
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const documentId = searchParams.get("documentId") || undefined;
  const periodoCode = searchParams.get("periodo") || undefined;
  const categoriaCode = searchParams.get("categoria") || undefined;
  const subcategoriaCode = searchParams.get("subcategoria") || undefined;
  const search = searchParams.get("search") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const includeStats = searchParams.get("includeStats") === "true";

  try {
    const where = {
      ...(documentId && { documentId }),
      ...(periodoCode && { periodoCode }),
      ...(categoriaCode && { categoriaCode }),
      ...(subcategoriaCode && { subcategoriaCode: { contains: subcategoriaCode } }),
      ...(search && {
        OR: [
          { pregunta: { contains: search, mode: "insensitive" as const } },
          { justificacion: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        include: {
          document: {
            select: { id: true, filename: true, metadata: true, status: true },
          },
        },
        orderBy: [{ createdAt: "desc" }, { questionNumber: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.question.count({ where }),
    ]);

    let stats = null;
    if (includeStats) {
      const [byCategoria, byPeriodo, totalDocs] = await Promise.all([
        prisma.question.groupBy({
          by: ["categoriaCode", "categoriaNombre"],
          _count: { categoriaCode: true },
          orderBy: { _count: { categoriaCode: "desc" } },
          where: documentId ? { documentId } : undefined,
        }),
        prisma.question.groupBy({
          by: ["periodoCode", "periodoNombre"],
          _count: { periodoCode: true },
          orderBy: { _count: { periodoCode: "desc" } },
          where: documentId ? { documentId } : undefined,
        }),
        prisma.question
          .findMany({
            select: { documentId: true },
            distinct: ["documentId"],
          })
          .then((r) => r.length),
      ]);

      stats = {
        byCategoria: byCategoria.map((c) => ({
          code: c.categoriaCode,
          nombre: c.categoriaNombre,
          count: c._count.categoriaCode,
        })),
        byPeriodo: byPeriodo.map((p) => ({
          code: p.periodoCode,
          nombre: p.periodoNombre,
          count: p._count.periodoCode,
        })),
        totalDocuments: totalDocs,
        totalQuestions: await prisma.question.count(),
      };
    }

    return NextResponse.json({
      questions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      ...(stats && { stats }),
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return NextResponse.json(
      { error: "Error al obtener preguntas" },
      { status: 500 }
    );
  }
}
