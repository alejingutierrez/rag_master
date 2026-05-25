/**
 * Re-chunkea TODOS los documentos en prod con el nuevo algoritmo:
 *  - chunkSize = 2000 palabras
 *  - chunkOverlap = 500 palabras
 *  - cross-page (chunks pueden cruzar saltos de página)
 *  - filtra chunks-basura (OCR roto o muy cortos)
 *
 * Flujo por documento:
 *  1. POST /api/documents/[id]/reprocess { chunkSize:2000, chunkOverlap:500, strategy:"FIXED" }
 *     → borra chunks viejos, re-parse + re-chunk, dispara embeddings vía after()
 *  2. GET /api/documents/[id]/process en loop hasta status=READY
 *
 * Idempotente y resumible: guarda progress en tmp/rechunk-progress.json.
 *
 * Uso:
 *   npx tsx scripts/rechunk-all.mts [url-base] [--only-status=READY]
 */

import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BASE_URL =
  (process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : null) || "https://fbrwkqtydz.us-east-1.awsapprunner.com";

const ONLY_STATUS_ARG = process.argv.find((a) => a.startsWith("--only-status="));
const ONLY_STATUS = ONLY_STATUS_ARG?.split("=")[1] ?? null; // si null, procesa TODOS

const PROGRESS_FILE = resolve("tmp/rechunk-progress.json");

const NEW_CHUNK_SIZE = 2000; // palabras
const NEW_CHUNK_OVERLAP = 500; // palabras
const POLL_INTERVAL_MS = 8000;
const POLL_MAX_MINUTES = 60;
const STALL_KICKS_AFTER_POLLS = 4;

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
}

type Progress = Record<string, ProgressEntry>;

