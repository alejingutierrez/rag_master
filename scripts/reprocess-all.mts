/**
 * Re-procesa todos los documentos existentes:
 * 1. Re-descarga PDF de S3
 * 2. Re-chunkea con 3000/750
 * 3. Re-genera embeddings con Cohere v4
 *
 * Usa las mismas librerías que la app (pdf-parser.ts, chunking.ts)
 */

import { PrismaClient } from "@prisma/client";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { config } from "dotenv";

// Las funciones de la app se importarán dinámicamente

config({ path: ".env.local" });

const prisma = new PrismaClient();

const awsConfig = {
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
};

const bedrock = new BedrockRuntimeClient(awsConfig);
const s3 = new S3Client(awsConfig);
const BUCKET = process.env.S3_BUCKET_NAME!;

// ---- Embedding con Cohere v4 + retry ----
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateEmbedding(text: string): Promise<number[]> {
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const command = new InvokeModelCommand({
        modelId: "cohere.embed-v4:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          texts: [text],
          input_type: "search_document",
          truncate: "END",
        }),
      });

      const response = await bedrock.send(command);
      const body = JSON.parse(new TextDecoder().decode(response.body));
      return body.embeddings?.float?.[0] || body.embeddings[0];
    } catch (error: unknown) {
      const isThrottled = error instanceof Error &&
        (error.name === "ThrottlingException" || error.message.includes("Too many"));
      if (isThrottled && attempt < MAX_RETRIES - 1) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        process.stdout.write(` [throttled, retry in ${delay/1000}s]`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

// ---- S3 ----
async function getFromS3(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await s3.send(command);
  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// ---- Main ----
async function main() {
  const CHUNK_SIZE = 3000;
  const CHUNK_OVERLAP = 750;
  const BATCH_SIZE = 2;

  const documents = await prisma.document.findMany({
    where: { status: { in: ["ERROR", "PROCESSING"] } },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\n📋 ${documents.length} documentos para re-procesar\n`);

  let totalNewChunks = 0;
  let totalNewEmbeddings = 0;

  for (const doc of documents) {
    const startTime = Date.now();
    console.log(`\n📄 ${doc.filename} (${doc.pageCount} págs)`);

    try {
      // 1. Borrar chunks viejos
      const deleted = await prisma.chunk.deleteMany({ where: { documentId: doc.id } });
      console.log(`   🗑️  ${deleted.count} chunks viejos borrados`);

      // 2. Descargar PDF
      console.log(`   ⬇️  Descargando de S3...`);
      const buffer = await getFromS3(doc.s3Key);

      // 3. Parsear y chunkear usando las mismas funciones de la app
      console.log(`   📝 Parseando y chunkeando (${CHUNK_SIZE}/${CHUNK_OVERLAP})...`);
      const { parsePDF } = await import("../src/lib/pdf-parser.js");
      const { chunkPages } = await import("../src/lib/chunking.js");
      const parsed = await parsePDF(buffer);
      const chunks = chunkPages(parsed.pages, {
        chunkSize: CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
        strategy: "FIXED",
      });
      console.log(`   📦 ${chunks.length} chunks creados`);

      if (chunks.length === 0) {
        await prisma.document.update({
          where: { id: doc.id },
          data: { status: "ERROR", error: "No se extrajo texto del PDF" },
        });
        console.log(`   ⚠️  Sin texto — marcado como ERROR`);
        continue;
      }

      // 4. Guardar chunks
      const dbChunks = [];
      for (const chunk of chunks) {
        const dbChunk = await prisma.chunk.create({
          data: {
            documentId: doc.id,
            content: chunk.content,
            pageNumber: chunk.pageNumber,
            chunkIndex: chunk.chunkIndex,
            chunkSize: CHUNK_SIZE,
            overlap: CHUNK_OVERLAP,
            strategy: "FIXED",
            metadata: { sourceFile: doc.filename },
          },
        });
        dbChunks.push(dbChunk);
      }

      // 5. Generar embeddings con Cohere v4 en lotes
      console.log(`   🧠 Generando embeddings con Cohere v4...`);
      let embeddingsGenerated = 0;

      for (let i = 0; i < dbChunks.length; i += BATCH_SIZE) {
        const batch = dbChunks.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (dbChunk, j) => {
            const chunk = chunks[i + j];
            if (!chunk) return;
            const embedding = await generateEmbedding(chunk.content);
            const embStr = `[${embedding.join(",")}]`;
            await prisma.$executeRawUnsafe(
              `UPDATE chunks SET embedding = $1::vector WHERE id = $2`,
              embStr,
              dbChunk.id
            );
            embeddingsGenerated++;
          })
        );
        if ((i + BATCH_SIZE) % 25 === 0 || i + BATCH_SIZE >= dbChunks.length) {
          process.stdout.write(`\r   🧠 ${embeddingsGenerated}/${dbChunks.length} embeddings`);
        }
      }

      totalNewChunks += chunks.length;
      totalNewEmbeddings += embeddingsGenerated;

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n   ✅ Completado en ${elapsed}s — ${chunks.length} chunks, ${embeddingsGenerated} embeddings`);

      // Reset status to READY
      await prisma.document.update({
        where: { id: doc.id },
        data: { status: "READY", error: null },
      });

    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
      await prisma.document.update({
        where: { id: doc.id },
        data: { status: "ERROR", error: `Reprocess failed: ${error instanceof Error ? error.message : "unknown"}` },
      });
    }
  }

  // Final stats
  const totalChunks = await prisma.chunk.count();
  const withEmbedding = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT count(*) FROM chunks WHERE embedding IS NOT NULL`
  );

  console.log(`\n\n🎉 RE-PROCESAMIENTO COMPLETO`);
  console.log(`   Total chunks: ${totalChunks}`);
  console.log(`   Con embedding: ${Number(withEmbedding[0].count)}`);
  console.log(`   Nuevos chunks: ${totalNewChunks}`);
  console.log(`   Nuevos embeddings: ${totalNewEmbeddings}`);
  console.log(`   Modelo: Cohere Embed v4 (1536 dims)`);
  console.log(`   Chunk size: ${CHUNK_SIZE} / Overlap: ${CHUNK_OVERLAP}\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
