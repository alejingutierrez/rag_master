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
  // Polyfills de seguridad para Lambda (instrumentation.ts los pone primero,
  // pero si el orden de carga varía, esto los cubre)
  if (typeof globalThis.DOMMatrix === "undefined") {
    // @ts-expect-error polyfill mínimo
    globalThis.DOMMatrix = class DOMMatrix {
      constructor() { return Object.create(null); }
    };
  }
  if (typeof globalThis.Path2D === "undefined") {
    // @ts-expect-error polyfill mínimo
    globalThis.Path2D = class Path2D {};
  }

  // pdf-parse v2 exporta una clase PDFParse, no una función
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require("pdf-parse");

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  await parser.load();

  const numPages = parser.doc.numPages;
  const pages: ParsedPage[] = [];
  const textParts: string[] = [];

  // Extraer texto página por página usando pdfjs-dist API directamente
  for (let i = 1; i <= numPages; i++) {
    const page = await parser.doc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .filter((item: { str?: string }) => "str" in item)
      .map((item: { str: string }) => item.str)
      .join(" ")
      .trim();

    if (text) {
      pages.push({ pageNumber: i, text });
      textParts.push(text);
    }
  }

  parser.destroy();

  return {
    text: textParts.join("\n\n"),
    pageCount: numPages,
    pages,
  };
}
