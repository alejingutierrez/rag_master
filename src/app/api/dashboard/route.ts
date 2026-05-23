import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      documentCount,
      readyDocs,
      processingDocs,
      enrichedDocs,
      chunkCount,
      questionCount,
      conversationCount,
      deliverableCount,
      completedDeliverables,
      recentDocuments,
      recentQuestions,
      recentDeliverables,
      documentsByPeriodRaw,
      questionsByPeriodRaw,
      questionsByCategoryRaw,
      activityRaw,
    ] = await Promise.all([
      prisma.document.count(),
      prisma.document.count({ where: { status: "READY" } }),
      prisma.document.count({ where: { status: "PROCESSING" } }),
      prisma.document.count({ where: { enriched: true } }),
      prisma.chunk.count(),
      prisma.question.count(),
      prisma.conversation.count(),
      prisma.deliverable.count(),
      prisma.deliverable.count({ where: { status: "COMPLETE" } }),
      prisma.document.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          filename: true,
          status: true,
          pageCount: true,
          createdAt: true,
          enriched: true,
          metadata: true,
          _count: { select: { chunks: true, questions: true } },
        },
      }),
      prisma.question.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          pregunta: true,
          periodoCode: true,
          periodoNombre: true,
          categoriaCode: true,
          categoriaNombre: true,
          createdAt: true,
        },
      }),
      prisma.deliverable.findMany({
        take: 5,
        where: { status: "COMPLETE" },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          templateId: true,
          updatedAt: true,
          userQuestion: true,
          question: { select: { pregunta: true, periodoCode: true } },
        },
      }),
      prisma.question.groupBy({
        by: ["periodoCode"],
        _count: true,
      }),
      prisma.question.groupBy({
        by: ["periodoCode"],
        _count: true,
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.question.groupBy({
        by: ["categoriaCode", "categoriaNombre"],
        _count: true,
      }),
      prisma.$queryRaw<{ day: Date; docs: bigint; qs: bigint; prods: bigint }[]>`
        WITH days AS (
          SELECT generate_series(
            (NOW() - INTERVAL '13 days')::date,
            NOW()::date,
            '1 day'::interval
          )::date AS day
        )
        SELECT
          d.day,
          (SELECT COUNT(*) FROM documents WHERE DATE("createdAt") = d.day) AS docs,
          (SELECT COUNT(*) FROM questions WHERE DATE("createdAt") = d.day) AS qs,
          (SELECT COUNT(*) FROM deliverables WHERE DATE("createdAt") = d.day) AS prods
        FROM days d
        ORDER BY d.day ASC
      `,
    ]);

    const recentDocsLast7 = await prisma.document.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });
    const recentQsLast7 = await prisma.question.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });
    const recentProdsLast7 = await prisma.deliverable.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    return NextResponse.json({
      stats: {
        documents: documentCount,
        chunks: chunkCount,
        questions: questionCount,
        conversations: conversationCount,
        deliverables: deliverableCount,
        completedDeliverables,
        readyDocs,
        processingDocs,
        enrichedDocs,
      },
      deltas7d: {
        docs: recentDocsLast7,
        questions: recentQsLast7,
        deliverables: recentProdsLast7,
      },
      recentDocuments,
      recentQuestions,
      recentDeliverables,
      distribution: {
        periodos: documentsByPeriodRaw.map((p) => ({ code: p.periodoCode, count: p._count })),
        periodos30d: questionsByPeriodRaw.map((p) => ({ code: p.periodoCode, count: p._count })),
        categorias: questionsByCategoryRaw.map((c) => ({
          code: c.categoriaCode,
          name: c.categoriaNombre,
          count: c._count,
        })),
      },
      activity: activityRaw.map((a) => ({
        day: a.day.toISOString().slice(0, 10),
        docs: Number(a.docs),
        questions: Number(a.qs),
        deliverables: Number(a.prods),
      })),
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Error al obtener estadísticas" },
      { status: 500 },
    );
  }
}
