export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParsedPDF {
  text: string;
  pageCount: number;
  pages: ParsedPage[];
}

export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("pdf-parse");
  // Turbopack puede envolver el export como ESM — manejar ambos casos
  const pdfParse = typeof mod === "function" ? mod : mod.default;
  const data = await pdfParse(buffer);

  const pages: ParsedPage[] = [];
  let currentPage = 1;

  // Dividir por form feeds (\f) que pdf-parse inserta entre páginas
  const rawPages = data.text.split("\f");

  for (const pageText of rawPages) {
    const trimmed = pageText.trim();
    if (trimmed) {
      pages.push({
        pageNumber: currentPage,
        text: trimmed,
      });
    }
    currentPage++;
  }

  // Si no se detectaron form feeds, usar todo como una sola página
  if (pages.length === 0 && data.text.trim()) {
    pages.push({ pageNumber: 1, text: data.text.trim() });
  }

  return {
    text: data.text,
    pageCount: data.numpages,
    pages,
  };
}
