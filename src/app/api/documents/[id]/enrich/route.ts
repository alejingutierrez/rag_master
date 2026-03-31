import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enrichDocument } from "@/lib/document-enricher";
import type { EnrichmentMetadata } from "@/lib/enrichment-types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Campos de enriquecimiento para detectar si es una actualización de enriquecimiento
const ENRICHMENT_FIELDS: (keyof EnrichmentMetadata)[] = [
  "bookTitle", "author", "isbn", "pageCount", "summary",
  "primaryPeriod", "secondaryPeriod", "primaryCategory", "secondaryCategory",
  "publisher", "publicationYear", "edition", "keywords",
];

// PATCH /api/documents/[id]/enrich — Actualizar metadata manualmente
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { metadata } = body;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    return NextResponse.json(
      { error: "Documento no encontrado" },
      { status: 404 }
    );
  }

  // Merge metadata existente con nueva
  const currentMetadata =
    typeof document.metadata === "object" && document.metadata !== null
      ? document.metadata
      : {};
  const merged = { ...(currentMetadata as Record<string, unknown>), ...metadata };

  // Detectar si contiene campos de enriquecimiento → marcar enriched=true
  const hasEnrichmentFields = ENRICHMENT_FIELDS.some(
    (field) => field in metadata && metadata[field] !== undefined && metadata[field] !== null && metadata[field] !== ""
  );

  const updated = await prisma.document.update({
    where: { id },
    data: {
      metadata: merged,
      ...(hasEnrichmentFields && { enriched: true }),
    },
  });

  return NextResponse.json({ document: updated });
}

// POST /api/documents/[id]/enrich — Enriquecimiento individual con IA
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    return NextResponse.json(
      { error: "Documento no encontrado" },
      { status: 404 }
    );
  }

  // Obtener primeros 30 chunks
  const chunks = await prisma.chunk.findMany({
    where: { documentId: id },
    select: { content: true, pageNumber: true, chunkIndex: true },
    orderBy: { chunkIndex: "asc" },
    take: 30,
  });

  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "El documento no tiene chunks procesados" },
      { status: 400 }
    );
  }

  try {
    const enrichmentData = await enrichDocument(chunks, document.filename);

    // Merge con metadata existente
    const currentMetadata =
      typeof document.metadata === "object" && document.metadata !== null
        ? document.metadata
        : {};
    const merged = { ...(currentMetadata as Record<string, unknown>), ...enrichmentData };

    const updated = await prisma.document.update({
      where: { id },
      data: {
        metadata: merged,
        enriched: true,
      },
    });

    return NextResponse.json({ document: updated, enrichment: enrichmentData });
  } catch (error) {
    console.error(`Error enriching document ${id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al enriquecer documento" },
      { status: 500 }
    );
  }
}
