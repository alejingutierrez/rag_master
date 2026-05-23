import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { filenameToApa, formatApaEntry, type ApaCitation } from "@/lib/apa-citations";
import type { EnrichmentMetadata } from "@/lib/enrichment-types";

export const dynamic = "force-dynamic";

/**
 * Genera una bibliografía en APA o Chicago a partir de los documentos.
 * Si pasas ?deliverable=ID, solo incluye los docs citados en esa producción.
 */
export async function GET(req: NextRequest) {
  const deliverableId = req.nextUrl.searchParams.get("deliverable");
  const style = (req.nextUrl.searchParams.get("style") ?? "apa") as "apa" | "chicago";

  let documents: Array<{ filename: string; metadata: unknown }> = [];
  if (deliverableId) {
    const d = await prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: { chunksUsed: true },
    });
    if (!d) return NextResponse.json({ error: "Producción no encontrada" }, { status: 404 });
    const chunks = Array.isArray(d.chunksUsed) ? (d.chunksUsed as Array<{ documentFilename?: string }>) : [];
    const filenames = Array.from(new Set(chunks.map((c) => c.documentFilename).filter(Boolean) as string[]));
    if (filenames.length > 0) {
      documents = await prisma.document.findMany({
        where: { filename: { in: filenames } },
        select: { filename: true, metadata: true },
      });
    }
  } else {
    documents = await prisma.document.findMany({
      where: { status: "READY" },
      select: { filename: true, metadata: true },
      orderBy: { filename: "asc" },
    });
  }

  const citations = documents.map((d) => {
    const meta = ((d.metadata ?? {}) as Record<string, unknown>) as EnrichmentMetadata;
    if (meta.bookTitle && meta.author) {
      return {
        author: meta.author,
        year: meta.publicationYear ? String(meta.publicationYear) : "s.f.",
        title: meta.bookTitle,
        publisher: meta.publisher,
        raw: d.filename,
      } as ApaCitation;
    }
    return filenameToApa(d.filename);
  });

  const sorted = citations.sort((a, b) => a.author.localeCompare(b.author));
  const formatted =
    style === "apa"
      ? sorted.map(formatApaEntry)
      : sorted.map(formatChicagoEntry);

  return NextResponse.json({ citations: sorted, formatted, style });
}

function formatChicagoEntry(c: ApaCitation): string {
  // Chicago author-date: Apellido, Nombre. Año. *Título*. Editorial.
  const author = c.author.replace(/,\s*/, ", ").trim();
  const title = c.title.endsWith(".") ? c.title : `${c.title}.`;
  const publisher = c.publisher ? ` ${c.publisher}.` : "";
  return `${author}. ${c.year}. *${title}*${publisher}`;
}
