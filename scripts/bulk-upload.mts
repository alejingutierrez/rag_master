/**
 * Bulk upload de PDFs a producción con:
 *  - SHA-256 + check-duplicate (idempotente, se puede re-ejecutar)
 *  - Presign + PUT a S3 con reintentos
 *  - POST /api/documents (parsea, chunkea, dispara embeddings vía after())
 *  - Polling /process hasta READY (con re-kick si se queda atascado)
 *  - Estado persistido en progress.json (sobrevive a Ctrl+C)
 *
 * Uso:
 *   npx tsx scripts/bulk-upload.mts <carpeta> [url-base]
 *   npx tsx scripts/bulk-upload.mts tmp/pdfs-historia-co https://fbrwkqtydz.us-east-1.awsapprunner.com
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";

const FOLDER = process.argv[2];
const BASE_URL =
  process.argv[3] || "https://fbrwkqtydz.us-east-1.awsapprunner.com";

if (!FOLDER) {
  console.error("Uso: npx tsx scripts/bulk-upload.mts <carpeta> [url-base]");
  process.exit(1);
}

const FOLDER_ABS = resolve(FOLDER);
const PROGRESS_FILE = join(FOLDER_ABS, "_progress.json");

const POLL_INTERVAL_MS = 8000;
const POLL_MAX_MINUTES = 45;
const STALL_KICKS_AFTER_POLLS = 4; // si no avanza tras N polls, re-dispara /process
const UPLOAD_RETRIES = 3;
// Unidad: PALABRAS (chunking cross-page por palabras)
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 500;

interface ProgressEntry {
  filename: string;
  fileHash: string;
  status: "PENDING" | "UPLOADED" | "REGISTERED" | "READY" | "ERROR" | "DUPLICATE";
  documentId?: string;
  chunks?: number;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

type Progress = Record<string, ProgressEntry>;

async function loadProgress(): Promise<Progress> {
  if (!existsSync(PROGRESS_FILE)) return {};
  try {
    const raw = await readFile(PROGRESS_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveProgress(progress: Progress) {
  await writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2), "utf8");
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtMs(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}

async function checkDuplicate(fileHash: string, filename: string) {
  const res = await fetch(`${BASE_URL}/api/documents/check-duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileHash, filename }),
  });
  if (!res.ok) return { isDuplicate: false } as { isDuplicate: boolean; existingId?: string };
  return (await res.json()) as { isDuplicate: boolean; existingId?: string; existingFilename?: string };
}

async function presign(filename: string) {
  const res = await fetch(`${BASE_URL}/api/documents/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType: "application/pdf" }),
  });
  if (!res.ok) throw new Error(`Presign falló (${res.status}): ${await res.text()}`);
  return (await res.json()) as { url: string; s3Key: string; s3Url: string };
}

async function uploadToS3(presignedUrl: string, body: Buffer): Promise<void> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= UPLOAD_RETRIES; attempt++) {
    try {
      const res = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: new Uint8Array(body),
      });
      if (res.ok) return;
      lastErr = new Error(`S3 PUT ${res.status} ${res.statusText}`);
    } catch (e) {
      lastErr = e as Error;
    }
    if (attempt < UPLOAD_RETRIES) {
      const wait = attempt * 5000;
      console.log(`     ⚠️  intento ${attempt} falló, reintentando en ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr ?? new Error("S3 upload falló");
}

async function registerDocument(args: {
  s3Key: string;
  s3Url: string;
  filename: string;
  fileSize: number;
  fileHash: string;
}): Promise<{ id: string; chunks: number; status: string }> {
  const res = await fetch(`${BASE_URL}/api/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...args,
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
      strategy: "FIXED",
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST /api/documents ${res.status}: ${text}`);
  const data = JSON.parse(text);
  return {
    id: data.document.id,
    chunks: data.document._count?.chunks ?? 0,
    status: data.document.status,
  };
}

async function getProgress(documentId: string) {
  const res = await fetch(`${BASE_URL}/api/documents/${documentId}/process`);
  if (!res.ok) throw new Error(`GET /process ${res.status}`);
  return (await res.json()) as {
    status: "PENDING" | "PROCESSING" | "READY" | "ERROR";
    totalChunks: number;
    processedChunks: number;
    pendingChunks: number;
  };
}

async function kickProcess(documentId: string) {
  try {
    await fetch(`${BASE_URL}/api/documents/${documentId}/process`, { method: "POST" });
  } catch {
    /* ignore — re-kick is best effort */
  }
}

