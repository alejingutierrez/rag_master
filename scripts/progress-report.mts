/**
 * Reporte cada 5 min: progreso a nivel CHUNKS (no solo docs completos).
 * Permite ver avance real cuando throttling de Bedrock impide docs READY.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const BASE_URL = "https://fbrwkqtydz.us-east-1.awsapprunner.com";
const PROGRESS_FILE = resolve("tmp/rechunk-progress.json");
const TOTAL_DOCS = 583;
const TICK_MS = 5 * 60 * 1000;

const startMs = Date.now();
let prevTotalDone = -1;
let prevChunksReady = -1;

async function getCount(status: string): Promise<number> {
  try {
    const r = await fetch(`${BASE_URL}/api/documents?limit=1&status=${status}`);
    return (await r.json()).pagination?.total ?? 0;
  } catch {
    return -1;
  }
}

async function getProcessingProgress() {
  try {
    const r = await fetch(`${BASE_URL}/api/documents?limit=20&status=PROCESSING`);
    const d = await r.json();
    const docs = d.documents ?? [];
    let totalDone = 0;
    let totalPending = 0;
    const perDoc: { name: string; done: number; total: number }[] = [];
    for (const doc of docs) {
      try {
        const pr = await fetch(`${BASE_URL}/api/documents/${doc.id}/process`);
        const p = await pr.json();
        totalDone += p.processedChunks;
        totalPending += p.pendingChunks;
        perDoc.push({ name: doc.filename, done: p.processedChunks, total: p.totalChunks });
      } catch {}
    }
    return { totalDone, totalPending, perDoc, count: docs.length };
  } catch {
    return { totalDone: 0, totalPending: 0, perDoc: [], count: 0 };
  }
}

async function tick() {
  const [ready, processing, err] = await Promise.all([
    getCount("READY"),
    getCount("PROCESSING"),
    getCount("ERROR"),
  ]);

  let confirmedNew = 0;
  if (existsSync(PROGRESS_FILE)) {
    try {
      const p = JSON.parse(await readFile(PROGRESS_FILE, "utf8"));
      confirmedNew = Object.values(p).filter((e: any) => e.status === "READY").length;
    } catch {}
  }

  const prog = await getProcessingProgress();
  const docsAvanzando = prog.perDoc.filter((p) => p.done > 0).length;
  const docsEsperando = prog.perDoc.filter((p) => p.done === 0).length;

  // Delta de chunks procesados desde tick previo
  const chunksDelta = prevTotalDone >= 0 ? prog.totalDone - prevTotalDone : 0;
  const docsReadyDelta = prevChunksReady >= 0 ? ready - prevChunksReady : 0;
  prevTotalDone = prog.totalDone;
  prevChunksReady = ready;

  const elapsedMin = Math.round((Date.now() - startMs) / 60000);

  // Top 3 docs avanzando
  const topProgress = prog.perDoc
    .filter((p) => p.done > 0)
    .sort((a, b) => b.done / b.total - a.done / a.total)
    .slice(0, 3)
    .map((p) => `${p.name.slice(0, 25)}=${p.done}/${p.total}`)
    .join(" | ");

  console.log(
    `📊 ${confirmedNew}/583 NUEVO | READY=${ready} (Δ${docsReadyDelta >= 0 ? "+" : ""}${docsReadyDelta}) PROC=${processing} ERR=${err} | chunks proc'd=${prog.totalDone} (Δ${chunksDelta >= 0 ? "+" : ""}${chunksDelta}) pending=${prog.totalPending} | avanzando=${docsAvanzando} esperando=${docsEsperando} | ${elapsedMin}min` +
      (topProgress ? `\n   📈 ${topProgress}` : ""),
  );

  if (confirmedNew >= TOTAL_DOCS) {
    console.log(`🎉 COMPLETADO: ${TOTAL_DOCS}/${TOTAL_DOCS}`);
    process.exit(0);
  }
}

async function main() {
  await tick();
  while (true) {
    await new Promise((r) => setTimeout(r, TICK_MS));
    try {
      await tick();
    } catch (e) {
      console.log(`💥 ${(e as Error).message}`);
    }
  }
}

main();
