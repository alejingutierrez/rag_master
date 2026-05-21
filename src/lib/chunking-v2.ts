/**
 * Chunker v2 — parent-child con preprocesamiento.
 *
 * Children: 400-600 chars, semánticos (oraciones), overlap 100.
 *           Se embeben y se buscan.
 *
 * Parents:  2000-3000 chars, agrupan 4-6 children consecutivos.
 *           NO se embeben. Se devuelven al LLM como contexto.
 *
 * Preprocesamiento:
 *  - Filtra páginas <100 chars útiles
 *  - Reconstruye OCR roto (espacios entre letras: "C e p e d a" → "Cepeda")
 *  - Antepone título del documento + título de capítulo detectado
 */
import type { ParsedPage } from "./pdf-parser";

export interface ChunkV2Config {
  childTargetSize: number;   // 500
  childMinSize: number;      // 150
  childMaxSize: number;      // 800
  childOverlap: number;      // 100
  parentTargetSize: number;  // 2500
  childrenPerParent: number; // 5 (target)
}

export const DEFAULT_CHUNK_V2_CONFIG: ChunkV2Config = {
  childTargetSize: 500,
  childMinSize: 150,
  childMaxSize: 800,
  childOverlap: 100,
  parentTargetSize: 2500,
  childrenPerParent: 5,
};

export interface ChildChunk {
  content: string;          // texto del child (lo que se embede y se busca)
  contextualContent: string; // texto del child + título doc + título capítulo (preprocesamiento)
  pageNumber: number;
  chunkIndex: number;        // índice global
  parentIndex: number;       // índice del parent al que pertenece
  chapterTitle?: string;     // título del capítulo detectado
}

export interface ParentChunk {
  content: string;
  pageStart: number;
  pageEnd: number;
  parentIndex: number;
  childIndices: number[];
}

export interface ChunkResultV2 {
  children: ChildChunk[];
  parents: ParentChunk[];
  stats: {
    pagesProcessed: number;
    pagesSkipped: number;
    pagesSkippedReasons: Record<string, number>;
    avgChildSize: number;
    avgParentSize: number;
    ocrReconstructions: number;
  };
}

// ─── Filtros de basura ───────────────────────────────────────────────

/**
 * Detecta páginas que probablemente no aportan información útil:
 * portadas, copyright, índices alfabéticos puros, listas de figuras,
 * bibliografías sin contexto, páginas en blanco, etc.
 */
function isJunkPage(text: string): { junk: boolean; reason?: string } {
  const len = text.length;
  if (len < 100) return { junk: true, reason: "page_too_short" };

  // Detectar índice alfabético (líneas con letras grandes "A B C")
  const indexAlphaPattern = /(?:^|\n)\s*[A-Z]\s*(?:\n|$)/gm;
  const indexMatches = (text.match(indexAlphaPattern) || []).length;
  if (indexMatches >= 5) return { junk: true, reason: "alphabetical_index" };

  // Detectar tabla de contenidos pura (muchas líneas terminando en números)
  const tocLineCount = (text.match(/[^\n]+\.{3,}\s*\d+\s*(?:\n|$)/g) || []).length;
  if (tocLineCount >= 8) return { junk: true, reason: "table_of_contents" };

  // Detectar página con copyright/ISBN dominante
  if (/ISBN\s*[:\-]/i.test(text) && len < 500) return { junk: true, reason: "copyright_page" };

  // Detectar página con altísima densidad de caracteres no-alfabéticos (probablemente OCR fallido total)
  const alphaChars = (text.match(/[a-záéíóúñA-ZÁÉÍÓÚÑ]/g) || []).length;
  if (alphaChars / len < 0.5) return { junk: true, reason: "low_alpha_density" };

  return { junk: false };
}

/**
 * Reconstruye palabras rotas por OCR.
 * "I v á n C e p e d a" → "Iván Cepeda"
 * "M anuel" → "Manuel"
 */
