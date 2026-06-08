import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/preguntas-madre — lista paginada de preguntas-madre (capa de
 * consolidación). Filtros: periodo, categoria, status, search. Ver
 * docs/consolidacion-preguntas-madre.md.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const periodo = searchParams.get("periodo") || undefined;
  const categoria = searchParams.get("categoria") || undefined;
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search")?.trim() || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "40", 10));
  const includeStats = searchParams.get("includeStats") === "true";

  const where: Prisma.MasterQuestionWhereInput = {
    ...(periodo ? { periodoCode: periodo } : {}),
    ...(categoria ? { categoriaCode: categoria } : {}),
    ...(status ? { status: status as Prisma.MasterQuestionWhereInput["status"] } : {}),
    ...(search
      ? {
          OR: [
            { pregunta: { contains: search, mode: "insensitive" } },
            { problemaSubyacente: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  try {
    const [items, total] = await Promise.all([
      prisma.masterQuestion.findMany({
        where,
        orderBy: [{ periodoOrden: "asc" }, { categoriaCode: "asc" }, { gateScore: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, periodoCode: true, periodoOrden: true, categoriaCode: true,
          pregunta: true, problemaSubyacente: true, tesisEnTension: true,
          tipoPregunta: true, escalaGeografica: true, gateScore: true,
          status: true, childCount: true, bookCount: true,
        },
      }),
      prisma.masterQuestion.count({ where }),
    ]);

    let stats: unknown = null;
    if (includeStats) {
      const [byPeriodo, totalAll, byStatus] = await Promise.all([
        prisma.masterQuestion.groupBy({ by: ["periodoCode"], _count: { _all: true } }),
        prisma.masterQuestion.count(),
        prisma.masterQuestion.groupBy({ by: ["status"], _count: { _all: true } }),
      ]);
      stats = {
        total: totalAll,
        byPeriodo: byPeriodo.map((b) => ({ periodoCode: b.periodoCode, count: b._count._all })),
        byStatus: byStatus.map((b) => ({ status: b.status, count: b._count._all })),
      };
    }

    return NextResponse.json({
      items,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      stats,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
