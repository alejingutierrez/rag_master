/**
 * Heartbeat cada 60s con estado completo del rechunk.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const BASE_URL = "https://fbrwkqtydz.us-east-1.awsapprunner.com";
const PROGRESS_FILE = resolve("tmp/rechunk-progress.json");
const TOTAL_DOCS = 583;
const TICK_MS = 60_000;

const startMs = Date.now();
let firstNew = -1;

async function getCount(status: string): Promise<number> {
  try {
    const r = await fetch(`${BASE_URL}/api/documents?limit=1&status=${status}`);
    return (await r.json()).pagination?.total ?? 0;
  } catch {
    return -1;
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
  if (firstNew < 0) firstNew = confirmedNew;
  const elapsedMin = (Date.now() - startMs) / 60000;
  const newlyDone = confirmedNew - firstNew;
  const docsPerMin = elapsedMin > 0 ? newlyDone / elapsedMin : 0;
  const remaining = TOTAL_DOCS - confirmedNew;
  const etaMin = docsPerMin > 0 ? Math.round(remaining / docsPerMin) : -1;
  const pct = Math.round((confirmedNew / TOTAL_DOCS) * 100);

  console.log(
    `📊 ${confirmedNew}/583 NUEVO (${pct}%) | proc=${processing} ready=${ready} err=${err} | +${newlyDone} en ${elapsedMin.toFixed(0)}min | tput=${docsPerMin.toFixed(1)}/min | ETA=${etaMin >= 0 ? etaMin + "min" : "—"}`,
  );

  if (confirmedNew >= TOTAL_DOCS) {
    console.log(`🎉 COMPLETADO`);
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