function reconstructOCR(text: string): { fixed: string; count: number } {
  let count = 0;

  // Caso 1: una sola letra rodeada de espacios (>=3 letras consecutivas así → es OCR roto)
  // "M a n u e l" → "Manuel"
  const fixed = text.replace(
    /\b([A-Za-záéíóúñÁÉÍÓÚÑ])(?:\s+([A-Za-záéíóúñÁÉÍÓÚÑ])){2,}\b/g,
    (match) => {
      count++;
      return match.replace(/\s+/g, "");
    }
  );

  return { fixed, count };
}

/**
 * Intenta detectar el título de capítulo de una página.
 * Heurísticas: línea corta, mayúsculas, palabras como "CAPÍTULO", "INTRODUCCIÓN".
 */
function detectChapterTitle(text: string): string | undefined {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (line.length < 80 && line.length > 5) {
      if (/^(CAPÍTULO|CAPITULO|INTRODUCCIÓN|INTRODUCCION|CONCLUSIONES?|PARTE|TOMO|LIBRO|APÉNDICE)\b/i.test(line)) {
        return line;
      }
      // Línea casi toda en mayúsculas (>70% upper) y corta
      const upperRatio = (line.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length / line.length;
      if (upperRatio >= 0.7 && line.length >= 10 && line.length <= 60) {
        return line;
      }
    }
  }
  return undefined;
}

// ─── Splitter semántico ──────────────────────────────────────────────

/**
 * Divide texto en oraciones respetando puntos, signos de interrogación, exclamación.
 * No corta abreviaturas comunes en español.
 */
function splitSentences(text: string): string[] {
  // Proteger abreviaturas
  const protectedText = text
    .replace(/\b(Sr|Sra|Dr|Dra|St|Sto|Sta|Lic|Ing|Prof|Mr|Mrs|Ms|Jr|Sr|p|pp|fig|cap|vol|nro|núm|etc|ej|i\.e|e\.g)\./gi, "$1<DOT>")
    .replace(/(\d+)\.(\d+)/g, "$1<DOT>$2") // decimales
    .replace(/(\d+)\.\s/g, "$1<DOT> ");    // listas numeradas

  const sentences = protectedText
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¡¿])/g)
    .map((s) => s.replace(/<DOT>/g, ".").trim())
    .filter((s) => s.length > 0);

  return sentences;
}

// ─── Chunker principal ───────────────────────────────────────────────

