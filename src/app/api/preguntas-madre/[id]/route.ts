import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/preguntas-madre/[id] — detalle de una pregunta-madre con sus
 * preguntas-hija (cross-libro) y los entregables ya producidos contra ella.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const master = await prisma.masterQuestion.findUnique({
    where: { id },
    include: {
      links: {
        orderBy: { isPrimary: "desc" },
        include: {
          question: {
            select: {
              id: true, pregunta: true, periodoCode: true, categoriaCode: true,
              subcategoriaNombre: true, hipotesisImplicita: true, tipoPregunta: true,
              document: { select: { id: true, filename: true } },
            },
          },
        },
      },
    },
  });

  if (!master) return NextResponse.json({ error: "Pregunta-madre no encontrada" }, { status: 404 });

  const children = master.links.map((l) => ({
    id: l.question.id,
    pregunta: l.question.pregunta,
    periodoCode: l.question.periodoCode,
    categoriaCode: l.question.categoriaCode,
    subcategoria: l.question.subcategoriaNombre,
    hipotesis: l.question.hipotesisImplicita,
    tipo: l.question.tipoPregunta,
    libro: l.question.document?.filename ?? null,
    documentId: l.question.document?.id ?? null,
    isPrimary: l.isPrimary,
  }));

  // Entregables producidos contra esta madre (source "master").
  const deliverables = await prisma.deliverable.findMany({
    where: { source: "master", metadata: { path: ["masterId"], equals: id } },
    select: { id: true, templateId: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  }).catch(() => []);

  const { links: _omit, ...masterCore } = master;
  void _omit;
  return NextResponse.json({ master: masterCore, children, deliverables });
}
