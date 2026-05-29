/**
 * Re-chunk masivo PARALELO + QA inline.
 *
 * Diferencias con rechunk-all.mts:
 *  - Pool de workers (CONCURRENCY docs simultáneos)
 *  - Cada worker: POST /reprocess + poll independiente hasta READY
 *  - Progress JSON: writes serializados para evitar corrupción
 *  - QA: cada N docs, samplea 1 chunk al azar e imprime métricas
 *  - Stats globales en tiempo real (ETA, throughput, throttling)
 *
 * Uso:
 *   npx tsx scripts/rechunk-parallel.mts [url-base] [--concurrency=N]
 */

import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BASE_URL =
  (process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : null) || "https://fbrwkqtydz.us-east-1.awsapprunner.com";

const CONC_ARG = process.argv.find((a) => a.startsWith("--concurrency="));
const CONCURRENCY = CONC_ARG ? parseInt(CONC_ARG.split("=")[1]) : 10;

const PROGRESS_FILE = resolve("tmp/rechunk-progress.json");

const NEW_CHUNK_SIZE = 2000;
const NEW_CHUNK_OVERLAP = 500;
const POLL_INTERVAL_MS = 6000;
const POLL_MAX_MINUTES = 120; // 2h por doc — throttle de Bedrock hace lentos algunos docs
const QA_SAMPLE_EVERY = 15; // cada 15 docs completados, muestra una QA

interface DocStub {
  id: string;
  filename: string;
  status: string;
  pageCount: number | null;
  _count: { chunks: number };
}

interface ProgressEntry {
  id: string;
  filename: string;
  status: "PENDING" | "REQUESTED" | "READY" | "ERROR";
  oldChunks?: number;
  newChunks?: number;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  durationMs?: number;
}

type Progress = Record<string, ProgressEntry>;

let progress: Progress = {};
let progressLock = Promise.resolve();

