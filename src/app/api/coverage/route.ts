import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveDeliverableTaxonomy } from "@/lib/deliverable-taxonomy";

export const dynamic = "force-dynamic";

/**
 * Coverage = matriz periodo × categoría con conteo de preguntas y producciones.
 * Para producciones de chat (sin questionId), derivamos taxonomía del documento
 * más citado en chunksUsed.
 */
export async function GET() {
  const [questionRows, deliverables, docs] = await Promise.all([
    prisma.question.groupBy({
      by: ["periodoCode", "categoriaCode"],
      _count: true,
    }),
    prisma.deliverable.findMany({
      where: { status: "COMPLETE" },
      select: {
        id: true,
        questionId: true,
        chunksUsed: true,
        question: { select: { periodoCode: true, categoriaCode: true, documentId: true } },
      },
    }),
    prisma.document.findMany({
      where: { status: "READY" },
      select: { id: true, metadata: true },
    }),
  ]);

  const docMap = new Map(docs.map((d) => [d.id, d]));

  // Build deliverable counts via shared resolver
  const delivMap = new Map<string, number>();
  for (const d of deliverables) {
    const tax = resolveDeliverableTaxonomy(d, docMap);
    if (tax.periodoCode && tax.categoriaCode) {
      const key = `${tax.periodoCode}::${tax.categoriaCode}`;
      delivMap.set(key, (delivMap.get(key) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    questions: questionRows.map((r) => ({
      periodoCode: r.periodoCode,
      categoriaCode: r.categoriaCode,
      count: r._count,
    })),
    deliverables: Array.from(delivMap.entries()).map(([key, count]) => {
      const [periodoCode, categoriaCode] = key.split("::");
      return { periodoCode, categoriaCode, count };
    }),
  });
}
