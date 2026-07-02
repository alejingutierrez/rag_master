/**
 * Capa de acceso público — SOLO LECTURA.
 * Alimenta el sitio público desde el corpus del admin. Nunca escribe.
 *
 * Curación: por ahora muestra producciones COMPLETE. Cuando exista la columna
 * `publishedAt` en Deliverable (curación), se filtrará por `publishedAt != null`
 * para que solo salga lo que Manuel apruebe.
 */
import { prisma } from "@/lib/prisma";
import { getAtelierFormat } from "@/lib/atelier-formats";
import { PERIODS } from "@/lib/design-tokens";

export interface PublicEssay {
  id: string;
  title: string;
  formatName: string;
  periodCode: string | null;
}

interface ChunkUsage {
  id?: string;
  documentId?: string;
  documentFilename?: string;
  pageNumber?: number;
}

export interface EssaySource {
  n: number;
  label: string;
  page: number | null;
}

export interface PublicEssayDetail {
  id: string;
  title: string;
  formatName: string;
  periodCode: string | null;
  yearRange: string | null;
  categoria: string | null;
  answer: string;
  dateLabel: string;
  wordCount: number;
  sources: EssaySource[];
}

/** Recorta a un título legible en borde de palabra. */
function shortTitle(text: string, max = 88): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const i = cut.lastIndexOf(" ");
  return (i > max * 0.6 ? cut.slice(0, i) : cut).trimEnd() + "…";
}

function docLabel(c: ChunkUsage): string {
  if (c.documentFilename) return c.documentFilename.replace(/\.pdf$/i, "");
  if (c.documentId) return c.documentId.slice(0, 8);
  return "Fuente";
}

/**
 * Producciones recientes para "Lo último" / el archivo público.
 * El "título" de una producción es la pregunta que responde (o la consulta libre).
 */
export async function getRecentEssays(limit = 8): Promise<PublicEssay[]> {
  try {
    const rows = await prisma.deliverable.findMany({
      where: { status: "COMPLETE", source: "atelier" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        templateId: true,
        userQuestion: true,
        question: { select: { pregunta: true, periodoCode: true } },
      },
    });
    return rows.map((d) => ({
      id: d.id,
      title: shortTitle(d.question?.pregunta ?? d.userQuestion ?? "(producción)"),
      formatName: getAtelierFormat(d.templateId)?.name ?? d.templateId,
      periodCode: d.question?.periodoCode ?? null,
    }));
  } catch (err) {
    console.error("[public-data] getRecentEssays falló:", err);
    return [];
  }
}

/** Total de producciones publicables (para conteos del archivo). */
export async function getEssayCount(): Promise<number> {
  try {
    return await prisma.deliverable.count({ where: { status: "COMPLETE", source: "atelier" } });
  } catch (err) {
    console.error("[public-data] getEssayCount falló:", err);
    return 0;
  }
}

/** Detalle de una producción para la página de lectura pública. */
export async function getEssay(id: string): Promise<PublicEssayDetail | null> {
  try {
    const d = await prisma.deliverable.findUnique({
      where: { id },
      select: {
        id: true,
        templateId: true,
        answer: true,
        status: true,
        source: true,
        createdAt: true,
        chunksUsed: true,
        userQuestion: true,
        question: {
          select: { pregunta: true, periodoCode: true, categoriaNombre: true },
        },
      },
    });
    if (!d || d.status !== "COMPLETE" || d.source !== "atelier" || !d.answer) return null;

    const chunks: ChunkUsage[] = Array.isArray(d.chunksUsed)
      ? (d.chunksUsed as unknown as ChunkUsage[])
      : [];
    const sources: EssaySource[] = chunks.map((c, i) => ({
      n: i + 1,
      label: docLabel(c),
      page: typeof c.pageNumber === "number" ? c.pageNumber : null,
    }));

    const period = d.question?.periodoCode ?? null;
    return {
      id: d.id,
      title: (d.question?.pregunta ?? d.userQuestion ?? "Producción").trim(),
      formatName: getAtelierFormat(d.templateId)?.name ?? d.templateId,
      periodCode: period,
      yearRange: period ? (PERIODS[period as keyof typeof PERIODS]?.yearRange ?? null) : null,
      categoria: d.question?.categoriaNombre ?? null,
      answer: d.answer,
      dateLabel: d.createdAt.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      wordCount: d.answer.trim().split(/\s+/).filter(Boolean).length,
      sources,
    };
  } catch (err) {
    console.error("[public-data] getEssay falló:", err);
    return null;
  }
}
