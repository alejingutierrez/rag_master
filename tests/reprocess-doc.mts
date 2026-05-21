/**
 * Reprocesa el documento existente con la nueva configuración mejorada:
 * - Texto normalizado (sin espacios múltiples)
 * - Chunks más pequeños (512 chars, overlap 64)
 * - Estrategia PARAGRAPH
 * - Embeddings en paralelo (5 concurrentes)
 */
import { PrismaClient } from "@prisma/client";
import {
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const prisma = new PrismaClient();
const s3 = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const bedrock = new BedrockRuntimeClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.S3_BUCKET_NAME || "rag-master-pdfs";
const EMBEDDING_MODEL = "amazon.titan-embed-text-v2:0";

function normalizeText(raw: string): string {
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ +([.,;:!?)])/g, "$1")
    .replace(/([([]) +/g, "$1")
    .replace(/\n +/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function generateEmbedding(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: EMBEDDING_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({ inputText: text.substring(0, 8000), dimensions: 1024, normalize: true }),
  });
  const response = await bedrock.send(command);
  return JSON.parse(new TextDecoder().decode(response.body)).embedding;
}

interface TextChunk {
  content: string;
  pageNumber: number;
  chunkIndex: number;
}

function chunkByParagraph(
  pages: { pageNumber: number; text: string }[],
  chunkSize: number,
  overlap: number,
): TextChunk[] {
  const allChunks: TextChunk[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    const paragraphs = page.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    let buffer = "";

    for (const para of paragraphs) {
      if (buffer.length + para.length + 1 > chunkSize && buffer) {
        allChunks.push({ content: buffer.trim(), pageNumber: page.pageNumber, chunkIndex: globalIndex++ });
        // Keep overlap
        const words = buffer.split(" ");
        const overlapWords = [];
        let overlapLen = 0;
        for (let i = words.length - 1; i >= 0 && overlapLen < overlap; i--) {
          overlapWords.unshift(words[i]);
          overlapLen += words[i].length + 1;
        }
        buffer = overlapWords.join(" ");
      }

      if (para.length > chunkSize) {
        if (buffer) {
          allChunks.push({ content: buffer.trim(), pageNumber: page.pageNumber, chunkIndex: globalIndex++ });
          buffer = "";
        }
        // Split large paragraph into fixed chunks
        let pos = 0;
        while (pos < para.length) {
          const end = Math.min(pos + chunkSize, para.length);
          const content = para.slice(pos, end).trim();
          if (content) allChunks.push({ content, pageNumber: page.pageNumber, chunkIndex: globalIndex++ });
          pos += chunkSize - overlap;
          if (pos >= para.length) break;
        }
      } else {
        buffer += (buffer ? "\n\n" : "") + para;
      }
    }

    if (buffer.trim()) {
      allChunks.push({ content: buffer.trim(), pageNumber: page.pageNumber, chunkIndex: globalIndex++ });
    }
  }

  return allChunks;
}

async function main() {
  // Find the document
  const doc = await prisma.document.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!doc) {
    console.error("No documents found");
    process.exit(1);
  }
  console.log(`\n📄 Document: ${doc.filename} (${doc.pageCount} pages, status: ${doc.status})`);
  console.log(`   S3 Key: ${doc.s3Key}`);

  // Mark as processing
  await prisma.document.update({ where: { id: doc.id }, data: { status: "PROCESSING" } });

  // Delete old chunks
  const deleted = await prisma.chunk.deleteMany({ where: { documentId: doc.id } });
  console.log(`🗑️  Deleted ${deleted.count} old chunks`);

  // Download from S3
  console.log("⬇️  Downloading PDF from S3...");
  const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: doc.s3Key }));
  const s3chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    s3chunks.push(chunk);
  }
  const buffer = Buffer.concat(s3chunks);
  console.log(`   Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

  // Parse PDF
  console.log("📖 Parsing PDF...");
  if (typeof globalThis.DOMMatrix === "undefined") {
    (globalThis as any).DOMMatrix = class DOMMatrix { constructor() { return Object.create(null); } };
  }
  if (typeof globalThis.Path2D === "undefined") {
    (globalThis as any).Path2D = class Path2D {};
  }
  const mod = await import("pdf-parse");
  const PDFParse = (mod as any).PDFParse || (mod as any).default?.PDFParse;
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  await parser.load();

  const numPages = parser.doc.numPages;
  const pages: { pageNumber: number; text: string }[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await parser.doc.getPage(i);
    const textContent = await page.getTextContent();
    const rawText = textContent.items
      .filter((item: { str?: string }) => "str" in item)
      .map((item: { str: string }) => item.str)
      .join(" ")
      .trim();
    const text = normalizeText(rawText);
    if (text && text.length > 10) {
      pages.push({ pageNumber: i, text });
    }
    if (i % 50 === 0) console.log(`   Parsed ${i}/${numPages} pages...`);
  }
  parser.destroy();
  console.log(`   ✅ ${pages.length} pages with text (of ${numPages} total)`);

  // Update page count
  await prisma.document.update({ where: { id: doc.id }, data: { pageCount: numPages } });

  // Chunk with PARAGRAPH strategy
  console.log("📦 Chunking with PARAGRAPH strategy (512/64)...");
  const chunks = chunkByParagraph(pages, 512, 64);
  console.log(`   ✅ ${chunks.length} chunks generated`);

  // Save chunks to DB (fast)
  console.log("💾 Saving chunks to DB...");
  const dbChunks: { id: string; chunkIndex: number }[] = [];
  for (const chunk of chunks) {
    const dbChunk = await prisma.chunk.create({
      data: {
        documentId: doc.id,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        chunkSize: 512,
        overlap: 64,
        strategy: "PARAGRAPH",
        metadata: { sourceFile: doc.filename },
      },
    });
    dbChunks.push({ id: dbChunk.id, chunkIndex: dbChunk.chunkIndex });
  }
  console.log(`   ✅ ${dbChunks.length} chunks saved`);

  // Generate embeddings in parallel batches
  console.log("🧮 Generating embeddings (5 concurrent)...");
  const BATCH_SIZE = 5;
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < dbChunks.length; i += BATCH_SIZE) {
    const batch = dbChunks.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (dbChunk) => {
        const chunk = chunks.find((c) => c.chunkIndex === dbChunk.chunkIndex);
        if (!chunk) return;
        try {
          const embedding = await generateEmbedding(chunk.content);
          const embStr = `[${embedding.join(",")}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE chunks SET embedding = $1::vector WHERE id = $2`,
            embStr,
            dbChunk.id
          );
          processed++;
        } catch (err) {
          errors++;
          console.error(`   ⚠️ Error embedding chunk ${dbChunk.chunkIndex}: ${err}`);
        }
      })
    );
    if ((i + BATCH_SIZE) % 50 < BATCH_SIZE) {
      console.log(`   ${processed}/${dbChunks.length} embeddings... (${errors} errors)`);
    }
  }
  console.log(`   ✅ ${processed} embeddings generated (${errors} errors)`);

  // Mark as ready
  await prisma.document.update({ where: { id: doc.id }, data: { status: "READY" } });
  console.log(`\n✅ Document reprocessed: ${chunks.length} chunks, ${processed} embeddings`);

  // Quick search test
  console.log("\n🔍 Search test: 'cómo llegó el marxismo a Colombia'");
  const queryEmb = await generateEmbedding("cómo llegó el marxismo a Colombia");
  const embStr = `[${queryEmb.join(",")}]`;
  const results = await prisma.$queryRawUnsafe<
    Array<{ content: string; pageNumber: number; similarity: number }>
  >(
    `SELECT c.content, c."pageNumber",
      1 - (c.embedding <=> '${embStr}'::vector) as similarity
     FROM chunks c WHERE c.embedding IS NOT NULL
     ORDER BY c.embedding <=> '${embStr}'::vector LIMIT 5`
  );
  for (const r of results) {
    console.log(`   sim=${Number(r.similarity).toFixed(4)} page=${r.pageNumber} "${r.content.substring(0, 100)}..."`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal:", e);
  await prisma.$disconnect();
  process.exit(1);
});
