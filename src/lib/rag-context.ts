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

/**
 * Empaqueta los chunks como un bloque numerado `[N] (archivo, p.X)\n<texto>`
 * para inyectar en el system prompt. Trunca por chunk y por total para no
 * exceder el presupuesto de contexto.
 */
export function buildContextBlock(chunks: SearchResult[]): string {
  let totalChars = 0;
  const parts: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const truncated =
      c.content.length > MAX_CHUNK_CHARS
        ? c.content.slice(0, MAX_CHUNK_CHARS) + "..."
        : c.content;
    const part = `[${i + 1}] (${c.documentFilename}, p.${c.pageNumber})\n${truncated}`;

    if (totalChars + part.length > MAX_CONTEXT_CHARS) break;
    parts.push(part);
    totalChars += part.length;
  }

  return parts.join("\n\n---\n\n");
}

// Sección APA al final (la inyecta el chat cuando el template lo pide).
export { buildReferencesSection } from "./apa-citations";
