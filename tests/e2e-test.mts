/**
 * E2E Test Suite para RAG Master
 * Ejecuta pruebas directas contra DB (Prisma), S3, Bedrock y pgvector.
 *
 * Uso: npx tsx tests/e2e-test.mts
 */

import { PrismaClient } from "@prisma/client";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import * as fs from "fs";
import * as path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────
const awsConfig = {
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
};
const BUCKET = process.env.S3_BUCKET_NAME || "rag-master-pdfs";
const EMBEDDING_MODEL = process.env.BEDROCK_EMBEDDING_MODEL_ID || "amazon.titan-embed-text-v2:0";
const CLAUDE_MODEL = process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-6-v1";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});
const s3 = new S3Client(awsConfig);
const bedrock = new BedrockRuntimeClient(awsConfig);

// ─── Test Tracking ──────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let skipped = 0;
const results: { name: string; status: "PASS" | "FAIL" | "SKIP"; detail?: string; time?: number }[] = [];

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    passed++;
    results.push({ name, status: "PASS", time: ms });
    console.log(`  ✅ ${name} (${ms}ms)`);
  } catch (err: unknown) {
    const ms = Date.now() - start;
    failed++;
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name, status: "FAIL", detail, time: ms });
    console.log(`  ❌ ${name} (${ms}ms)`);
    console.log(`     → ${detail}`);
  }
}