async function waitUntilReady(documentId: string): Promise<{ chunks: number }> {
  const start = Date.now();
  const maxMs = POLL_MAX_MINUTES * 60 * 1000;
  let lastProcessed = -1;
  let stallCount = 0;

  while (true) {
    const elapsed = Date.now() - start;
    if (elapsed > maxMs) {
      throw new Error(
        `Timeout (${POLL_MAX_MINUTES}min) esperando READY. Último: ${lastProcessed} chunks procesados.`,
      );
    }

    const p = await getProgress(documentId);

    if (p.status === "READY") {
      console.log(
        `     ✅ READY: ${p.processedChunks}/${p.totalChunks} chunks en ${fmtMs(elapsed)}`,
      );
      return { chunks: p.totalChunks };
    }

    if (p.status === "ERROR") {
      throw new Error(`Documento en ERROR (chunks: ${p.totalChunks})`);
    }

    const pct = p.totalChunks > 0 ? Math.round((p.processedChunks / p.totalChunks) * 100) : 0;
    process.stdout.write(
      `\r     ⏳ ${p.processedChunks}/${p.totalChunks} (${pct}%) — ${fmtMs(elapsed)}    `,
    );

    if (p.processedChunks === lastProcessed) {
      stallCount++;
      if (stallCount >= STALL_KICKS_AFTER_POLLS) {
        process.stdout.write("\n     🔄 estancado, re-disparando /process...\n");
        await kickProcess(documentId);
        stallCount = 0;
      }
    } else {
      stallCount = 0;
      lastProcessed = p.processedChunks;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

async function processOne(
  filepath: string,
  progress: Progress,
): Promise<void> {
  const filename = basename(filepath);
  const fileStat = await stat(filepath);
  const fileSize = fileStat.size;

  console.log(`\n📄 ${filename}`);
  console.log(`   ${fmtBytes(fileSize)}`);

  const entry: ProgressEntry = progress[filename] ?? {
    filename,
    fileHash: "",
    status: "PENDING",
  };

  // Skip si ya está READY o es DUPLICATE confirmado en una corrida previa
  if (entry.status === "READY") {
    console.log(`   ⏭️  ya estaba READY (chunks: ${entry.chunks})`);
    return;
  }
  if (entry.status === "DUPLICATE") {
    console.log(`   ⏭️  ya existe (duplicado por hash, doc ${entry.documentId})`);
    return;
  }

  entry.startedAt = entry.startedAt ?? new Date().toISOString();
  progress[filename] = entry;

  // 1. Leer + hash
  const tHash = Date.now();
  const buffer = await readFile(filepath);
  entry.fileHash = sha256(buffer);
  console.log(`   🔑 hash: ${entry.fileHash.slice(0, 16)}... (${fmtMs(Date.now() - tHash)})`);

  // 2. Check duplicate
  const dup = await checkDuplicate(entry.fileHash, filename);
  if (dup.isDuplicate) {
    entry.status = "DUPLICATE";
    entry.documentId = dup.existingId;
    entry.finishedAt = new Date().toISOString();
    console.log(`   ⏭️  duplicado (id existente: ${dup.existingId})`);
    await saveProgress(progress);
    return;
  }

  // 3. Si ya tenemos documentId de una corrida previa interrumpida, retomar polling
  if (entry.documentId && (entry.status === "REGISTERED" || entry.status === "UPLOADED")) {
    console.log(`   ↪️  retomando doc existente ${entry.documentId}...`);
  } else {
    // Presign + upload
    console.log(`   ⬆️  presignar + subir a S3...`);
    const tUp = Date.now();
    const { url, s3Key, s3Url } = await presign(filename);
    await uploadToS3(url, buffer);
    console.log(`     ✅ S3 ok (${fmtMs(Date.now() - tUp)})`);
    entry.status = "UPLOADED";
    progress[filename] = entry;
    await saveProgress(progress);

    // Registrar documento (parse + chunks, dispara embeddings vía after())
    console.log(`   📝 registrando documento (parse + chunks)...`);
    const tReg = Date.now();
    const reg = await registerDocument({
      s3Key,
      s3Url,
      filename,
      fileSize,
      fileHash: entry.fileHash,
    });
    entry.documentId = reg.id;
    entry.chunks = reg.chunks;
    entry.status = "REGISTERED";
    console.log(`     ✅ ${reg.chunks} chunks creados (${fmtMs(Date.now() - tReg)})`);
    progress[filename] = entry;
    await saveProgress(progress);
  }

  // 4. Poll hasta READY
  console.log(`   🧠 embeddings (poll cada ${POLL_INTERVAL_MS / 1000}s, máx ${POLL_MAX_MINUTES}min)...`);
  const result = await waitUntilReady(entry.documentId!);
  entry.chunks = result.chunks;
  entry.status = "READY";
  entry.finishedAt = new Date().toISOString();
  progress[filename] = entry;
  await saveProgress(progress);
}

async function main() {
  console.log(`\n📦 Bulk upload`);
  console.log(`   Carpeta: ${FOLDER_ABS}`);
  console.log(`   URL: ${BASE_URL}\n`);

  const files = (await readdir(FOLDER_ABS))
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .sort();

  console.log(`Encontrados ${files.length} PDFs`);

  // Health check
  const health = await fetch(`${BASE_URL}/api/documents?limit=1`);
  if (!health.ok) {
    console.error(`❌ API no responde: ${health.status}`);
    process.exit(1);
  }
  console.log(`✅ API responde\n`);

  const progress = await loadProgress();
  console.log(`📋 Progreso previo: ${Object.keys(progress).length} entradas\n`);

  const tStart = Date.now();
  const summary = { ready: 0, duplicate: 0, error: 0 };

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filepath = join(FOLDER_ABS, filename);
    console.log(`\n═══ [${i + 1}/${files.length}] ═══`);
    try {
      await processOne(filepath, progress);
      const e = progress[filename];
      if (e?.status === "READY") summary.ready++;
      else if (e?.status === "DUPLICATE") summary.duplicate++;
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`\n   ❌ ERROR: ${msg}`);
      const e = progress[filename] ?? { filename, fileHash: "", status: "PENDING" as const };
      e.status = "ERROR";
      e.error = msg;
      e.finishedAt = new Date().toISOString();
      progress[filename] = e;
      await saveProgress(progress);
      summary.error++;
    }
  }

  console.log(`\n\n═══════════════════════════════════════════════`);
  console.log(`📊 RESUMEN (${fmtMs(Date.now() - tStart)})`);
  console.log(`   ✅ READY:     ${summary.ready}`);
  console.log(`   ⏭️  DUPLICATE: ${summary.duplicate}`);
  console.log(`   ❌ ERROR:     ${summary.error}`);
  console.log(`═══════════════════════════════════════════════`);
  console.log(`📄 Progress: ${PROGRESS_FILE}\n`);

  if (summary.error > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\n💥 Fatal:", err);
  process.exit(1);
});
