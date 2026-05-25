import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CHAT_TEMPLATES } from "@/lib/chat-templates";

export const dynamic = "force-dynamic";

// GET /api/questions — Lista con filtros y stats
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const documentId = searchParams.get("documentId") || undefined;
  const periodoCode = searchParams.get("periodo") || undefined;
  const categoriaCode = searchParams.get("categoria") || undefined;
  const subcategoriaCode = searchParams.get("subcategoria") || undefined;
  const search = searchParams.get("search") || undefined;
  // Filtros nuevos
  const entity = searchParams.get("entity") || undefined; // texto contra cualquiera de las 3 listas
  const yearMinRaw = searchParams.get("yearMin");
  const yearMaxRaw = searchParams.get("yearMax");
  const yearMin = yearMinRaw ? parseInt(yearMinRaw, 10) : undefined;
  const yearMax = yearMaxRaw ? parseInt(yearMaxRaw, 10) : undefined;
  // state: pending | partial | complete — filtro de trazabilidad
  const stateParam = searchParams.get("state");
  const state = stateParam && ["pending", "partial", "complete"].includes(stateParam)
    ? (stateParam as "pending" | "partial" | "complete")
    : undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const includeStats = searchParams.get("includeStats") === "true";
  const includeDeliverables = searchParams.get("includeDeliverables") === "true";
  const sortBy = searchParams.get("sortBy") || "default";

  const totalTemplates = CHAT_TEMPLATES.length;

  try {
    const stateFilter =
      state === "pending"
        ? { deliverableCount: 0 }
        : state === "partial"
        ? { deliverableCount: { gt: 0, lt: totalTemplates } }
        : state === "complete"
        ? { deliverableCount: { gte: totalTemplates } }
        : {};

    // search y entity son ambos cláusulas OR. Si vienen los dos hay que usar AND
    // para combinarlas (objeto plano se sobrescribe el segundo OR).
    const andClauses: Array<Record<string, unknown>> = [];
    if (search) {
      andClauses.push({
        OR: [
          { pregunta: { contains: search, mode: "insensitive" as const } },
          { justificacion: { contains: search, mode: "insensitive" as const } },
        ],
      });
    }
    if (entity) {
      // pg arrays — `has` requiere coincidencia exacta del nombre canónico.
      andClauses.push({
        OR: [
          { entidadesPersonas: { has: entity } },
          { entidadesLugares: { has: entity } },
          { entidadesConceptos: { has: entity } },
        ],
      });
    }

    // Filtro de años: ventana [yearMin, yearMax] sobre yearPrincipal.
    // null en yearPrincipal queda excluido por diseño (no tiene anclaje).
    const yearFilter =
      yearMin != null || yearMax != null
        ? {
            yearPrincipal: {
              ...(yearMin != null && { gte: yearMin }),
              ...(yearMax != null && { lte: yearMax }),
            },
          }
        : {};

    const where = {
      ...stateFilter,
      ...(documentId && { documentId }),
      ...(periodoCode && { periodoCode }),
      ...(categoriaCode && { categoriaCode }),
      ...(subcategoriaCode && { subcategoriaCode: { contains: subcategoriaCode } }),
      ...(andClauses.length > 0 && { AND: andClauses }),
      ...yearFilter,
    };

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        include: {
          document: {
            select: { id: true, filename: true, metadata: true, status: true },
          },
          ...(includeDeliverables && {
            deliverables: {
              select: { id: true, templateId: true, status: true, createdAt: true },
              orderBy: { createdAt: "desc" as const },
            },
          }),
        },
        orderBy:
          sortBy === "periodo"
            ? [{ periodoOrden: "asc" }, { ordenPeriodo: { sort: "asc" as const, nulls: "last" as const } }]
            : sortBy === "categoria"
              ? [{ categoriaCode: "asc" }, { ordenCategoria: { sort: "asc" as const, nulls: "last" as const } }]
              : sortBy === "subcategoria"
                ? [{ subcategoriaCode: "asc" }, { ordenSubcategoria: { sort: "asc" as const, nulls: "last" as const } }]
                : sortBy === "recientes"
                  ? [{ createdAt: "desc" }, { questionNumber: "asc" }]
                  // Default = cronologico (incluye sortBy="cronologico" o vacío)
                  : [{ periodoOrden: "asc" }, { ordenPeriodo: { sort: "asc" as const, nulls: "last" as const } }, { questionNumber: "asc" }],
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

      const [pendingC, partialC, completeC, allC] = await Promise.all([
        prisma.question.count({ where: { ...(documentId && { documentId }), deliverableCount: 0 } }),
        prisma.question.count({
          where: {
            ...(documentId && { documentId }),
            deliverableCount: { gt: 0, lt: totalTemplates },
          },
        }),
        prisma.question.count({
          where: {
            ...(documentId && { documentId }),
            deliverableCount: { gte: totalTemplates },
          },
        }),
        prisma.question.count({ where: documentId ? { documentId } : undefined }),
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
        byState: {
          pending: pendingC,
          partial: partialC,
          complete: completeC,
          all: allC,
        },
        totalTemplates,
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
