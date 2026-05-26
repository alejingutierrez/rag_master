/**
 * Monitor selectivo: solo emite eventos importantes (no spam).
 * - Cambios en cantidad de docs READY (cada incremento)
 * - QA FAIL (chunks chicos o avg<1500)
 * - Errores
 * - Cambios significativos en throttle rate
 * - Heartbeat cada 5 min
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = "https://fbrwkqtydz.us-east-1.awsapprunner.com";
const PROGRESS_FILE = resolve("tmp/rechunk-progress.json");
const TOTAL_DOCS = 583;
const TICK_MS = 30_000;
const HEARTBEAT_MS = 5 * 60 * 1000;

let lastReady = -1;
let lastErr = 0;
let lastHeartbeat = Date.now();
let startMs = Date.now();
let lastProcessing = -1;

async function getCount(status: string): Promise<number> {
  try {
    const r = await fetch(`${BASE_URL}/api/documents?limit=1&status=${status}`);
    const d = await r.json();
    return d.pagination?.total ?? 0;
  } catch {
    return -1;
  }
}

async function getDocSample(): Promise<{ ok: boolean; msg: string } | null> {
  if (!existsSync(PROGRESS_FILE)) return null;
  try {
    const p = JSON.parse(await readFile(PROGRESS_FILE, "utf8"));
    const readyEntries = Object.values(p).filter((e: any) => e.status === "READY" && e.newChunks);
    if (readyEntries.length === 0) return null;
    const sample: any = readyEntries[Math.floor(Math.random() * readyEntries.length)];
    const res = await fetch(`${BASE_URL}/api/documents/${sample.id}`);
    if (!res.ok) return null;
    const d = await res.json();
    const chunks = d.document?.chunks ?? [];
    if (chunks.length === 0) return null;
    const sizes = chunks.map((c: any) => c.content.split(/\s+/).length);
    const avg = Math.round(sizes.reduce((a: number, b: number) => a + b, 0) / sizes.length);
    const min = Math.min(...sizes);
    const fail = avg < 1500 || (min < 50 && chunks.length > 1);
    return {
      ok: !fail,
      msg: `${sample.filename.slice(0, 35)}: chunks=${chunks.length} avg=${avg}w min=${min}`,
    };
  } catch {
    return null;
  }
}

async function tick() {
  const [ready, processing, err] = await Promise.all([
    getCount("READY"),
    getCount("PROCESSING"),
    getCount("ERROR"),
  ]);

  const elapsedMin = Math.round((Date.now() - startMs) / 60000);

  // Cambio en READY → evento siempre
  if (ready !== lastReady && lastReady >= 0) {
    const delta = ready - lastReady;
    const pct = Math.round((ready / TOTAL_DOCS) * 100);
    console.log(`✅ +${delta} ready → ${ready}/${TOTAL_DOCS} (${pct}%) | proc=${processing} err=${err} | ${elapsedMin}min`);
  }

  // Errores nuevos
  if (err > lastErr) {
    console.log(`❌ +${err - lastErr} error → total ${err}`);
  }

  // Heartbeat cada 5 min sin cambios
  if (Date.now() - lastHeartbeat > HEARTBEAT_MS) {
    const qa = await getDocSample();
    const qaStr = qa ? ` | QA: ${qa.ok ? "OK" : "FAIL"} ${qa.msg}` : "";
    console.log(`💓 ${ready}/${TOTAL_DOCS} | proc=${processing} err=${err} | ${elapsedMin}min${qaStr}`);
    lastHeartbeat = Date.now();
  }

  // Cambio en processing significativo
  if (lastProcessing >= 0 && Math.abs(processing - lastProcessing) >= 3) {
    console.log(`🔧 processing ${lastProcessing} → ${processing}`);
  }

  lastReady = ready;
  lastErr = err;
  lastProcessing = processing;

  if (ready >= TOTAL_DOCS - 1) {
    console.log(`🎉 DONE: ${ready}/${TOTAL_DOCS}`);
    process.exit(0);
  }
}

async function main() {
  console.log(`🚀 QA selectivo activo`);
  while (true) {
    try {
      await tick();
    } catch (e) {
      console.log(`💥 ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}

main();
