// ─── Tipos de enriquecimiento bibliográfico ──────────────────────────────────

export interface EnrichmentMetadata {
  bookTitle?: string;
  author?: string;
  isbn?: string;
  pageCount?: number;
  summary?: string;
  primaryPeriod?: string;
  secondaryPeriod?: string;
  primaryCategory?: string;
  secondaryCategory?: string;
  publisher?: string;
  publicationYear?: number;
  edition?: string;
  keywords?: string[];
}

/**
 * Retorna el nombre de visualización de un documento:
 * bookTitle si fue enriquecido, filename como fallback.
 */
export function getDocumentDisplayName(
  doc: { filename: string; metadata?: Record<string, unknown> | null }
): string {
  if (!doc.metadata || typeof doc.metadata !== "object") return doc.filename;
  const meta = doc.metadata as EnrichmentMetadata;
  return meta.bookTitle || doc.filename;
}
