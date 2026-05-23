import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Coverage = matriz periodo × categoría con conteo de preguntas (y opcionalmente
 * producciones completas) en cada celda. Permite identificar lagunas en el corpus.
 */
export async function GET() {
  const [questionRows, deliverableRows] = await Promise.all([
    prisma.question.groupBy({
      by: ["periodoCode", "categoriaCode"],
      _count: true,
    }),
    prisma.$queryRaw<Array<{ periodoCode: string; categoriaCode: string; count: bigint }>>`
      SELECT q."periodoCode", q."categoriaCode", COUNT(*) AS count
      FROM deliverables d
      JOIN questions q ON d."questionId" = q.id
      WHERE d.status = 'COMPLETE'
      GROUP BY q."periodoCode", q."categoriaCode"
    `,
  ]);

  return NextResponse.json({
    questions: questionRows.map((r) => ({
      periodoCode: r.periodoCode,
      categoriaCode: r.categoriaCode,
      count: r._count,
    })),
    deliverables: deliverableRows.map((r) => ({
      periodoCode: r.periodoCode,
      categoriaCode: r.categoriaCode,
      count: Number(r.count),
    })),
  });
}
