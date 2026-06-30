import type { SearchResult } from "./vector-search";

// ─────────────────────────────────────────────────────────────────────────────
// Infraestructura compartida de contexto RAG.
//
// Estas funciones NO son específicas de los "templates" del chat: las usan el
// chat, el Taller (triangulación, relevancia) y deep-research. Viven aquí, en un
// módulo neutro, para que la eliminación del sistema legacy de templates (Fase 4)
// no rompa el motor del Taller. Ver [[project_consolidation_two_surfaces]].
// ─────────────────────────────────────────────────────────────────────────────

// Opus 4.7 soporta hasta 1M tokens (~3-4M chars). 400K chars ≈ 100K tokens (1/10 del límite).
const MAX_CONTEXT_CHARS = 400_000;
const MAX_CHUNK_CHARS = 3500;

export interface ContextBlockOpts {
  /** Tope de caracteres por chunk (default 3500). Bájalo para que entren más
   *  fragmentos cuando solo necesitas el TEMA de cada uno (p. ej. agrupar en
   *  núcleos un pool grande), no su texto íntegro. */
  maxChunkChars?: number;
  /** Tope total de caracteres del bloque (default 400K ≈ 100K tokens). */
  maxContextChars?: number;
}

/**
 * Empaqueta los chunks como un bloque numerado `[N] (archivo, p.X)\n<texto>`
 * para inyectar en el system prompt. Trunca por chunk y por total para no
 * exceder el presupuesto de contexto.
 */
export function buildContextBlock(chunks: SearchResult[], opts?: ContextBlockOpts): string {
  const maxChunkChars = opts?.maxChunkChars ?? MAX_CHUNK_CHARS;
  const maxContextChars = opts?.maxContextChars ?? MAX_CONTEXT_CHARS;
  let totalChars = 0;
  const parts: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const truncated =
      c.content.length > maxChunkChars
        ? c.content.slice(0, maxChunkChars) + "..."
        : c.content;
    const part = `[${i + 1}] (${c.documentFilename}, p.${c.pageNumber})\n${truncated}`;

    if (totalChars + part.length > maxContextChars) break;
    parts.push(part);
    totalChars += part.length;
  }

  return parts.join("\n\n---\n\n");
}

// Sección APA al final (la inyecta el chat cuando el template lo pide).
export { buildReferencesSection } from "./apa-citations";
