import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTemplateById } from "@/lib/chat-templates";

// GET /api/deliverables/[id]/export?format=md|docx|pdf
// Devuelve el entregable como archivo descargable.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const format = (new URL(request.url)).searchParams.get("format") || "md";

  if (!["md", "docx", "pdf"].includes(format)) {
    return NextResponse.json({ error: "Formato inválido (md|docx|pdf)" }, { status: 400 });
  }

  const deliverable = await prisma.deliverable.findUnique({
    where: { id },
    include: {
      question: {
        select: {
          pregunta: true,
          periodoNombre: true,
          categoriaNombre: true,
          document: { select: { filename: true } },
        },
      },
    },
  });

  if (!deliverable) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const template = getTemplateById(deliverable.templateId);
  const questionText = deliverable.question?.pregunta || deliverable.userQuestion || "(sin pregunta)";
  const title = extractTitle(deliverable.answer) || questionText.slice(0, 80);
  const filename = `${slugify(title)}.${format}`;

  if (format === "md") {
    const md = buildMarkdown({
      title,
      questionText,
      templateName: template?.name,
      answer: deliverable.answer,
      createdAt: deliverable.createdAt,
    });
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (format === "docx") {
    const buffer = await buildDocx({
      title,
      questionText,
      templateName: template?.name,
      answer: deliverable.answer,
      createdAt: deliverable.createdAt,
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // pdf
  const buffer = await buildPdf({
    title,
    questionText,
    templateName: template?.name,
    answer: deliverable.answer,
    createdAt: deliverable.createdAt,
  });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

interface ExportInput {
  title: string;
  questionText: string;
  templateName?: string;
  answer: string;
  createdAt: Date;
}

function extractTitle(answer: string): string | null {
  const m = answer.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "produccion";
}

function buildMarkdown({ title, questionText, templateName, answer, createdAt }: ExportInput): string {
  const date = createdAt.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });
  return [
    `<!-- ${templateName || "Producción"} · ${date} -->`,
    `<!-- Pregunta: ${questionText} -->`,
    ``,
    answer,
  ].join("\n");
}

async function buildDocx({ title, questionText, templateName, answer, createdAt }: ExportInput): Promise<Buffer> {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } = await import("docx");

  const date = createdAt.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });

  // Parsear markdown muy simple: # H1, ## H2, párrafos
  const lines = answer.split("\n");
  const docParagraphs: InstanceType<typeof Paragraph>[] = [];

  // Header con metadata
  docParagraphs.push(
    new Paragraph({
      text: questionText,
      heading: HeadingLevel.HEADING_3,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `${templateName || "Producción"} · ${date}`, italics: true, color: "888888", size: 18 }),
      ],
      spacing: { after: 400 },
    })
  );

  let i = 0;
  let currentParagraph: string[] = [];
  const flushParagraph = () => {
    if (currentParagraph.length === 0) return;
    const text = currentParagraph.join(" ").trim();
    if (text) {
      docParagraphs.push(
        new Paragraph({
          children: parseInlineMarkdown(text),
          spacing: { after: 200, line: 360 },
          alignment: AlignmentType.JUSTIFIED,
        })
      );
    }
    currentParagraph = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("# ")) {
      flushParagraph();
      docParagraphs.push(
        new Paragraph({
          text: trimmed.substring(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 200 },
        })
      );
    } else if (trimmed.startsWith("## ")) {
      flushParagraph();
      docParagraphs.push(
        new Paragraph({
          text: trimmed.substring(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
    } else if (trimmed === "---") {
      flushParagraph();
      docParagraphs.push(new Paragraph({ text: "", border: { bottom: { color: "AAAAAA", style: "single", size: 6 } } }));
    } else if (trimmed === "") {
      flushParagraph();
    } else {
      currentParagraph.push(trimmed);
    }
    i++;
  }
  flushParagraph();

  const doc = new Document({
    creator: "RAG Master",
    title,
    sections: [{ properties: {}, children: docParagraphs }],
  });

  return await Packer.toBuffer(doc);
}

function parseInlineMarkdown(text: string): InstanceType<typeof import("docx").TextRun>[] {
  // Manejo simple de **bold** y *italic*
  const { TextRun } = require("docx") as typeof import("docx");
  const parts: InstanceType<typeof TextRun>[] = [];
  // Tokenizer simple
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  for (const tok of tokens) {
    if (!tok) continue;
    if (tok.startsWith("**") && tok.endsWith("**")) {
      parts.push(new TextRun({ text: tok.slice(2, -2), bold: true }));
    } else if (tok.startsWith("*") && tok.endsWith("*") && tok.length > 2) {
      parts.push(new TextRun({ text: tok.slice(1, -1), italics: true }));
    } else {
      parts.push(new TextRun({ text: tok }));
    }
  }
  return parts;
}

async function buildPdf({ title, questionText, templateName, answer, createdAt }: ExportInput): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  const date = createdAt.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 60, left: 70, right: 70 },
      info: { Title: title, Author: "RAG Master" },
    });

    const buffers: Buffer[] = [];
    doc.on("data", (b) => buffers.push(b));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Header
    doc.fontSize(10).fillColor("#666666").text(`${templateName || "Producción"} · ${date}`, { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#444444").text(questionText, { align: "left" });
    doc.moveDown(1);
    doc.moveTo(70, doc.y).lineTo(525, doc.y).strokeColor("#cccccc").stroke();
    doc.moveDown(1);

    // Body — parsear markdown muy simple
    const lines = answer.split("\n");
    let i = 0;
    let para: string[] = [];
    const flushPara = () => {
      if (para.length === 0) return;
      const text = para.join(" ").trim();
      if (text) {
        doc.fontSize(11).fillColor("#222222").text(stripMd(text), {
          align: "justify",
          paragraphGap: 8,
          lineGap: 3,
        });
      }
      para = [];
    };

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith("# ")) {
        flushPara();
        doc.moveDown(0.5);
        doc.fontSize(18).fillColor("#111111").text(trimmed.substring(2), { paragraphGap: 12 });
      } else if (trimmed.startsWith("## ")) {
        flushPara();
        doc.moveDown(0.3);
        doc.fontSize(14).fillColor("#111111").text(trimmed.substring(3), { paragraphGap: 8 });
      } else if (trimmed === "---") {
        flushPara();
        doc.moveDown(0.5);
        doc.moveTo(70, doc.y).lineTo(525, doc.y).strokeColor("#cccccc").stroke();
        doc.moveDown(0.5);
      } else if (trimmed === "") {
        flushPara();
      } else {
        para.push(trimmed);
      }
      i++;
    }
    flushPara();

    doc.end();
  });
}

function stripMd(s: string): string {
  // Para PDF, removemos marcadores de bold/italic ya que pdfkit no soporta inline rich
  // (en una v2 podríamos usar doc.text con runs separados).
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1");
}
