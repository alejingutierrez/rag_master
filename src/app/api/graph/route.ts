import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERIOD_OPTIONS, CATEGORY_OPTIONS } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

/**
 * Grafo: nodos = documentos + preguntas + producciones + periodos + categorías.
 * Aristas = relaciones derivadas (doc→pregunta, pregunta→producción, pregunta→periodo, etc.).
 *
 * Para evitar grafos hipermasivos, limitamos a 60 nodos por tipo.
 */
export async function GET() {
  const [docs, questions, deliverables] = await Promise.all([
    prisma.document.findMany({
      where: { status: "READY" },
      take: 60,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        filename: true,
        metadata: true,
        _count: { select: { chunks: true, questions: true } },
      },
    }),
    prisma.question.findMany({
      take: 60,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        pregunta: true,
        periodoCode: true,
        categoriaCode: true,
        documentId: true,
        deliverableCount: true,
      },
    }),
    prisma.deliverable.findMany({
      take: 40,
      where: { status: "COMPLETE" },
      orderBy: { createdAt: "desc" },
      select: { id: true, templateId: true, questionId: true },
    }),
  ]);

  type Node = { id: string; label: string; type: string; color?: string; size?: number; metadata?: Record<string, unknown> };
  type Edge = { source: string; target: string };

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Periodos como nodos
  for (const p of PERIOD_OPTIONS) {
    nodes.push({
      id: `period::${p.code}`,
      label: p.nombre,
      type: "period",
    });
  }
  // Categorías
  for (const c of CATEGORY_OPTIONS) {
    nodes.push({
      id: `cat::${c.code}`,
      label: c.nombre,
      type: "category",
    });
  }
  // Documentos
  for (const d of docs) {
    const meta = (d.metadata ?? {}) as Record<string, unknown>;
    nodes.push({
      id: `doc::${d.id}`,
      label: (typeof meta.bookTitle === "string" ? meta.bookTitle : d.filename).slice(0, 40),
      type: "document",
      size: d._count.chunks,
      metadata: { docId: d.id, primaryPeriod: meta.primaryPeriod, primaryCategory: meta.primaryCategory },
    });
    if (typeof meta.primaryPeriod === "string") {
      edges.push({ source: `doc::${d.id}`, target: `period::${meta.primaryPeriod}` });
    }
    if (typeof meta.primaryCategory === "string") {
      edges.push({ source: `doc::${d.id}`, target: `cat::${meta.primaryCategory}` });
    }
  }
  // Preguntas
  for (const q of questions) {
    nodes.push({
      id: `q::${q.id}`,
      label: q.pregunta.slice(0, 60),
      type: "question",
      size: q.deliverableCount ?? 0,
      metadata: { questionId: q.id, periodoCode: q.periodoCode, categoriaCode: q.categoriaCode },
    });
    edges.push({ source: `q::${q.id}`, target: `period::${q.periodoCode}` });
    edges.push({ source: `q::${q.id}`, target: `cat::${q.categoriaCode}` });
    if (docs.find((d) => d.id === q.documentId)) {
      edges.push({ source: `doc::${q.documentId}`, target: `q::${q.id}` });
    }
  }
  // Producciones
  for (const d of deliverables) {
    if (!d.questionId) continue;
    if (!questions.find((q) => q.id === d.questionId)) continue;
    nodes.push({
      id: `prod::${d.id}`,
      label: d.templateId,
      type: "production",
      metadata: { deliverableId: d.id, templateId: d.templateId },
    });
    edges.push({ source: `q::${d.questionId}`, target: `prod::${d.id}` });
  }

  return NextResponse.json({ nodes, edges });
}
