import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Búsqueda federada para command palette.
 * Busca en documentos, preguntas y producciones simultáneamente.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ documents: [], questions: [], producciones: [] });

  const like = `%${q}%`;
  const limit = 6;

  const [documents, questions, producciones] = await Promise.all([
    prisma.document.findMany({
      where: { filename: { contains: q, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, filename: true, pageCount: true, metadata: true },
    }),
    prisma.question.findMany({
      where: {
        OR: [
          { pregunta: { contains: q, mode: "insensitive" } },
          { justificacion: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, pregunta: true, periodoNombre: true, categoriaNombre: true },
    }),
    prisma.deliverable.findMany({
      where: {
        OR: [
          { answer: { contains: q, mode: "insensitive" } },
          { userQuestion: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        templateId: true,
        userQuestion: true,
        question: { select: { pregunta: true } },
      },
    }),
  ]);

  return NextResponse.json({
    documents: documents.map((d) => {
      const meta = (d.metadata ?? {}) as Record<string, unknown>;
      return {
        id: d.id,
        filename: d.filename,
        title: typeof meta.bookTitle === "string" ? meta.bookTitle : d.filename,
        pageCount: d.pageCount,
      };
    }),
    questions: questions.map((q) => ({
      id: q.id,
      pregunta: q.pregunta.slice(0, 120),
      periodoNombre: q.periodoNombre,
      categoriaNombre: q.categoriaNombre,
    })),
    producciones: producciones.map((p) => ({
      id: p.id,
      title:
        p.question?.pregunta?.slice(0, 100) ??
        p.userQuestion?.slice(0, 100) ??
        "(producción)",
      templateName: p.templateId,
    })),
  });
}
