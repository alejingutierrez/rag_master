/**
 * Re-procesa los 553 documentos en chunks_v2 con la nueva estrategia parent-child.
 *
 * Workflow:
 *   1. Para cada documento READY en la BD:
 *      - Descargar PDF de S3
 *      - Parsear con pdf-parser (ya teníamos esto)
 *      - Chunker v2 (parent-child con filtros y preprocesamiento)
 *      - Insertar children y parents en chunks_v2 (children con embedding, parents sin)
 *   2. Embeddings generados en lotes con concurrencia 5
 *   3. Idempotente: skip si ya hay rows en chunks_v2 para ese docId
 *
 * Uso:
 *   npx tsx scripts/reprocess-v2.mts                    # todos los documentos
 *   npx tsx scripts/reprocess-v2.mts --limit 10         # solo 10 docs (test)
 *   npx tsx scripts/reprocess-v2.mts --doc <docId>      # un solo doc
 *   npx tsx scripts/reprocess-v2.mts --force            # reprocesa aunque ya exista en v2
 *   npx tsx scripts/reprocess-v2.mts --skip-embeddings  # solo chunkea (debug)
 */
import { prisma } from "../src/lib/prisma";
import { getFromS3 } from "../src/lib/s3";
import { parsePDF } from "../src/lib/pdf-parser";
import { chunkPagesV2, DEFAULT_CHUNK_V2_CONFIG } from "../src/lib/chunking-v2";
import { generateEmbedding } from "../src/lib/bedrock";

const argv = process.argv.slice(2);
function arg(flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
}
const LIMIT = arg("--limit") ? Number(arg("--limit")) : undefined;
const ONE_DOC = arg("--doc");
const FORCE = argv.includes("--force");
const SKIP_EMBEDDINGS = argv.includes("--skip-embeddings");
const EMBED_CONCURRENCY = Number(arg("--concurrency") || "5");

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function alreadyProcessed(docId: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*) as c FROM chunks_v2 WHERE "documentId" = $1`,
    docId
  );
  return Number(rows[0].c) > 0;
}

async function processDocument(docId: string, filename: string, s3Key: string): Promise<{
  children: number;
  parents: number;
  skipped: boolean;
  reason?: string;
}> {
  if (!FORCE && (await alreadyProcessed(docId))) {
    return { children: 0, parents: 0, skipped: true, reason: "already processed" };
  }

  if (FORCE) {
    await prisma.$executeRawUnsafe(`DELETE FROM chunks_v2 WHERE "documentId" = $1`, docId);
  }

  const buffer = await getFromS3(s3Key);
  const parsed = await parsePDF(buffer);
  const documentTitle = filename
    .replace(/\.pdf$/i, "")
    .replace(/^[\d._-]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  const result = chunkPagesV2(parsed.pages, documentTitle, DEFAULT_CHUNK_V2_CONFIG);

  if (result.children.length === 0) {
    return { children: 0, parents: 0, skipped: true, reason: "no chunks produced" };
  }

  // Insertar children (sin embedding aún)
  for (const child of result.children) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO chunks_v2 (
         id, "documentId", content, "contextualContent",
         "pageNumber", "chunkIndex", "parentIndex", "chapterTitle",
         "isParent", metadata
       ) VALUES (
         gen_random_uuid()::text, $1, $2, $3,
         $4, $5, $6, $7,
         false, '{}'::jsonb
       )`,
      docId,
      child.content,
      child.contextualContent,
      child.pageNumber,
      child.chunkIndex,
      child.parentIndex,
      child.chapterTitle || null
    );
  }

  // Insertar parents
  for (const parent of result.parents) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO chunks_v2 (
         id, "documentId", content, "contextualContent",
         "pageNumber", "chunkIndex", "parentIndex", "chapterTitle",
         "isParent", metadata
       ) VALUES (
         gen_random_uuid()::text, $1, $2, $3,
         $4, $5, $6, $7,
         true,
         jsonb_build_object('pageStart', $8, 'pageEnd', $9, 'childIndices', $10::jsonb)
       )`,
      docId,
      parent.content,
      parent.content, // parents no necesitan contextualContent
      parent.pageStart,
      -1, // sin chunkIndex global
      parent.parentIndex,
      null,
      parent.pageStart,
      parent.pageEnd,
      JSON.stringify(parent.childIndices)
    );
  }

  // Embeddings de los children
  if (!SKIP_EMBEDDINGS) {
    const childRows = await prisma.$queryRawUnsafe<Array<{ id: string; contextualContent: string }>>(
      `SELECT id, "contextualContent" FROM chunks_v2
       WHERE "documentId" = $1 AND "isParent" = false AND embedding IS NULL
       ORDER BY "chunkIndex"`,
      docId
    );

    for (let i = 0; i < childRows.length; i += EMBED_CONCURRENCY) {
      const batch = childRows.slice(i, i + EMBED_CONCURRENCY);
      await Promise.all(
        batch.map(async (row) => {
          const emb = await generateEmbedding(row.contextualContent, "search_document");
          const embStr = `[${emb.join(",")}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE chunks_v2 SET embedding = $1::vector WHERE id = $2`,
            embStr,
            row.id
          );
        })
      );
    }
  }

  return {
    children: result.children.length,
    parents: result.parents.length,
    skipped: false,
  };
}

async function main() {
  console.log("🔨 Reprocess V2 — parent-child chunker + Cohere embeddings");
  console.log(`   limit=${LIMIT ?? "all"} | force=${FORCE} | skip-embeddings=${SKIP_EMBEDDINGS} | concurrency=${EMBED_CONCURRENCY}\n`);

  let docs;
  if (ONE_DOC) {
    docs = await prisma.document.findMany({
      where: { id: ONE_DOC },
      select: { id: true, filename: true, s3Key: true, status: true },
    });
  } else {
    docs = await prisma.document.findMany({
      where: { status: "READY" },
      orderBy: { createdAt: "asc" },
      take: LIMIT,
      select: { id: true, filename: true, s3Key: true, status: true },
    });
  }

  console.log(`📚 ${docs.length} documentos a procesar\n`);

  const t0 = Date.now();
  let totalChildren = 0;
  let totalParents = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const tDoc = Date.now();
    process.stdout.write(`  [${i + 1}/${docs.length}] ${doc.filename.substring(0, 60)} ... `);

    try {
      const r = await processDocument(doc.id, doc.filename, doc.s3Key);
      if (r.skipped) {
        skipped++;
        console.log(`⏭️  ${r.reason} (${Date.now() - tDoc}ms)`);
      } else {
        totalChildren += r.children;
        totalParents += r.parents;
        console.log(`✓ ${r.children} children / ${r.parents} parents (${Date.now() - tDoc}ms)`);
      }
    } catch (e) {
      errors++;
      console.log(`❌ ${(e as Error).message.substring(0, 80)}`);
    }

    // Cada 20 docs imprime resumen
    if ((i + 1) % 20 === 0) {
      const elapsed = (Date.now() - t0) / 1000;
      const rate = (i + 1) / elapsed;
      const eta = (docs.length - i - 1) / rate;
      console.log(`     📊 ${i + 1}/${docs.length} | ${rate.toFixed(2)} docs/s | ETA ${(eta / 60).toFixed(1)} min\n`);
    }
  }

  const totalMin = (Date.now() - t0) / 60000;
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`✅ Procesamiento completo en ${totalMin.toFixed(1)} min`);
  console.log(`   Total children: ${totalChildren}`);
  console.log(`   Total parents:  ${totalParents}`);
  console.log(`   Saltados:       ${skipped}`);
  console.log(`   Errores:        ${errors}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
