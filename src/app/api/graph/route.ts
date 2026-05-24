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
  const [recentDocs, questions, deliverables] = await Promise.all([
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
      select: { id: true, templateId: true, questionId: true, chunksUsed: true },
    }),
  ]);

  // Documentos extra requeridos por chat-deliverables que no están en recentDocs
  const extraDocIds = new Set<string>();
  for (const d of deliverables) {
    if (d.questionId) continue;
    const chunks = Array.isArray(d.chunksUsed) ? (d.chunksUsed as Array<{ documentId?: string }>) : [];
    const counts = new Map<string, number>();
    for (const c of chunks) {
      if (c.documentId) counts.set(c.documentId, (counts.get(c.documentId) ?? 0) + 1);
    }
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top && !recentDocs.find((r) => r.id === top)) extraDocIds.add(top);
  }

  const extraDocs = extraDocIds.size > 0
    ? await prisma.document.findMany({
        where: { id: { in: Array.from(extraDocIds) } },
        select: {
          id: true,
          filename: true,
          metadata: true,
          _count: { select: { chunks: true, questions: true } },
        },
      })
    : [];

  const docs = [...recentDocs, ...extraDocs];

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
  // Producciones — batch (con questionId) + chat (sin questionId)
  for (const d of deliverables) {
    if (d.questionId && questions.find((q) => q.id === d.questionId)) {
      // batch: vincula a la pregunta
      nodes.push({
        id: `prod::${d.id}`,
        label: d.templateId,
        type: "production",
        metadata: { deliverableId: d.id, templateId: d.templateId },
      });
      edges.push({ source: `q::${d.questionId}`, target: `prod::${d.id}` });
      continue;
    }
    if (!d.questionId) {
      // chat: vincula al documento más citado en chunksUsed
      const chunks = Array.isArray(d.chunksUsed)
        ? (d.chunksUsed as Array<{ documentId?: string }>)
        : [];
      const counts = new Map<string, number>();
      for (const c of chunks) {
        if (c.documentId) counts.set(c.documentId, (counts.get(c.documentId) ?? 0) + 1);
      }
      const topDocId = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topDocId && docs.find((doc) => doc.id === topDocId)) {
        nodes.push({
          id: `prod::${d.id}`,
          label: `${d.templateId} (chat)`,
          type: "production",
          metadata: { deliverableId: d.id, templateId: d.templateId, source: "chat" },
        });
        edges.push({ source: `doc::${topDocId}`, target: `prod::${d.id}` });
      }
    }
  }

  return NextResponse.json({ nodes, edges });
}
