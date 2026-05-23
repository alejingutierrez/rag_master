import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [docs, questions, deliverables] = await Promise.all([
    prisma.document.findMany({
      where: { status: "READY" },
      select: { id: true, filename: true, metadata: true },
    }),
    prisma.question.groupBy({
      by: ["periodoCode", "periodoNombre", "periodoRango"],
      _count: true,
    }),
    prisma.deliverable.findMany({
      where: { status: "COMPLETE", question: { isNot: null } },
      select: {
        id: true,
        question: { select: { periodoCode: true } },
      },
    }),
  ]);

  // Counts por periodo
  const docsByPeriod = new Map<string, number>();
  for (const d of docs) {
    const meta = (d.metadata ?? {}) as Record<string, unknown>;
    const primary = meta.primaryPeriod;
    if (typeof primary === "string") {
      docsByPeriod.set(primary, (docsByPeriod.get(primary) ?? 0) + 1);
    }
  }

  const delivsByPeriod = new Map<string, number>();
  for (const d of deliverables) {
    const pc = d.question?.periodoCode;
    if (pc) delivsByPeriod.set(pc, (delivsByPeriod.get(pc) ?? 0) + 1);
  }

  return NextResponse.json({
    questions: questions.map((q) => ({
      periodoCode: q.periodoCode,
      periodoNombre: q.periodoNombre,
      periodoRango: q.periodoRango,
      count: q._count,
    })),
    docsByPeriod: Array.from(docsByPeriod.entries()).map(([code, count]) => ({ code, count })),
    deliverablesByPeriod: Array.from(delivsByPeriod.entries()).map(([code, count]) => ({ code, count })),
  });
}
