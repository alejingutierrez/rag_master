/**
 * QA monitor activo: cada N segundos, lee progress.json, calcula ETA real y
 * samplea un doc completado al azar para verificar métricas de calidad.
 *
 * Emite eventos en stdout (una línea por evento) para alimentar un Monitor.
 *
 * Uso: npx tsx scripts/qa-monitor.mts
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = "https://fbrwkqtydz.us-east-1.awsapprunner.com";
const PROGRESS_FILE = resolve("tmp/rechunk-progress.json");
const TOTAL_DOCS = 583;
const TICK_MS = 45_000;
const MIN_AVG_WORDS = 1500;
const MIN_WORDS_SMALL_CHUNK = 50;

interface ProgressEntry {
  id: string;
  filename: string;
  status: string;
  newChunks?: number;
  oldChunks?: number;
  durationMs?: number;
  finishedAt?: string;
  startedAt?: string;
}

async function loadProgress(): Promise<Record<string, ProgressEntry>> {
  if (!existsSync(PROGRESS_FILE)) return {};
  try {
    return JSON.parse(await readFile(PROGRESS_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function sampleDocQA(entry: ProgressEntry) {
  const res = await fetch(`${BASE_URL}/api/documents/${entry.id}`);
  if (!res.ok) return null;
  const data = await res.json();
  const chunks = data.document?.chunks ?? [];
  if (chunks.length === 0) return null;
  const sizes = chunks.map((c: { content: string }) => c.content.split(/\s+/).length);
  return {
    count: chunks.length,
    avg: Math.round(sizes.reduce((a: number, b: number) => a + b, 0) / sizes.length),
    min: Math.min(...sizes),
    max: Math.max(...sizes),
    smallChunks: sizes.filter((s: number) => s < MIN_WORDS_SMALL_CHUNK).length,
  };
}

function fmtS(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${s % 60}s`;
}

const startMs = Date.now();
let lastReady = 0;
let consecutiveStalls = 0;

async function tick() {
  const p = await loadProgress();
  const ready = Object.values(p).filter((e) => e.status === "READY").length;
  const err = Object.values(p).filter((e) => e.status === "ERROR").length;
  const elapsed = Math.round((Date.now() - startMs) / 1000);

  // Throughput basado en la corrida actual (excluye los 7 previos)
  const baseReady = 7;
  const newlyReady = ready - baseReady;
  const throughput = newlyReady > 0 ? newlyReady / elapsed : 0;
  const remaining = TOTAL_DOCS - ready;
  const etaS = throughput > 0 ? Math.round(remaining / throughput) : -1;
  const pct = Math.round((ready / TOTAL_DOCS) * 100);

  console.log(
    `📊 ${ready}/${TOTAL_DOCS} (${pct}%) | err ${err} | +${newlyReady} en ${fmtS(elapsed)} | tput ${throughput.toFixed(2)} docs/s | ETA ${etaS >= 0 ? fmtS(etaS) : "—"}`,
  );

  // Stall detection
  if (ready === lastReady && newlyReady > 0) {
    consecutiveStalls++;
    if (consecutiveStalls >= 3) {
      console.log(`⚠️ STALL: ${consecutiveStalls} ticks sin avance (${ready} READY)`);
    }
  } else {
    consecutiveStalls = 0;
  }
  lastReady = ready;

  // QA random sample
  const readyEntries = Object.values(p).filter(
    (e) => e.status === "READY" && (e.newChunks ?? 0) > 0,
  );
  if (readyEntries.length > 0) {
    const sample = readyEntries[Math.floor(Math.random() * readyEntries.length)];
    const qa = await sampleDocQA(sample);
    if (qa) {
      const flags: string[] = [];
      if (qa.avg < MIN_AVG_WORDS) flags.push(`avg=${qa.avg}<${MIN_AVG_WORDS}`);
      if (qa.smallChunks > 0) flags.push(`${qa.smallChunks} chunks <${MIN_WORDS_SMALL_CHUNK}w`);
      const tag = flags.length > 0 ? `⚠️ QA FAIL` : `🔍 QA OK`;
      console.log(
        `${tag} | ${sample.filename.slice(0, 40)} | chunks=${qa.count} avg=${qa.avg}w min=${qa.min} max=${qa.max}${flags.length > 0 ? " | " + flags.join(", ") : ""}`,
      );
    }
  }

  if (ready >= TOTAL_DOCS - 5) {
    console.log(`🎉 NEAR DONE: ${ready}/${TOTAL_DOCS} — terminando QA monitor`);
    process.exit(0);
  }
}

async function main() {
  console.log(`🚀 QA monitor activo — tick cada ${TICK_MS / 1000}s | objetivo ${TOTAL_DOCS} docs`);
  while (true) {
    try {
      await tick();
    } catch (e) {
      console.log(`💥 tick error: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}

main().catch((e) => {
  console.log(`💥 fatal: ${(e as Error).message}`);
  process.exit(1);
});
