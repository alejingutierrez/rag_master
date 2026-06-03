/**
 * Resuelve la taxonomía (periodoCode, categoriaCode, documentId principal) de
 * un Deliverable.
 *
 * Para batch: viene del Question asociado (directo).
 * Para chat: derivado del documento más frecuente en chunksUsed → su metadata.
 */

import type { EnrichmentMetadata } from "./enrichment-types";

export interface ResolvedTaxonomy {
  periodoCode?: string;
  categoriaCode?: string;
  documentId?: string;
}

interface DeliverableForResolve {
  questionId?: string | null;
  question?: { periodoCode: string; categoriaCode: string; documentId: string } | null;
  chunksUsed?: unknown;
  metadata?: unknown;
}

/** Lee la taxonomía construida por el Taller en metadata.atelier.taxonomy. */
function extractAtelierTaxonomy(metadata: unknown): ResolvedTaxonomy | null {
  if (!metadata || typeof metadata !== "object") return null;
  const atelier = (metadata as Record<string, unknown>).atelier;
  if (!atelier || typeof atelier !== "object") return null;
  const tax = (atelier as Record<string, unknown>).taxonomy;
  if (!tax || typeof tax !== "object") return null;
  const t = tax as Record<string, unknown>;
  const periodoCode = typeof t.periodoCode === "string" ? t.periodoCode : undefined;
  const categoriaCode = typeof t.categoriaCode === "string" ? t.categoriaCode : undefined;
  if (!periodoCode && !categoriaCode) return null;
  return { periodoCode, categoriaCode };
}

interface DocLookup {
  id: string;
  metadata: unknown;
}

/**
 * Si el deliverable es batch (tiene question), usa esos códigos.
 * Si es chat (sin question), busca el documentId más frecuente en chunksUsed
 * y devuelve los códigos del metadata de ese documento.
 *
 * Pasa un `docMap` (id → doc) precargado para evitar N+1 queries.
 */
export function resolveDeliverableTaxonomy(
  d: DeliverableForResolve,
  docMap: Map<string, DocLookup>,
): ResolvedTaxonomy {
  if (d.question) {
    return {
      periodoCode: d.question.periodoCode,
      categoriaCode: d.question.categoriaCode,
      documentId: d.question.documentId,
    };
  }

  // Entregables del Taller sin pregunta: taxonomía construida en metadata.
  const atelierTax = extractAtelierTaxonomy(d.metadata);
  if (atelierTax) return atelierTax;

  const chunks = Array.isArray(d.chunksUsed)
    ? (d.chunksUsed as Array<{ documentId?: string; documentFilename?: string }>)
    : [];

  if (chunks.length === 0) return {};

  // Contar documentIds (o fallback a filename si no hay id)
  const counts = new Map<string, number>();
  for (const c of chunks) {
    const key = c.documentId;
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return {};

  // Documento más frecuente
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const topDocId = sorted[0][0];

  const doc = docMap.get(topDocId);
  if (!doc) return { documentId: topDocId };

  const meta = (doc.metadata ?? {}) as EnrichmentMetadata;
  return {
    documentId: topDocId,
    periodoCode: meta.primaryPeriod,
    categoriaCode: meta.primaryCategory,
  };
}