async function loadProgress(): Promise<Progress> {
  if (!existsSync(PROGRESS_FILE)) return {};
  try {
    return JSON.parse(await readFile(PROGRESS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function scheduleProgressSave() {
  progressLock = progressLock
    .then(async () => {
      await mkdir(dirname(PROGRESS_FILE), { recursive: true });
      await writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2), "utf8");
    })
    .catch(() => {});
}

function fmtMs(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtEta(remaining: number, avgMs: number) {
  if (avgMs <= 0 || remaining <= 0) return "—";
  const etaMs = (remaining * avgMs) / CONCURRENCY;
  return fmtMs(etaMs);
}

// ---- API helpers ----
async function listAllDocs(): Promise<DocStub[]> {
  const all: DocStub[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${BASE_URL}/api/documents?page=${page}&limit=100`);
    if (!res.ok) throw new Error(`GET /api/documents ${res.status}`);
    const data = (await res.json()) as { documents: DocStub[]; pagination: { totalPages: number } };
    all.push(...data.documents);
    if (page >= data.pagination.totalPages) break;
    page++;
  }
  return all;
}

async function getDocChunksSample(id: string) {
  const res = await fetch(`${BASE_URL}/api/documents/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  const chunks = data.document?.chunks ?? [];
  if (chunks.length === 0) return null;
  const sizes = chunks.map((c: { content: string }) => c.content.split(/\s+/).length);
  const sample = chunks[Math.floor(chunks.length / 2)];
  return {
    count: chunks.length,
    avgWords: Math.round(sizes.reduce((a: number, b: number) => a + b, 0) / sizes.length),
    minWords: Math.min(...sizes),
    maxWords: Math.max(...sizes),
    sampleContent: sample.content.slice(0, 400),
    samplePage: sample.pageNumber,
    sampleChars: sample.content.length,
  };
}

async function requestReprocess(id: string): Promise<{ newChunks: number; isNewCode: boolean }> {
  // Retry con backoff exponencial para network errors transitorios (502/503/504/fetch failed)
  const MAX_RETRIES = 6;
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await requestReprocessOnce(id);
    } catch (e) {
      lastErr = e;
      const msg = (e as Error).message || "";
      const retryable = msg.includes("fetch failed") || msg.includes("502") || msg.includes("503") || msg.includes("504") || msg.includes("ECONNRESET") || msg.includes("ENOTFOUND");
      if (retryable && attempt < MAX_RETRIES - 1) {
        const delay = Math.pow(2, attempt) * 3000 + Math.random() * 2000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

async function requestReprocessOnce(id: string): Promise<{ newChunks: number; isNewCode: boolean }> {
  const res = await fetch(`${BASE_URL}/api/documents/${id}/reprocess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chunkSize: NEW_CHUNK_SIZE,
      chunkOverlap: NEW_CHUNK_OVERLAP,
      strategy: "FIXED",
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST /reprocess ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  return {
    newChunks: data.chunks ?? data.document?._count?.chunks ?? 0,
    isNewCode: "message" in data, // marker del código nuevo
  };
}

async function getProgressStatus(id: string) {
  const res = await fetch(`${BASE_URL}/api/documents/${id}/process`);
  if (!res.ok) throw new Error(`GET /process ${res.status}`);
  return (await res.json()) as {
    status: "PENDING" | "PROCESSING" | "READY" | "ERROR";
    totalChunks: number;
    processedChunks: number;
    pendingChunks: number;
  };
}

async function kick(id: string) {
  try {
    await fetch(`${BASE_URL}/api/documents/${id}/process`, { method: "POST" });
  } catch {}
}

async function waitReady(id: string, _filename: string): Promise<number> {
  const start = Date.now();
  const maxMs = POLL_MAX_MINUTES * 60 * 1000;
  let lastProcessed = -1;
  let stallCount = 0;

  while (true) {
    if (Date.now() - start > maxMs) {
      throw new Error(`Timeout ${POLL_MAX_MINUTES}min`);
    }
    const p = await getProgressStatus(id);
    if (p.status === "READY") return p.totalChunks;
    if (p.status === "ERROR") throw new Error(`Documento en ERROR`);

    if (p.processedChunks === lastProcessed) {
      stallCount++;
      if (stallCount >= 4) {
        await kick(id);
        stallCount = 0;
      }
    } else {
      stallCount = 0;
      lastProcessed = p.processedChunks;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

// ---- Worker ----
async function processOne(doc: DocStub): Promise<void> {
  const start = Date.now();
  const entry: ProgressEntry =
    progress[doc.id] ?? {
      id: doc.id,
      filename: doc.filename,
      status: "PENDING",
      oldChunks: doc._count.chunks,
    };
  if (entry.status === "READY") return;

  entry.startedAt = new Date().toISOString();
  entry.oldChunks = doc._count.chunks;
  progress[doc.id] = entry;

  const { newChunks, isNewCode } = await requestReprocess(doc.id);
  if (!isNewCode) {
    throw new Error("Servidor responde con código viejo (sin field 'message')");
  }
  entry.newChunks = newChunks;
  entry.status = "REQUESTED";
  scheduleProgressSave();

  const finalChunks = await waitReady(doc.id, doc.filename);
  entry.newChunks = finalChunks;
  entry.status = "READY";
  entry.finishedAt = new Date().toISOString();
  entry.durationMs = Date.now() - start;
  progress[doc.id] = entry;
  scheduleProgressSave();
}

// ---- Stats ----
const stats = {
  ready: 0,
  error: 0,
  throttleObserved: 0,
  totalDurationMs: 0,
  processedDocsForAvg: 0,
};

function logStats(idx: number, total: number, doc: DocStub, ms: number, newChunks: number) {
  stats.ready++;
  stats.totalDurationMs += ms;
  stats.processedDocsForAvg++;
  const avg = stats.totalDurationMs / stats.processedDocsForAvg;
  const remaining = total - idx;
  const eta = fmtEta(remaining, avg);
  const tag = `[${idx}/${total}]`;
  const reduction = doc._count.chunks > 0
    ? `${Math.round(100 * (1 - newChunks / doc._count.chunks))}% reducción`
    : "";
  console.log(
    `${tag} ✅ ${doc._count.chunks}→${newChunks} (${reduction}) ${fmtMs(ms)} | avg ${fmtMs(avg)}/doc | ETA ${eta} | ${doc.filename.slice(0, 50)}`,
  );
}

async function doQASample(docId: string, filename: string) {
  const s = await getDocChunksSample(docId);
  if (!s) return;
  console.log(
    `\n   🔍 QA SAMPLE — ${filename.slice(0, 60)}\n` +
      `      chunks: ${s.count} | palabras avg=${s.avgWords} min=${s.minWords} max=${s.maxWords}\n` +
      `      muestra (pag ${s.samplePage}, ${s.sampleChars} chars):\n` +
      `      "${s.sampleContent.replace(/\n+/g, " ")}..."\n`,
  );
  // QA assertions
  if (s.avgWords < 1500) {
    console.warn(`      ⚠️  avgWords ${s.avgWords} < 1500 esperado — investigar`);
  }
  if (s.minWords < 50 && s.count > 1) {
    console.warn(`      ⚠️  minWords ${s.minWords} < 50 — filtro de basura falló?`);
  }
}

// ---- Main ----
async function main() {
  console.log(`\n🔄 Re-chunk masivo PARALELO`);
  console.log(`   URL: ${BASE_URL}`);
  console.log(`   Concurrencia: ${CONCURRENCY}`);
  console.log(`   chunkSize: ${NEW_CHUNK_SIZE} palabras, overlap: ${NEW_CHUNK_OVERLAP}`);
  console.log("");

  console.log("📋 Listando documentos...");
  const allDocs = await listAllDocs();
  progress = await loadProgress();

  // Filtrar los que ya están READY en progress
  const pending = allDocs.filter((d) => progress[d.id]?.status !== "READY");
  const alreadyDone = allDocs.length - pending.length;
  console.log(`   Total: ${allDocs.length} | ya re-chunkeados: ${alreadyDone} | a procesar: ${pending.length}\n`);

  if (pending.length === 0) {
    console.log("✅ Nada que hacer.\n");
    return;
  }

  stats.ready = alreadyDone;
  const tStart = Date.now();
  const total = allDocs.length;

  // Worker queue
  let nextIdx = 0;
  const indexOffset = alreadyDone;

  async function worker(workerId: number) {
    while (true) {
      const myIdx = nextIdx++;
      if (myIdx >= pending.length) return;
      const doc = pending[myIdx];
      const globalIdx = indexOffset + myIdx + 1;
      try {
        const t = Date.now();
        await processOne(doc);
        const ms = Date.now() - t;
        const newChunks = progress[doc.id]?.newChunks ?? 0;
        logStats(globalIdx, total, doc, ms, newChunks);

        // QA cada N docs
        if (stats.ready % QA_SAMPLE_EVERY === 0) {
          await doQASample(doc.id, doc.filename);
        }
      } catch (err) {
        const msg = (err as Error).message;
        console.error(`[${globalIdx}/${total}] ❌ ${doc.filename.slice(0, 40)}: ${msg}`);
        stats.error++;
        const e = progress[doc.id] ?? { id: doc.id, filename: doc.filename, status: "PENDING" as const };
        e.status = "ERROR";
        e.error = msg;
        e.finishedAt = new Date().toISOString();
        progress[doc.id] = e;
        scheduleProgressSave();
      }
    }
  }

  // Lanzar pool de workers
  console.log(`🚀 Lanzando ${CONCURRENCY} workers paralelos...\n`);
  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i));
  await Promise.all(workers);

  // Esperar a que termine el último save
  await progressLock;

  const elapsed = Date.now() - tStart;
  console.log(`\n\n═══════════════════════════════════════════════`);
  console.log(`📊 RESUMEN`);
  console.log(`   Total ejecución:  ${fmtMs(elapsed)}`);
  console.log(`   ✅ READY:         ${stats.ready}/${total}`);
  console.log(`   ❌ ERROR:         ${stats.error}`);
  console.log(`   Avg por doc:      ${fmtMs(stats.totalDurationMs / Math.max(1, stats.processedDocsForAvg))}`);
  console.log(`📄 Progress: ${PROGRESS_FILE}`);
  console.log(`═══════════════════════════════════════════════\n`);

  if (stats.error > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\n💥 Fatal:", err);
  process.exit(1);
});
