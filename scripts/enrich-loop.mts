/**
 * Enriquece con IA todos los documentos pendientes (enriched=false, READY)
 * corriendo desde local. Misma lógica que /api/documents/enrich-batch pero
 * sin depender de la conexión SSE ni del maxDuration de App Runner.
 *
 * Como local apunta al mismo DATABASE_URL de prod (RDS), la metadata queda
 * en la BD compartida y producción la refleja al instante.
 *
 * Resumible: cada corrida re-consulta los docs con enriched=false.
 *
 * Uso: npx tsx scripts/enrich-loop.mts
 *
 * Variables opcionales:
 *   MAX_DOCS=999  cap total de docs a procesar en esta corrida
 *   STOP_FILE=/tmp/stop-enrich  si existe, sale limpio entre docs
 */
import "dotenv/config";
import { existsSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { enrichDocument } from "../src/lib/document-enricher";

const MAX_DOCS = parseInt(process.env.MAX_DOCS || "999", 10);
const STOP_FILE = process.env.STOP_FILE || "/tmp/stop-enrich";
const PAUSE_MS = 2000; // entre docs, para evitar throttling de Bedrock
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransient(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "ThrottlingException" ||
    error.name === "ExpiredTokenException" ||
    error.name === "ServiceUnavailableException" ||
    /security token|InvalidClientTokenId|Signature expired|ExpiredToken|ETIMEDOUT|ECONNRESET|Too many requests|throttl/i.test(
      error.message
    )
  );
}

async function enrichOne(doc: { id: string; filename: string }): Promise<void> {
  const chunks = await prisma.chunk.findMany({
    where: { documentId: doc.id },
    select: { content: true, pageNumber: true, chunkIndex: true },
    orderBy: { chunkIndex: "asc" },
    take: 30,
  });

  if (chunks.length === 0) {
    throw new Error("Sin chunks procesados");
  }

  const enrichmentData = await enrichDocument(chunks, doc.filename);

  const current = await prisma.document.findUnique({
    where: { id: doc.id },
    select: { metadata: true },
  });
  const currentMetadata =
    current?.metadata && typeof current.metadata === "object"
      ? (current.metadata as Record<string, unknown>)
      : {};
  const merged = { ...currentMetadata, ...enrichmentData };

  await prisma.document.update({
    where: { id: doc.id },
    data: { metadata: merged, enriched: true },
  });

  console.log(
    `  → titulo="${enrichmentData.bookTitle ?? "?"}" autor="${enrichmentData.author ?? "?"}" periodo=${enrichmentData.primaryPeriod ?? "?"} cat=${enrichmentData.primaryCategory ?? "?"}`
  );
}

async function main() {
  const start = Date.now();
  let enriched = 0;
  let failed = 0;
  const failures: { filename: string; error: string }[] = [];

  const documents = await prisma.document.findMany({
    where: { enriched: false, status: "READY" },
    select: { id: true, filename: true },
    orderBy: { createdAt: "asc" },
    take: MAX_DOCS,
  });

  console.log(`[enrich-loop] ${documents.length} docs pendientes`);

  for (let i = 0; i < documents.length; i++) {
    if (existsSync(STOP_FILE)) {
      console.log(`[enrich-loop] STOP_FILE detectado en ${STOP_FILE} — saliendo limpio`);
      break;
    }

    const doc = documents[i];
    console.log(`[enrich-loop] ${i + 1}/${documents.length} ${doc.filename}`);

    let done = false;
    for (let attempt = 1; attempt <= MAX_RETRIES && !done; attempt++) {
      try {
        await enrichOne(doc);
        enriched++;
        done = true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (attempt < MAX_RETRIES && isTransient(error)) {
          const backoff = attempt * 15_000;
          console.log(`  ⚠ transitorio (intento ${attempt}/${MAX_RETRIES}): ${msg} — reintentando en ${backoff / 1000}s`);
          await sleep(backoff);
        } else {
          console.error(`  ✗ FALLO definitivo: ${msg}`);
          failures.push({ filename: doc.filename, error: msg });
          failed++;
          done = true;
        }
      }
    }

    if (i < documents.length - 1) await sleep(PAUSE_MS);
  }

  const elapsed = ((Date.now() - start) / 60000).toFixed(1);
  const remaining = await prisma.document.count({
    where: { enriched: false, status: "READY" },
  });

  console.log(`\n[enrich-loop] ===== RESUMEN =====`);
  console.log(`[enrich-loop] enriquecidos=${enriched} fallidos=${failed} restantes=${remaining} elapsed=${elapsed}min`);
  if (failures.length > 0) {
    console.log(`[enrich-loop] Fallos:`);
    for (const f of failures) console.log(`  - ${f.filename}: ${f.error}`);
  }

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(`[enrich-loop] error fatal:`, e);
  await prisma.$disconnect();
  process.exit(1);
});