async function loadProgress(): Promise<Progress> {
  if (!existsSync(PROGRESS_FILE)) return {};
  try {
    return JSON.parse(await readFile(PROGRESS_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function saveProgress(p: Progress) {
  await mkdir(dirname(PROGRESS_FILE), { recursive: true });
  await writeFile(PROGRESS_FILE, JSON.stringify(p, null, 2), "utf8");
}

function fmtMs(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

async function listAllDocs(): Promise<DocStub[]> {
  const all: DocStub[] = [];
  let page = 1;
  const limit = 100;
  while (true) {
    const url = `${BASE_URL}/api/documents?page=${page}&limit=${limit}` +
      (ONLY_STATUS ? `&status=${ONLY_STATUS}` : "");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET /api/documents ${res.status}`);
    const data = (await res.json()) as {
      documents: DocStub[];
      pagination: { totalPages: number };
    };
    all.push(...data.documents);
    if (page >= data.pagination.totalPages) break;
    page++;
  }
  return all;
}

async function requestReprocess(id: string): Promise<{ newChunks: number }> {
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
  return { newChunks: data.chunks ?? data.document?._count?.chunks ?? 0 };
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
  } catch {
    /* best effort */
  }
}

async function waitReady(id: string): Promise<number> {
  const start = Date.now();
  const maxMs = POLL_MAX_MINUTES * 60 * 1000;
  let lastProcessed = -1;
  let stallCount = 0;

  while (true) {
    if (Date.now() - start > maxMs) {
      throw new Error(`Timeout ${POLL_MAX_MINUTES}min; último: ${lastProcessed}`);
    }
    const p = await getProgressStatus(id);

    if (p.status === "READY") {
      process.stdout.write(
        `\r     ✅ ${p.processedChunks}/${p.totalChunks} en ${fmtMs(Date.now() - start)}                      \n`
      );
      return p.totalChunks;
    }
    if (p.status === "ERROR") {
      throw new Error(`Documento en ERROR (totalChunks: ${p.totalChunks})`);
    }

    const pct = p.totalChunks > 0 ? Math.round((p.processedChunks / p.totalChunks) * 100) : 0;
    process.stdout.write(
      `\r     ⏳ ${p.processedChunks}/${p.totalChunks} (${pct}%) — ${fmtMs(Date.now() - start)}        `
    );

    if (p.processedChunks === lastProcessed) {
      stallCount++;
      if (stallCount >= STALL_KICKS_AFTER_POLLS) {
        process.stdout.write("\n     🔄 re-disparando /process...\n");
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

async function processOne(doc: DocStub, progress: Progress) {
  const entry: ProgressEntry =
    progress[doc.id] ?? {
      id: doc.id,
      filename: doc.filename,
      status: "PENDING",
      oldChunks: doc._count.chunks,
    };

  if (entry.status === "READY") {
    console.log(`   ⏭️  ya re-chunkeado (${entry.newChunks} chunks)`);
    return;
  }

  entry.startedAt = entry.startedAt ?? new Date().toISOString();
  entry.oldChunks = doc._count.chunks;
  progress[doc.id] = entry;

  console.log(`   ⚙️  POST /reprocess (chunkSize=${NEW_CHUNK_SIZE}w, overlap=${NEW_CHUNK_OVERLAP}w)...`);
  const tReq = Date.now();
  const { newChunks } = await requestReprocess(doc.id);
  entry.newChunks = newChunks;
  entry.status = "REQUESTED";
  console.log(`     ✅ ${doc._count.chunks} → ${newChunks} chunks (${fmtMs(Date.now() - tReq)})`);
  await saveProgress(progress);

  console.log(`   🧠 esperando embeddings (poll cada ${POLL_INTERVAL_MS / 1000}s)...`);
  const finalChunks = await waitReady(doc.id);
  entry.newChunks = finalChunks;
  entry.status = "READY";
  entry.finishedAt = new Date().toISOString();
  progress[doc.id] = entry;
  await saveProgress(progress);
}

async function main() {
  console.log(`\n🔄 Re-chunk masivo`);
  console.log(`   URL: ${BASE_URL}`);
  console.log(`   chunkSize: ${NEW_CHUNK_SIZE} palabras`);
  console.log(`   overlap:   ${NEW_CHUNK_OVERLAP} palabras`);
  if (ONLY_STATUS) console.log(`   Filtro:    status=${ONLY_STATUS}`);
  console.log("");

  console.log("📋 Listando documentos...");
  const docs = await listAllDocs();
  console.log(`   ${docs.length} documentos encontrados\n`);

  const progress = await loadProgress();
  const done = Object.values(progress).filter((e) => e.status === "READY").length;
  if (done > 0) console.log(`   ↪️  ${done} ya re-chunkeados en corrida previa\n`);

  const tStart = Date.now();
  const summary = { ready: 0, error: 0, skipped: 0 };

  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    console.log(`\n═══ [${i + 1}/${docs.length}] ${d.filename} ═══`);
    console.log(`   id=${d.id}  status=${d.status}  chunks_actuales=${d._count.chunks}  paginas=${d.pageCount}`);
    try {
      await processOne(d, progress);
      const e = progress[d.id];
      if (e?.status === "READY") summary.ready++;
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`\n   ❌ ERROR: ${msg}`);
      const e = progress[d.id] ?? { id: d.id, filename: d.filename, status: "PENDING" as const };
      e.status = "ERROR";
      e.error = msg;
      e.finishedAt = new Date().toISOString();
      progress[d.id] = e;
      await saveProgress(progress);
      summary.error++;
    }
  }

  console.log(`\n\n═══════════════════════════════════════════════`);
  console.log(`📊 RESUMEN (${fmtMs(Date.now() - tStart)})`);
  console.log(`   ✅ READY: ${summary.ready}`);
  console.log(`   ❌ ERROR: ${summary.error}`);
  console.log(`📄 Progress: ${PROGRESS_FILE}`);
  console.log(`═══════════════════════════════════════════════\n`);

  if (summary.error > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\n💥 Fatal:", err);
  process.exit(1);
});
