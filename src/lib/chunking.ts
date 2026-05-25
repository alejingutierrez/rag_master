import type { ParsedPage } from "./pdf-parser";

export interface ChunkConfig {
  /** Tamaño del chunk en PALABRAS (no caracteres) */
  chunkSize: number;
  /** Solapamiento en PALABRAS entre chunks consecutivos */
  chunkOverlap: number;
  /** Mantenido por compat. La implementación actual es siempre FIXED cross-page */
  strategy: "FIXED" | "PARAGRAPH" | "SENTENCE";
}

export interface TextChunk {
  content: string;
  /** Página donde INICIA el chunk (la primera palabra del chunk pertenece a esa página) */
  pageNumber: number;
  chunkIndex: number;
}

/**
 * Filtro de calidad para descartar basura:
 *  - chunks con menos de `minWords` palabras "reales" (con al menos 2 chars alfabéticos)
 *  - chunks con alta proporción de símbolos no alfanuméricos (OCR roto de imágenes/tablas)
 */
function isQualityContent(content: string, minWords = 50): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;

  const realWords = trimmed
    .split(/\s+/)
    .filter((w) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}/.test(w));
  if (realWords.length < minWords) return false;

  // Densidad de caracteres alfanuméricos vs no-espacio
  const nonSpace = trimmed.replace(/\s/g, "");
  if (nonSpace.length === 0) return false;
  const alpha = (nonSpace.match(/[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length;
  const alphaRatio = alpha / nonSpace.length;
  // Si menos del 60% son alfanuméricos, casi seguro es OCR roto / decoración
  if (alphaRatio < 0.6) return false;

  return true;
}

/**
 * Tokeniza todas las páginas en un único stream de palabras, manteniendo el mapeo
 * palabra → página de origen. Permite chunks que cruzan páginas sin perder el
 * pageNumber del inicio.
 */
function tokenizePages(pages: ParsedPage[]): { tokens: string[]; pageOf: number[] } {
  const tokens: string[] = [];
  const pageOf: number[] = [];
  for (const page of pages) {
    const words = page.text.split(/\s+/).filter(Boolean);
    for (const w of words) {
      tokens.push(w);
      pageOf.push(page.pageNumber);
    }
  }
  return { tokens, pageOf };
}

/**
 * Chunking principal: por palabras, atravesando páginas.
 *
 * - `chunkSize` y `chunkOverlap` se interpretan en PALABRAS.
 * - Devuelve chunks con `pageNumber` = página donde inicia el chunk.
 * - Filtra chunks de baja calidad (muy cortos o con ratio OCR-roto).
 */
export function chunkPages(pages: ParsedPage[], config: ChunkConfig): TextChunk[] {
  const { tokens, pageOf } = tokenizePages(pages);
  if (tokens.length === 0) return [];

  const chunkSize = Math.max(1, config.chunkSize);
  const overlap = Math.max(0, Math.min(config.chunkOverlap, chunkSize - 1));
  const stride = chunkSize - overlap;

  const chunks: TextChunk[] = [];
  let idx = 0;
  let pos = 0;

  while (pos < tokens.length) {
    const end = Math.min(pos + chunkSize, tokens.length);
    const slice = tokens.slice(pos, end);
    const content = slice.join(" ").trim();
    const pageNumber = pageOf[pos] ?? 1;

    if (isQualityContent(content)) {
      chunks.push({ content, pageNumber, chunkIndex: idx++ });
    }

    if (end >= tokens.length) break;
    pos += stride;
  }

  return chunks;
}
