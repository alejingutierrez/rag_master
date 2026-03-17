import type { ParsedPage } from "./pdf-parser";

export interface ChunkConfig {
  chunkSize: number;     // caracteres por chunk
  chunkOverlap: number;  // caracteres de solapamiento
  strategy: "FIXED" | "PARAGRAPH" | "SENTENCE";
}

export interface TextChunk {
  content: string;
  pageNumber: number;
  chunkIndex: number;
}

/**
 * Estrategia FIXED: divide el texto en chunks de tamaño fijo con overlap
 */
function chunkFixed(text: string, pageNumber: number, config: ChunkConfig, startIndex: number): TextChunk[] {
  const chunks: TextChunk[] = [];
  const { chunkSize, chunkOverlap } = config;
  let pos = 0;
  let idx = startIndex;

  while (pos < text.length) {
    const end = Math.min(pos + chunkSize, text.length);
    const content = text.slice(pos, end).trim();
    if (content) {
      chunks.push({ content, pageNumber, chunkIndex: idx++ });
    }
    pos += chunkSize - chunkOverlap;
    if (pos >= text.length) break;
  }

  return chunks;
}

/**
 * Estrategia PARAGRAPH: divide por párrafos, fusiona párrafos pequeños
 */
function chunkByParagraph(text: string, pageNumber: number, config: ChunkConfig, startIndex: number): TextChunk[] {
  const chunks: TextChunk[] = [];
  const { chunkSize } = config;
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  let idx = startIndex;
  let buffer = "";

  for (const para of paragraphs) {
    if (buffer.length + para.length + 1 > chunkSize && buffer) {
      chunks.push({ content: buffer.trim(), pageNumber, chunkIndex: idx++ });
      buffer = "";
    }

    // Si un solo párrafo excede el tamaño, dividirlo con fixed
    if (para.length > chunkSize) {
      if (buffer) {
        chunks.push({ content: buffer.trim(), pageNumber, chunkIndex: idx++ });
        buffer = "";
      }
      const subChunks = chunkFixed(para, pageNumber, config, idx);
      for (const sc of subChunks) {
        sc.chunkIndex = idx++;
        chunks.push(sc);
      }
    } else {
      buffer += (buffer ? "\n\n" : "") + para;
    }
  }

  if (buffer.trim()) {
    chunks.push({ content: buffer.trim(), pageNumber, chunkIndex: idx++ });
  }

  return chunks;
}

/**
 * Estrategia SENTENCE: divide por oraciones, agrupa hasta alcanzar tamaño objetivo
 */
function chunkBySentence(text: string, pageNumber: number, config: ChunkConfig, startIndex: number): TextChunk[] {
  const chunks: TextChunk[] = [];
  const { chunkSize, chunkOverlap } = config;

  // Dividir por oraciones (punto, signo de interrogación, exclamación seguido de espacio o fin)
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  let idx = startIndex;
  let buffer = "";
  let overlapBuffer: string[] = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (buffer.length + trimmed.length + 1 > chunkSize && buffer) {
      chunks.push({ content: buffer.trim(), pageNumber, chunkIndex: idx++ });

      // Calcular overlap: tomar últimas oraciones que quepan en overlap
      buffer = "";
      let overlapSize = 0;
      const overlapParts: string[] = [];
      for (let i = overlapBuffer.length - 1; i >= 0; i--) {
        if (overlapSize + overlapBuffer[i].length > chunkOverlap) break;
        overlapParts.unshift(overlapBuffer[i]);
        overlapSize += overlapBuffer[i].length;
      }
      buffer = overlapParts.join(" ");
      overlapBuffer = [...overlapParts];
    }

    buffer += (buffer ? " " : "") + trimmed;
    overlapBuffer.push(trimmed);
  }

  if (buffer.trim()) {
    chunks.push({ content: buffer.trim(), pageNumber, chunkIndex: idx++ });
  }

  return chunks;
}

/**
 * Función principal de chunking: procesa páginas del PDF según la estrategia configurada
 */
export function chunkPages(pages: ParsedPage[], config: ChunkConfig): TextChunk[] {
  const allChunks: TextChunk[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    let pageChunks: TextChunk[];

    switch (config.strategy) {
      case "PARAGRAPH":
        pageChunks = chunkByParagraph(page.text, page.pageNumber, config, globalIndex);
        break;
      case "SENTENCE":
        pageChunks = chunkBySentence(page.text, page.pageNumber, config, globalIndex);
        break;
      case "FIXED":
      default:
        pageChunks = chunkFixed(page.text, page.pageNumber, config, globalIndex);
        break;
    }

    allChunks.push(...pageChunks);
    globalIndex = allChunks.length;
  }

  return allChunks;
}