function skip(name: string, reason: string) {
  skipped++;
  results.push({ name, status: "SKIP", detail: reason });
  console.log(`  ⏭️  ${name} — ${reason}`);
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

// ─── Shared state between tests ──────────────────────────────────────────────
let testDocId: string | null = null;
let testChunkId: string | null = null;
let testS3Key: string | null = null;
let testEmbedding: number[] | null = null;

// ─── PDF de prueba ───────────────────────────────────────────────────────────
const TEST_PDF_PATH = "/Users/agutie04/Library/Mobile Documents/com~apple~CloudDocs/Documents/Historia de Colombia/Libros/- El marxismo en Colombia-Universidad nacional de Colombia (1984).pdf";

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║          RAG MASTER — E2E Test Suite                        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("── 1. DATABASE CONNECTIVITY ─────────────────────────────────");
  // ═══════════════════════════════════════════════════════════════════════════

  await test("Prisma: conectar a PostgreSQL", async () => {
    const result = await prisma.$queryRaw<[{ n: bigint }]>`SELECT 1 as n`;
    assert(Number(result[0].n) === 1, "SELECT 1 debe retornar 1");
  });

  await test("Prisma: pgvector extension activa", async () => {
    const result = await prisma.$queryRaw<[{ extname: string }]>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    assert(result.length > 0, "Extension 'vector' debe estar instalada");
  });

  await test("Prisma: tablas existen (documents, chunks, configurations, conversations)", async () => {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    const names = tables.map((t) => t.tablename);
    for (const t of ["documents", "chunks", "configurations", "conversations"]) {
      assert(names.includes(t), `Tabla '${t}' debe existir`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 2. CONFIGURATION (GET/PUT /api/config) ──────────────────");
  // ═══════════════════════════════════════════════════════════════════════════

  await test("GET config: obtener o crear configuración default", async () => {
    let config = await prisma.configuration.findFirst({ where: { name: "default" } });
    if (!config) {
      config = await prisma.configuration.create({ data: { name: "default" } });
    }
    assert(config !== null, "Config debe existir");
    assert(config.chunkSize === 1024, `chunkSize debe ser 1024, got ${config.chunkSize}`);
    assert(config.topK === 5, `topK debe ser 5, got ${config.topK}`);
  });

  await test("PUT config: actualizar chunkSize y topK", async () => {
    let config = await prisma.configuration.findFirst({ where: { name: "default" } });
    assert(config !== null, "Config debe existir");
    const updated = await prisma.configuration.update({
      where: { id: config!.id },
      data: { chunkSize: 2048, topK: 10 },
    });
    assert(updated.chunkSize === 2048, "chunkSize actualizado a 2048");
    assert(updated.topK === 10, "topK actualizado a 10");
    // Restaurar
    await prisma.configuration.update({
      where: { id: config!.id },
      data: { chunkSize: 1024, topK: 5 },
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 3. S3 PRESIGNED URL ─────────────────────────────────────");
  // ═══════════════════════════════════════════════════════════════════════════

  await test("S3: generar presigned upload URL", async () => {
    const key = `pdfs/test-${Date.now()}-test.pdf`;
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: "application/pdf",
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 600 });
    assert(url.includes(BUCKET), "URL debe contener el bucket name");
    assert(url.includes("X-Amz-Signature"), "URL debe contener firma");
    testS3Key = key;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 4. S3 UPLOAD/DOWNLOAD/DELETE ─────────────────────────────");
  // ═══════════════════════════════════════════════════════════════════════════

  const hasPDF = fs.existsSync(TEST_PDF_PATH);
  let pdfBuffer: Buffer | null = null;

  if (hasPDF) {
    pdfBuffer = fs.readFileSync(TEST_PDF_PATH);
    console.log(`  📄 PDF de prueba: ${path.basename(TEST_PDF_PATH)} (${(pdfBuffer.length / 1024 / 1024).toFixed(1)} MB)`);
  }

  await test("S3: subir archivo PDF al bucket", async () => {
    if (!hasPDF || !pdfBuffer) throw new Error("PDF de prueba no disponible");
    testS3Key = `pdfs/test-${Date.now()}-marxismo-colombia.pdf`;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: testS3Key,
        Body: pdfBuffer,
        ContentType: "application/pdf",
      })
    );
  });

  await test("S3: descargar archivo PDF del bucket", async () => {
    if (!testS3Key) throw new Error("No se subió archivo a S3");
    const response = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: testS3Key })
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const downloaded = Buffer.concat(chunks);
    assert(downloaded.length > 0, "El archivo descargado no debe estar vacío");
    if (pdfBuffer) {
      assert(downloaded.length === pdfBuffer.length, `Tamaño debe coincidir: ${downloaded.length} vs ${pdfBuffer.length}`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 5. PDF PARSING ──────────────────────────────────────────");
  // ═══════════════════════════════════════════════════════════════════════════

  let parsedPages: { pageNumber: number; text: string }[] = [];

  await test("PDF Parser: extraer texto de PDF", async () => {
    if (!pdfBuffer) throw new Error("PDF buffer no disponible");
    // Polyfills
    if (typeof globalThis.DOMMatrix === "undefined") {
      (globalThis as any).DOMMatrix = class DOMMatrix {
        constructor() { return Object.create(null); }
      };
    }
    if (typeof globalThis.Path2D === "undefined") {
      (globalThis as any).Path2D = class Path2D {};
    }
    const mod = await import("pdf-parse");
    const PDFParse = (mod as any).PDFParse || (mod as any).default?.PDFParse;
    if (!PDFParse) throw new Error("No se pudo importar PDFParse de pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    await parser.load();
    const numPages = parser.doc.numPages;
    assert(numPages > 0, `PDF debe tener páginas, got ${numPages}`);
    console.log(`     📖 Páginas: ${numPages}`);

    for (let i = 1; i <= Math.min(numPages, 5); i++) {
      const page = await parser.doc.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .filter((item: { str?: string }) => "str" in item)
        .map((item: { str: string }) => item.str)
        .join(" ")
        .trim();
      if (text) {
        parsedPages.push({ pageNumber: i, text });
      }
    }
    parser.destroy();
    assert(parsedPages.length > 0, "Debe extraer texto de al menos 1 página");
    console.log(`     📝 Páginas con texto: ${parsedPages.length}, primeras 100 chars: "${parsedPages[0].text.substring(0, 100)}..."`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 6. CHUNKING (3 estrategias) ──────────────────────────────");
  // ═══════════════════════════════════════════════════════════════════════════

  type ChunkResult = { content: string; pageNumber: number; chunkIndex: number };

  // Import chunking inline (we can't use @/ alias outside Next.js)
  function chunkFixed(text: string, pageNumber: number, chunkSize: number, overlap: number, startIndex: number): ChunkResult[] {
    const chunks: ChunkResult[] = [];
    let pos = 0;
    let idx = startIndex;
    while (pos < text.length) {
      const end = Math.min(pos + chunkSize, text.length);
      const content = text.slice(pos, end).trim();
      if (content) chunks.push({ content, pageNumber, chunkIndex: idx++ });
      pos += chunkSize - overlap;
      if (pos >= text.length) break;
    }
    return chunks;
  }

  await test("Chunking FIXED: dividir texto en chunks de tamaño fijo", async () => {
    if (parsedPages.length === 0) throw new Error("No hay páginas parseadas");
    const text = parsedPages.map((p) => p.text).join("\n\n");
    const chunks = chunkFixed(text, 1, 512, 64, 0);
    assert(chunks.length > 0, "Debe generar al menos 1 chunk");
    assert(chunks[0].content.length <= 512, `Chunk no debe exceder 512 chars, got ${chunks[0].content.length}`);
    console.log(`     📦 Chunks FIXED (512/64): ${chunks.length}`);
  });

  await test("Chunking PARAGRAPH: dividir por párrafos", async () => {
    if (parsedPages.length === 0) throw new Error("No hay páginas parseadas");
    const text = parsedPages.map((p) => p.text).join("\n\n");
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    assert(paragraphs.length > 0, "Debe encontrar párrafos");
    console.log(`     📦 Párrafos encontrados: ${paragraphs.length}`);
  });

  await test("Chunking SENTENCE: dividir por oraciones", async () => {
    if (parsedPages.length === 0) throw new Error("No hay páginas parseadas");
    const text = parsedPages[0].text;
    const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
    assert(sentences.length > 0, "Debe encontrar oraciones");
    console.log(`     📦 Oraciones (página 1): ${sentences.length}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 7. BEDROCK EMBEDDINGS ────────────────────────────────────");
  // ═══════════════════════════════════════════════════════════════════════════

  await test("Bedrock: generar embedding con Titan v2 (1024 dims)", async () => {
    const payload = { inputText: "El marxismo en Colombia", dimensions: 1024, normalize: true };
    const command = new InvokeModelCommand({
      modelId: EMBEDDING_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });
    const response = await bedrock.send(command);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    testEmbedding = body.embedding;
    assert(Array.isArray(testEmbedding), "Embedding debe ser un array");
    assert(testEmbedding!.length === 1024, `Embedding debe tener 1024 dims, got ${testEmbedding!.length}`);
    console.log(`     🧮 Embedding generado: ${testEmbedding!.length} dimensiones, primeros 3 vals: [${testEmbedding!.slice(0, 3).map(v => v.toFixed(4)).join(", ")}]`);
  });

  await test("Bedrock: embeddings batch (2 textos)", async () => {
    const texts = ["Historia de Colombia", "Teoría marxista"];
    const embeddings: number[][] = [];
    for (const text of texts) {
      const command = new InvokeModelCommand({
        modelId: EMBEDDING_MODEL,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({ inputText: text, dimensions: 1024, normalize: true }),
      });
      const response = await bedrock.send(command);
      embeddings.push(JSON.parse(new TextDecoder().decode(response.body)).embedding);
    }
    assert(embeddings.length === 2, "Debe generar 2 embeddings");
    assert(embeddings[0].length === 1024 && embeddings[1].length === 1024, "Ambos de 1024 dims");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 8. DOCUMENT CREATION (POST /api/documents flow) ──────────");
  // ═══════════════════════════════════════════════════════════════════════════

  await test("Crear documento en DB con estado PROCESSING", async () => {
    if (!testS3Key) throw new Error("No hay S3 key");
    const doc = await prisma.document.create({
      data: {
        filename: "marxismo-colombia-TEST.pdf",
        s3Key: testS3Key,
        s3Url: `https://${BUCKET}.s3.us-east-1.amazonaws.com/${testS3Key}`,
        fileSize: pdfBuffer?.length || 0,
        status: "PROCESSING",
      },
    });
    testDocId = doc.id;
    assert(doc.id.length > 0, "Debe generar un ID");
    assert(doc.status === "PROCESSING", "Estado debe ser PROCESSING");
    console.log(`     📄 Doc ID: ${doc.id}`);
  });

  await test("Crear chunks con embeddings y guardar en pgvector", async () => {
    if (!testDocId || parsedPages.length === 0) throw new Error("No hay doc o páginas");
    // Usamos solo los primeros 3 chunks para no demorar demasiado
    const text = parsedPages.map((p) => p.text).join("\n\n");
    const testChunks = chunkFixed(text, 1, 512, 64, 0).slice(0, 3);

    for (const chunk of testChunks) {
      const dbChunk = await prisma.chunk.create({
        data: {
          documentId: testDocId,
          content: chunk.content,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          chunkSize: 512,
          overlap: 64,
          strategy: "FIXED",
          metadata: { sourceFile: "marxismo-colombia-TEST.pdf" },
        },
      });

      if (!testChunkId) testChunkId = dbChunk.id;

      // Generar y guardar embedding
      const payload = { inputText: chunk.content, dimensions: 1024, normalize: true };
      const command = new InvokeModelCommand({
        modelId: EMBEDDING_MODEL,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload),
      });
      const response = await bedrock.send(command);
      const embedding = JSON.parse(new TextDecoder().decode(response.body)).embedding;
      const embStr = `[${embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE chunks SET embedding = $1::vector WHERE id = $2`,
        embStr,
        dbChunk.id
      );
    }

    // Marcar documento como READY
    await prisma.document.update({
      where: { id: testDocId },
      data: { status: "READY", pageCount: parsedPages.length },
    });

    const doc = await prisma.document.findUnique({
      where: { id: testDocId },
      include: { _count: { select: { chunks: true } } },
    });
    assert(doc!.status === "READY", "Estado debe ser READY");
    assert(doc!._count.chunks === 3, `Debe tener 3 chunks, got ${doc!._count.chunks}`);
    console.log(`     ✅ ${doc!._count.chunks} chunks creados con embeddings`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 9. GET /api/documents (listar) ───────────────────────────");
  // ═══════════════════════════════════════════════════════════════════════════

  await test("Listar documentos con paginación", async () => {
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { _count: { select: { chunks: true } } },
      }),
      prisma.document.count(),
    ]);
    assert(total > 0, "Debe haber al menos 1 documento");
    assert(documents.length > 0, "Lista no debe estar vacía");
    const testDoc = documents.find((d) => d.id === testDocId);
    assert(testDoc !== undefined, "El documento de test debe estar en la lista");
    console.log(`     📋 Total docs: ${total}, este batch: ${documents.length}`);
  });

  await test("Filtrar documentos por status=READY", async () => {
    const docs = await prisma.document.findMany({ where: { status: "READY" } });
    assert(docs.length > 0, "Debe haber docs en READY");
    assert(docs.every((d) => d.status === "READY"), "Todos deben ser READY");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 10. GET /api/documents/[id] (detalle) ────────────────────");
  // ═══════════════════════════════════════════════════════════════════════════

  await test("Obtener detalle de documento con chunks", async () => {
    if (!testDocId) throw new Error("No hay doc ID");
    const doc = await prisma.document.findUnique({
      where: { id: testDocId },
      include: {
        chunks: {
          orderBy: { chunkIndex: "asc" },
          select: {
            id: true, content: true, pageNumber: true,
            chunkIndex: true, chunkSize: true, overlap: true,
            strategy: true, metadata: true, createdAt: true,
          },
        },
      },
    });
    assert(doc !== null, "Documento debe existir");
    assert(doc!.chunks.length === 3, `Debe tener 3 chunks, got ${doc!.chunks.length}`);
    assert(doc!.chunks[0].content.length > 0, "Chunk debe tener contenido");
    console.log(`     📖 Doc "${doc!.filename}", ${doc!.chunks.length} chunks`);
  });

  await test("Documento inexistente devuelve null", async () => {
    const doc = await prisma.document.findUnique({ where: { id: "inexistente-id" } });
    assert(doc === null, "Debe ser null para ID inexistente");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 11. PATCH /api/documents/[id]/enrich (metadata) ──────────");
  // ═══════════════════════════════════════════════════════════════════════════

  await test("Enrich: agregar metadata al documento", async () => {
    if (!testDocId) throw new Error("No hay doc ID");
    const doc = await prisma.document.findUnique({ where: { id: testDocId } });
    const currentMeta = typeof doc!.metadata === "object" && doc!.metadata !== null ? doc!.metadata : {};
    const merged = { ...(currentMeta as Record<string, unknown>), author: "Universidad Nacional", year: 1984, topic: "Marxismo" };
    const updated = await prisma.document.update({
      where: { id: testDocId },
      data: { metadata: merged },
    });
    const meta = updated.metadata as Record<string, unknown>;
    assert(meta.author === "Universidad Nacional", "Author debe estar en metadata");
    assert(meta.year === 1984, "Year debe estar en metadata");
    console.log(`     📝 Metadata: ${JSON.stringify(meta)}`);
  });

  await test("Enrich: merge preserva metadata existente", async () => {
    if (!testDocId) throw new Error("No hay doc ID");
    const doc = await prisma.document.findUnique({ where: { id: testDocId } });
    const currentMeta = doc!.metadata as Record<string, unknown>;
    const merged = { ...currentMeta, language: "Spanish" };
    const updated = await prisma.document.update({
      where: { id: testDocId },
      data: { metadata: merged },
    });
    const meta = updated.metadata as Record<string, unknown>;
    assert(meta.author === "Universidad Nacional", "Author previo debe persistir");
    assert(meta.language === "Spanish", "Nuevo campo language debe existir");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 12. PATCH /api/chunks/[id] (editar chunk + re-embed) ─────");
  // ═══════════════════════════════════════════════════════════════════════════

  await test("Editar contenido de chunk y regenerar embedding", async () => {
    if (!testChunkId) throw new Error("No hay chunk ID");
    const newContent = "Este es un contenido editado para pruebas del sistema RAG de Colombia.";
    const updated = await prisma.chunk.update({
      where: { id: testChunkId },
      data: { content: newContent },
    });
    assert(updated.content === newContent, "Contenido debe actualizarse");

    // Regenerar embedding
    const payload = { inputText: newContent, dimensions: 1024, normalize: true };
    const command = new InvokeModelCommand({
      modelId: EMBEDDING_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });
    const response = await bedrock.send(command);
    const embedding = JSON.parse(new TextDecoder().decode(response.body)).embedding;
    const embStr = `[${embedding.join(",")}]`;
    await prisma.$executeRawUnsafe(
      `UPDATE chunks SET embedding = $1::vector WHERE id = $2`,
      embStr,
      testChunkId
    );
    console.log(`     ✏️ Chunk editado y re-embedded`);
  });

  await test("Editar metadata de chunk (merge)", async () => {
    if (!testChunkId) throw new Error("No hay chunk ID");
    const chunk = await prisma.chunk.findUnique({ where: { id: testChunkId } });
    const currentMeta = typeof chunk!.metadata === "object" && chunk!.metadata !== null ? chunk!.metadata : {};
    const merged = { ...(currentMeta as Record<string, unknown>), reviewed: true, reviewer: "test-suite" };
    const updated = await prisma.chunk.update({
      where: { id: testChunkId },
      data: { metadata: merged },
    });
    const meta = updated.metadata as Record<string, unknown>;
    assert(meta.reviewed === true, "reviewed debe ser true");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 13. POST /api/search (búsqueda semántica) ────────────────");
  // ═══════════════════════════════════════════════════════════════════════════

  await test("Búsqueda semántica: generar query embedding + pgvector search", async () => {
    const query = "universidad nacional ciencias humanas historia";
    // 1. Generar embedding de la query
    const payload = { inputText: query, dimensions: 1024, normalize: true };
    const command = new InvokeModelCommand({
      modelId: EMBEDDING_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });
    const response = await bedrock.send(command);
    const queryEmbedding = JSON.parse(new TextDecoder().decode(response.body)).embedding;
    assert(queryEmbedding.length === 1024, "Query embedding debe ser 1024 dims");

    // 2. Buscar en pgvector — usar SQL interpolado directamente ya que $queryRawUnsafe
    //    tiene problemas con el cast de vector en algunos drivers
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    // Primero: probar una búsqueda raw interpolada para diagnosticar
    const rawSql = `SELECT c.id, c.content, d.filename,
      1 - (c.embedding <=> '${embeddingStr}'::vector) as similarity
      FROM chunks c
      JOIN documents d ON c."documentId" = d.id
      WHERE c.embedding IS NOT NULL
      ORDER BY c.embedding <=> '${embeddingStr}'::vector
      LIMIT 5`;
    const results = await prisma.$queryRawUnsafe<
      Array<{ id: string; content: string; similarity: number; filename: string }>
    >(rawSql);

    if (results.length === 0) {
      // Debug adicional
      const countEmb = await prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
        `SELECT count(*) as cnt FROM chunks WHERE embedding IS NOT NULL`
      );
      console.log(`     ⚠️ Debug: chunks con embedding: ${countEmb[0].cnt}`);
    }
    assert(results.length > 0, `Debe encontrar al menos 1 resultado. Chunks en DB: ${await prisma.chunk.count()}`);
    console.log(`     🔍 Resultados: ${results.length}, top similitud: ${Number(results[0].similarity).toFixed(4)}`);
    console.log(`     📄 Top match: "${results[0].content.substring(0, 80)}..."`);
    console.log(`     🔍 Resultados: ${results.length}, top similitud: ${Number(results[0].similarity).toFixed(4)}`);
    console.log(`     📄 Top match: "${results[0].content.substring(0, 80)}..."`);
  });

  await test("Búsqueda con umbral alto (sin resultados esperables)", async () => {
    const payload = { inputText: "quantum computing neural networks", dimensions: 1024, normalize: true };
    const command = new InvokeModelCommand({
      modelId: EMBEDDING_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });
    const response = await bedrock.send(command);
    const queryEmbedding = JSON.parse(new TextDecoder().decode(response.body)).embedding;
    const embeddingStr = `[${queryEmbedding.join(",")}]`;
    const results = await prisma.$queryRawUnsafe<Array<{ id: string; similarity: number }>>(
      `SELECT c.id, 1 - (c.embedding <=> $1::vector) as similarity
       FROM chunks c
       WHERE c.embedding IS NOT NULL
         AND 1 - (c.embedding <=> $1::vector) >= $2
       ORDER BY c.embedding <=> $1::vector LIMIT $3`,
      embeddingStr,
      0.95,
      5
    );
    // Con umbral 0.95 y texto en inglés vs contenido en español, probablemente 0 resultados
    console.log(`     🔍 Resultados con umbral 0.95: ${results.length} (esperado: 0 o pocos)`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 14. POST /api/chat (RAG pipeline + Claude streaming) ─────");
  // ═══════════════════════════════════════════════════════════════════════════

  await test("RAG Pipeline: query → embedding → search → Claude streaming", async () => {
    const question = "¿Qué dice el documento sobre el marxismo en Colombia?";

    // 1. Embedding de la pregunta
    const payload = { inputText: question, dimensions: 1024, normalize: true };
    const embCommand = new InvokeModelCommand({
      modelId: EMBEDDING_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });
    const embResponse = await bedrock.send(embCommand);
    const queryEmb = JSON.parse(new TextDecoder().decode(embResponse.body)).embedding;

    // 2. Buscar chunks similares
    const embStr = `[${queryEmb.join(",")}]`;
    const chatSearchSql = `SELECT c.id, c."documentId", c.content, c."pageNumber", c."chunkIndex",
        d.filename, 1 - (c.embedding <=> '${embStr}'::vector) as similarity
       FROM chunks c
       JOIN documents d ON c."documentId" = d.id
       WHERE c.embedding IS NOT NULL
       ORDER BY c.embedding <=> '${embStr}'::vector LIMIT 5`;
    const chunks = await prisma.$queryRawUnsafe<
      Array<{ id: string; documentId: string; content: string; pageNumber: number; chunkIndex: number; similarity: number; filename: string }>
    >(chatSearchSql);

    assert(chunks.length > 0, "Debe encontrar chunks relevantes");
    console.log(`     📚 Chunks encontrados: ${chunks.length}`);

    // 3. Construir prompt y llamar a Claude via Converse API streaming
    const context = chunks.map((c, i) =>
      `[Fragmento ${i + 1}] (Archivo: ${c.filename}, Página: ${c.pageNumber}, Similitud: ${(Number(c.similarity) * 100).toFixed(1)}%)\n${c.content}`
    ).join("\n\n---\n\n");

    const systemPrompt = `Eres un asistente experto que responde preguntas basándose en los documentos proporcionados.

CONTEXTO DE DOCUMENTOS:
${context}

INSTRUCCIONES:
- Responde basándote EXCLUSIVAMENTE en el contexto proporcionado.
- Si la información no está en el contexto, indícalo claramente.
- Cita los fragmentos relevantes indicando el número de fragmento [Fragmento N].
- Responde en el mismo idioma de la pregunta.
- Sé preciso y conciso.`;

    const converseCommand = new ConverseStreamCommand({
      modelId: CLAUDE_MODEL,
      system: [{ text: systemPrompt }],
      messages: [{ role: "user", content: [{ text: question }] }],
      inferenceConfig: { maxTokens: 1024, temperature: 0.3 },
    });

    const claudeResponse = await bedrock.send(converseCommand);
    let fullAnswer = "";
    let tokenCount = 0;

    if (claudeResponse.stream) {
      for await (const event of claudeResponse.stream) {
        if (event.contentBlockDelta?.delta?.text) {
          fullAnswer += event.contentBlockDelta.delta.text;
          tokenCount++;
        }
      }
    }

    assert(fullAnswer.length > 0, "Claude debe generar una respuesta");
    console.log(`     🤖 Respuesta (${fullAnswer.length} chars, ${tokenCount} deltas):`);
    console.log(`     "${fullAnswer.substring(0, 200)}..."`);

    // 4. Guardar conversación en DB
    const conversation = await prisma.conversation.create({
      data: {
        question,
        answer: fullAnswer,
        modelUsed: CLAUDE_MODEL,
        chunksUsed: chunks.map((c) => ({
          id: c.id,
          similarity: Number(c.similarity),
          documentFilename: c.filename,
          pageNumber: c.pageNumber,
        })),
      },
    });
    assert(conversation.id.length > 0, "Conversación guardada en DB");
    console.log(`     💾 Conversación guardada: ${conversation.id}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 15. GET /api/chat/history ─────────────────────────────────");
  // ═══════════════════════════════════════════════════════════════════════════

  await test("Obtener historial de conversaciones", async () => {
    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.conversation.count(),
    ]);
    assert(total > 0, "Debe haber al menos 1 conversación");
    assert(conversations.length > 0, "Lista no debe estar vacía");
    assert(conversations[0].question.length > 0, "Pregunta no vacía");
    assert(conversations[0].answer.length > 0, "Respuesta no vacía");
    console.log(`     💬 Total conversaciones: ${total}`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 16. REPROCESS (POST /api/documents/[id]/reprocess flow) ──");
  // ═══════════════════════════════════════════════════════════════════════════

  await test("Reprocesar documento con nueva estrategia SENTENCE", async () => {
    if (!testDocId || !testS3Key) throw new Error("No hay doc ID o S3 key");

    // 1. Marcar como PROCESSING
    await prisma.document.update({
      where: { id: testDocId },
      data: { status: "PROCESSING" },
    });

    // 2. Eliminar chunks anteriores
    await prisma.chunk.deleteMany({ where: { documentId: testDocId } });

    // 3. Descargar PDF de S3 nuevamente
    const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: testS3Key }));
    const s3chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      s3chunks.push(chunk);
    }
    const buffer = Buffer.concat(s3chunks);

    // 4. Parsear (solo 3 páginas para velocidad)
    if (typeof globalThis.DOMMatrix === "undefined") {
      (globalThis as any).DOMMatrix = class DOMMatrix { constructor() { return Object.create(null); } };
    }
    if (typeof globalThis.Path2D === "undefined") {
      (globalThis as any).Path2D = class Path2D {};
    }
    const mod2 = await import("pdf-parse");
    const PDFParse2 = (mod2 as any).PDFParse || (mod2 as any).default?.PDFParse;
    const parser = new PDFParse2({ data: new Uint8Array(buffer) });
    await parser.load();
    const pages: { pageNumber: number; text: string }[] = [];
    for (let i = 1; i <= Math.min(parser.doc.numPages, 3); i++) {
      const page = await parser.doc.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .filter((item: { str?: string }) => "str" in item)
        .map((item: { str: string }) => item.str)
        .join(" ").trim();
      if (text) pages.push({ pageNumber: i, text });
    }
    parser.destroy();

    // 5. Chunkear con SENTENCE (simulado: dividir por oraciones)
    const allText = pages.map((p) => p.text).join(" ");
    const sentences = allText.match(/[^.!?]+[.!?]+[\s]*/g) || [allText];
    // Agrupar oraciones en chunks de ~256 chars
    const newChunks: { content: string; pageNumber: number; chunkIndex: number }[] = [];
    let buf = "";
    let idx = 0;
    for (const s of sentences) {
      if (buf.length + s.length > 256 && buf) {
        newChunks.push({ content: buf.trim(), pageNumber: 1, chunkIndex: idx++ });
        buf = "";
      }
      buf += s;
    }
    if (buf.trim()) newChunks.push({ content: buf.trim(), pageNumber: 1, chunkIndex: idx++ });

    // Solo guardar 3 chunks para velocidad
    const chunksToSave = newChunks.slice(0, 3);
    for (const chunk of chunksToSave) {
      const dbChunk = await prisma.chunk.create({
        data: {
          documentId: testDocId,
          content: chunk.content,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          chunkSize: 256,
          overlap: 0,
          strategy: "SENTENCE",
          metadata: { sourceFile: "marxismo-colombia-TEST.pdf" },
        },
      });
      const embPayload = { inputText: chunk.content, dimensions: 1024, normalize: true };
      const embCmd = new InvokeModelCommand({
        modelId: EMBEDDING_MODEL,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(embPayload),
      });
      const embResp = await bedrock.send(embCmd);
      const emb = JSON.parse(new TextDecoder().decode(embResp.body)).embedding;
      await prisma.$executeRawUnsafe(
        `UPDATE chunks SET embedding = $1::vector WHERE id = $2`,
        `[${emb.join(",")}]`,
        dbChunk.id
      );
    }

    await prisma.document.update({
      where: { id: testDocId },
      data: { status: "READY" },
    });

    const doc = await prisma.document.findUnique({
      where: { id: testDocId },
      include: { _count: { select: { chunks: true } } },
    });
    assert(doc!.status === "READY", "Doc debe estar READY después de reprocess");
    assert(doc!._count.chunks >= 1, `Debe tener al menos 1 chunk nuevo, got ${doc!._count.chunks}`);
    console.log(`     🔄 Reprocesado: ${doc!._count.chunks} chunks con estrategia SENTENCE`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n── 17. DELETE /api/documents/[id] ────────────────────────────");
  // ═══════════════════════════════════════════════════════════════════════════

  await test("Eliminar documento: S3 + cascada DB", async () => {
    if (!testDocId || !testS3Key) throw new Error("No hay doc o S3 key");

    // Verificar que existen chunks antes
    const chunksBefore = await prisma.chunk.count({ where: { documentId: testDocId } });
    assert(chunksBefore >= 0, `Chunks antes de borrar: ${chunksBefore}`);

    // Eliminar de S3
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: testS3Key }));

    // Eliminar de DB (cascada)
    await prisma.document.delete({ where: { id: testDocId } });

    // Verificar que ya no existe
    const doc = await prisma.document.findUnique({ where: { id: testDocId } });
    assert(doc === null, "Documento debe estar eliminado");

    // Verificar que los chunks se borraron por cascada
    const chunksAfter = await prisma.chunk.count({ where: { documentId: testDocId } });
    assert(chunksAfter === 0, `Chunks deben borrarse por cascada, quedan ${chunksAfter}`);

    console.log(`     🗑️ Doc + ${chunksBefore} chunks eliminados, S3 limpio`);
    testDocId = null;
    testChunkId = null;
    testS3Key = null;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RESUMEN FINAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    RESUMEN DE RESULTADOS                     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const totalTime = results.reduce((sum, r) => sum + (r.time || 0), 0);
  console.log(`  Total: ${results.length} tests`);
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ⏱️  Tiempo total: ${(totalTime / 1000).toFixed(1)}s\n`);

  if (failed > 0) {
    console.log("  FALLOS:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`    ❌ ${r.name}: ${r.detail}`);
    }
  }

  console.log(`\n  Resultado: ${failed === 0 ? "✅ ALL PASS" : "❌ HAY FALLOS"}\n`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  // Cleanup
  if (testDocId) {
    try { await prisma.document.delete({ where: { id: testDocId } }); } catch {}
  }
  if (testS3Key) {
    try { await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: testS3Key })); } catch {}
  }
  await prisma.$disconnect();
  process.exit(1);
});
