/**
 * Rebalanceo por diversidad de fuentes. Pura (testeable sin red).
 *
 * Problema: la fusión RRF (rag-pipeline.ts, deep-research/route.ts) ordena solo
 * por score, sin tope por documento. Con autores de corpus grande (CNMH, Comisión
 * de la Verdad) el top-N puede venir de 2-3 documentos → "cruzar fuentes" falla en
 * silencio. Solución: round-robin por documento con cap, preservando el ranking
 * dentro de cada documento. El #1 de cada documento entra antes que el #7 del
 * documento dominante.
 */
import type { SearchResult } from "../vector-search";

function docKey(c: SearchResult): string {
  return c.documentId || c.documentFilename || c.id;
}

export interface RebalanceOptions {
  targetSize?: number; // tope total (default 80)
  capPerDoc?: number; // máximo de chunks por documento (default 6)
}

export function rebalanceByDiversity(
  fused: SearchResult[],
  opts: RebalanceOptions = {}
): SearchResult[] {
  const targetSize = opts.targetSize ?? 80;
  const capPerDoc = opts.capPerDoc ?? 6;
  if (fused.length === 0) return [];

  // Agrupar por documento preservando el orden de entrada (= orden RRF).
  // Map preserva orden de inserción → el documento cuyo mejor chunk aparece
  // primero queda primero en el round-robin.
  const buckets = new Map<string, SearchResult[]>();
  for (const c of fused) {
    const key = docKey(c);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(c);
    else buckets.set(key, [c]);
  }

  const docKeys = Array.from(buckets.keys());
  const result: SearchResult[] = [];
  for (let round = 0; round < capPerDoc; round++) {
    for (const key of docKeys) {
      const bucket = buckets.get(key)!;
      if (round < bucket.length) {
        result.push(bucket[round]);
        if (result.length >= targetSize) return result;
      }
    }
  }
  return result;
}

export function countUniqueDocuments(chunks: SearchResult[]): number {
  const set = new Set<string>();
  for (const c of chunks) set.add(docKey(c));
  return set.size;
}
