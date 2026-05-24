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
