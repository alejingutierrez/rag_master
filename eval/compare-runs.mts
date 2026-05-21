/**
 * Compara dos runs de eval guardados y muestra tabla de diff.
 *
 * Uso:
 *   npx tsx eval/compare-runs.mts baseline-12345.json f1-quickwins-67890.json
 *   npx tsx eval/compare-runs.mts --latest 2   # compara los 2 más recientes
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { EvalRun } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = resolve(__dirname, "runs");

function loadRun(filename: string): EvalRun {
  const path = filename.startsWith("/") ? filename : resolve(RUNS_DIR, filename);
  return JSON.parse(readFileSync(path, "utf8"));
}

function listRuns(): string[] {
  return readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ f, m: statSync(resolve(RUNS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m)
    .map((x) => x.f);
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtDelta(curr: number, prev: number, asPercent = true): string {
  const d = curr - prev;
  const arrow = d > 0.001 ? "↑" : d < -0.001 ? "↓" : "=";
  const val = asPercent ? `${(d * 100).toFixed(1)}pp` : d.toFixed(3);
  return ` ${arrow}${val}`;
}

const argv = process.argv.slice(2);
let runA: EvalRun, runB: EvalRun;

if (argv[0] === "--latest") {
  const n = Number(argv[1] || "2");
  const files = listRuns().slice(0, n);
  if (files.length < 2) {
    console.error("Necesito al menos 2 runs guardados.");
    process.exit(1);
  }
  runA = loadRun(files[1]); // más antiguo
  runB = loadRun(files[0]); // más reciente
} else {
  if (argv.length < 2) {
    console.log("Runs disponibles:");
    for (const f of listRuns().slice(0, 10)) {
      const r = loadRun(f);
      console.log(`  ${f}  P@5=${pct(r.summary.avgPrecisionAt5)}  MRR=${r.summary.avgMRR.toFixed(3)}`);
    }
    console.log("\nUso: npx tsx eval/compare-runs.mts <run-A> <run-B>");
    process.exit(0);
  }
  runA = loadRun(argv[0]);
  runB = loadRun(argv[1]);
}

console.log(`\n📊 Comparando runs`);
console.log(`   A: ${runA.runId}  (${runA.timestamp})`);
console.log(`   B: ${runB.runId}  (${runB.timestamp})`);
console.log(`\n   A: ${JSON.stringify(runA.config, null, 0).substring(0, 150)}`);
console.log(`   B: ${JSON.stringify(runB.config, null, 0).substring(0, 150)}\n`);

console.log("┌───────────────────────────────────────────────────────────────┐");
console.log("│ Métrica         │   A      │   B      │  Delta              │");
console.log("├─────────────────┼──────────┼──────────┼─────────────────────┤");
const metrics: Array<[string, keyof typeof runA.summary]> = [
  ["P@5", "avgPrecisionAt5"],
  ["P@10", "avgPrecisionAt10"],
  ["Recall@50", "avgRecallAt50"],
  ["MRR", "avgMRR"],
];
for (const [label, key] of metrics) {
  const a = runA.summary[key] as number;
  const b = runB.summary[key] as number;
  const isMrr = key === "avgMRR";
  console.log(
    `│ ${label.padEnd(15)} │ ${(isMrr ? a.toFixed(3) : pct(a)).padStart(8)} │ ${(isMrr ? b.toFixed(3) : pct(b)).padStart(8)} │${fmtDelta(b, a, !isMrr).padEnd(20)} │`
  );
}
console.log(`│ Latencia avg    │ ${runA.summary.avgLatencyMs.toFixed(0).padStart(6)}ms │ ${runB.summary.avgLatencyMs.toFixed(0).padStart(6)}ms │ ${((runB.summary.avgLatencyMs - runA.summary.avgLatencyMs)).toFixed(0).padStart(5)}ms             │`);
console.log("└─────────────────┴──────────┴──────────┴─────────────────────┘");

// Por categoría
console.log("\n📂 Por categoría (P@5):");
const cats = new Set<string>();
for (const m of runA.retrieval) cats.add(m.category);
for (const m of runB.retrieval) cats.add(m.category);
for (const c of cats) {
  const a = runA.retrieval.filter((x) => x.category === c);
  const b = runB.retrieval.filter((x) => x.category === c);
  const aAvg = a.length > 0 ? a.reduce((s, x) => s + x.precisionAt5, 0) / a.length : 0;
  const bAvg = b.length > 0 ? b.reduce((s, x) => s + x.precisionAt5, 0) / b.length : 0;
  console.log(`   ${c.padEnd(20)} A=${pct(aAvg).padStart(6)}  B=${pct(bAvg).padStart(6)}${fmtDelta(bAvg, aAvg)}`);
}

// Per-question diff
const byIdA = new Map(runA.retrieval.map((m) => [m.questionId, m]));
const byIdB = new Map(runB.retrieval.map((m) => [m.questionId, m]));

console.log("\n🔍 Per-question P@5:");
const allIds = new Set([...byIdA.keys(), ...byIdB.keys()]);
const sorted = Array.from(allIds).sort();
const wins: string[] = [];
const losses: string[] = [];
const sames: string[] = [];
for (const id of sorted) {
  const a = byIdA.get(id);
  const b = byIdB.get(id);
  const aP = a?.precisionAt5 ?? 0;
  const bP = b?.precisionAt5 ?? 0;
  const d = bP - aP;
  const mark = d > 0.01 ? "✅" : d < -0.01 ? "❌" : "  ";
  const line = `   ${mark} [${id}] ${pct(aP).padStart(6)} → ${pct(bP).padStart(6)} (${d > 0 ? "+" : ""}${(d * 100).toFixed(1)}pp)`;
  if (d > 0.01) wins.push(line);
  else if (d < -0.01) losses.push(line);
  else sames.push(line);
}

console.log(`\n   Mejoras (${wins.length}):`);
for (const w of wins) console.log(w);
if (losses.length > 0) {
  console.log(`\n   Regresiones (${losses.length}):`);
  for (const l of losses) console.log(l);
}
console.log(`\n   Sin cambio: ${sames.length}`);
