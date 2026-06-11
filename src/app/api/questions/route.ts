import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ATELIER_FORMAT_LIST } from "@/lib/atelier-formats";
import { TIPOS_PREGUNTA, ESCALAS_GEOGRAFICAS } from "@/lib/questions-config";

export const dynamic = "force-dynamic";

// GET /api/questions — Lista con filtros y stats
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const documentId = searchParams.get("documentId") || undefined;
  const periodoCode = searchParams.get("periodo") || undefined;
  const categoriaCode = searchParams.get("categoria") || undefined;
  const subcategoriaCode = searchParams.get("subcategoria") || undefined;
  const search = searchParams.get("search") || undefined;
  // Filtros de metadata analítica (validados contra enum del generador)
  const tipoRaw = searchParams.get("tipoPregunta");
  const tipoPregunta = tipoRaw && (TIPOS_PREGUNTA as readonly string[]).includes(tipoRaw)
    ? tipoRaw
    : undefined;
  const escalaRaw = searchParams.get("escalaGeografica");
  const escalaGeografica = escalaRaw && (ESCALAS_GEOGRAFICAS as readonly string[]).includes(escalaRaw)
    ? escalaRaw
    : undefined;
  // clusterTematico: búsqueda exacta. Si en el futuro queremos LIKE, cambiar a contains.
  const clusterTematico = searchParams.get("clusterTematico") || undefined;
  // ids: lista explícita de preguntas (CSV). Usado por la línea de tiempo para
  // cargar las preguntas-evidencia de un evento. Cap de 30 para acotar la query.
  const ids = searchParams.get("ids")?.split(",").filter(Boolean).slice(0, 30);
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

  const totalTemplates = ATELIER_FORMAT_LIST.length;

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
      ...(ids?.length && { id: { in: ids } }),
      ...(documentId && { documentId }),
      ...(periodoCode && { periodoCode }),
      ...(categoriaCode && { categoriaCode }),
      ...(subcategoriaCode && { subcategoriaCode: { contains: subcategoriaCode } }),
      ...(tipoPregunta && { tipoPregunta }),
      ...(escalaGeografica && { escalaGeografica }),
      ...(clusterTematico && { clusterTematico }),
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
      const scopeWhere = documentId ? { documentId } : undefined;
      const [byCategoria, byPeriodo, totalDocs, byTipo, byEscala, topClustersRaw] = await Promise.all([
        prisma.question.groupBy({
          by: ["categoriaCode", "categoriaNombre"],
          _count: { categoriaCode: true },
          orderBy: { _count: { categoriaCode: "desc" } },
          where: scopeWhere,
        }),
        prisma.question.groupBy({
          by: ["periodoCode", "periodoNombre"],
          _count: { periodoCode: true },
          orderBy: { _count: { periodoCode: "desc" } },
          where: scopeWhere,
        }),
        prisma.question
          .findMany({
            select: { documentId: true },
            distinct: ["documentId"],
          })
          .then((r) => r.length),
        // Metadata analítica — filtra NULL para excluir preguntas pre-2026-05-27.
        prisma.question.groupBy({
          by: ["tipoPregunta"],
          _count: { tipoPregunta: true },
          orderBy: { _count: { tipoPregunta: "desc" } },
          where: {
            ...(scopeWhere ?? {}),
            tipoPregunta: { not: null },
          },
        }),
        prisma.question.groupBy({
          by: ["escalaGeografica"],
          _count: { escalaGeografica: true },
          orderBy: { _count: { escalaGeografica: "desc" } },
          where: {
            ...(scopeWhere ?? {}),
            escalaGeografica: { not: null },
          },
        }),
        // Top 12 clusters por count. Útil para el filtro UI (no enumeramos todos).
        prisma.question.groupBy({
          by: ["clusterTematico"],
          _count: { clusterTematico: true },
          orderBy: { _count: { clusterTematico: "desc" } },
          where: {
            ...(scopeWhere ?? {}),
            clusterTematico: { not: null },
          },
          take: 12,
        }),
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
        byTipo: byTipo
          .filter((t) => t.tipoPregunta != null)
          .map((t) => ({
            code: t.tipoPregunta as string,
            count: t._count.tipoPregunta,
          })),
        byEscala: byEscala
          .filter((e) => e.escalaGeografica != null)
          .map((e) => ({
            code: e.escalaGeografica as string,
            count: e._count.escalaGeografica,
          })),
        topClusters: topClustersRaw
          .filter((c) => c.clusterTematico != null)
          .map((c) => ({
            label: c.clusterTematico as string,
            count: c._count.clusterTematico,
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