export function chunkPagesV2(
  pages: ParsedPage[],
  documentTitle: string,
  config: ChunkV2Config = DEFAULT_CHUNK_V2_CONFIG
): ChunkResultV2 {
  const children: ChildChunk[] = [];
  const parents: ParentChunk[] = [];

  let globalChildIdx = 0;
  let parentIdx = 0;
  let pendingChildren: ChildChunk[] = []; // Children aún no asignados a un parent
  let pendingParentSize = 0;

  let currentChapter: string | undefined;
  let ocrFixCount = 0;
  let pagesProcessed = 0;
  let pagesSkipped = 0;
  const skipReasons: Record<string, number> = {};

  function flushParent(pageEnd: number) {
    if (pendingChildren.length === 0) return;
    const content = pendingChildren.map((c) => c.content).join(" ");
    parents.push({
      content,
      pageStart: pendingChildren[0].pageNumber,
      pageEnd,
      parentIndex: parentIdx,
      childIndices: pendingChildren.map((c) => c.chunkIndex),
    });
    parentIdx++;
    pendingChildren = [];
    pendingParentSize = 0;
  }

  for (const page of pages) {
    const { fixed: text, count: ocrCount } = reconstructOCR(page.text);
    ocrFixCount += ocrCount;

    const { junk, reason } = isJunkPage(text);
    if (junk) {
      pagesSkipped++;
      skipReasons[reason || "unknown"] = (skipReasons[reason || "unknown"] || 0) + 1;
      continue;
    }
    pagesProcessed++;

    // Detectar título de capítulo si la página tiene uno claro
    const detected = detectChapterTitle(text);
    if (detected) currentChapter = detected;

    // Split en oraciones, luego agrupar en children del tamaño objetivo
    const sentences = splitSentences(text);
    let buffer = "";

    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i];

      // Si añadir esta oración excedería childMaxSize → flush
      if (buffer && buffer.length + s.length + 1 > config.childMaxSize) {
        if (buffer.length >= config.childMinSize) {
          // Crear child
          const contextualPrefix = [
            documentTitle ? `[Doc: ${documentTitle.substring(0, 80)}]` : "",
            currentChapter ? `[Cap: ${currentChapter.substring(0, 80)}]` : "",
          ].filter(Boolean).join(" ");

          const child: ChildChunk = {
            content: buffer.trim(),
            contextualContent: contextualPrefix
              ? `${contextualPrefix}\n${buffer.trim()}`
              : buffer.trim(),
            pageNumber: page.pageNumber,
            chunkIndex: globalChildIdx++,
            parentIndex: parentIdx,
            chapterTitle: currentChapter,
          };
          children.push(child);
          pendingChildren.push(child);
          pendingParentSize += child.content.length;

          if (pendingParentSize >= config.parentTargetSize ||
              pendingChildren.length >= config.childrenPerParent) {
            flushParent(page.pageNumber);
          }

          // Overlap: deja las últimas N chars del buffer en el siguiente child
          if (config.childOverlap > 0 && buffer.length > config.childOverlap) {
            buffer = buffer.slice(-config.childOverlap) + " " + s;
          } else {
            buffer = s;
          }
        } else {
          // Buffer muy chico, anexamos igual
          buffer += " " + s;
        }
      } else {
        buffer = buffer ? buffer + " " + s : s;
      }

      // Si una oración sola excede childMaxSize, cortar a la fuerza
      if (buffer.length > config.childMaxSize * 1.5) {
        const contextualPrefix = [
          documentTitle ? `[Doc: ${documentTitle.substring(0, 80)}]` : "",
          currentChapter ? `[Cap: ${currentChapter.substring(0, 80)}]` : "",
        ].filter(Boolean).join(" ");

        const child: ChildChunk = {
          content: buffer.slice(0, config.childMaxSize).trim(),
          contextualContent: contextualPrefix
            ? `${contextualPrefix}\n${buffer.slice(0, config.childMaxSize).trim()}`
            : buffer.slice(0, config.childMaxSize).trim(),
          pageNumber: page.pageNumber,
          chunkIndex: globalChildIdx++,
          parentIndex: parentIdx,
          chapterTitle: currentChapter,
        };
        children.push(child);
        pendingChildren.push(child);
        pendingParentSize += child.content.length;

        if (pendingParentSize >= config.parentTargetSize ||
            pendingChildren.length >= config.childrenPerParent) {
          flushParent(page.pageNumber);
        }

        buffer = buffer.slice(config.childMaxSize - config.childOverlap);
      }
    }

    // Flush al final de página si buffer es razonable
    if (buffer.length >= config.childMinSize) {
      const contextualPrefix = [
        documentTitle ? `[Doc: ${documentTitle.substring(0, 80)}]` : "",
        currentChapter ? `[Cap: ${currentChapter.substring(0, 80)}]` : "",
      ].filter(Boolean).join(" ");

      const child: ChildChunk = {
        content: buffer.trim(),
        contextualContent: contextualPrefix
          ? `${contextualPrefix}\n${buffer.trim()}`
          : buffer.trim(),
        pageNumber: page.pageNumber,
        chunkIndex: globalChildIdx++,
        parentIndex: parentIdx,
        chapterTitle: currentChapter,
      };
      children.push(child);
      pendingChildren.push(child);
      pendingParentSize += child.content.length;
    }

    if (pendingParentSize >= config.parentTargetSize ||
        pendingChildren.length >= config.childrenPerParent) {
      flushParent(page.pageNumber);
    }
  }

  // Flush final
  if (pendingChildren.length > 0) {
    flushParent(pages[pages.length - 1]?.pageNumber ?? 0);
  }

  const avgChildSize = children.length > 0
    ? children.reduce((a, c) => a + c.content.length, 0) / children.length
    : 0;
  const avgParentSize = parents.length > 0
    ? parents.reduce((a, p) => a + p.content.length, 0) / parents.length
    : 0;

  return {
    children,
    parents,
    stats: {
      pagesProcessed,
      pagesSkipped,
      pagesSkippedReasons: skipReasons,
      avgChildSize,
      avgParentSize,
      ocrReconstructions: ocrFixCount,
    },
  };
}
