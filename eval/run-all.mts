/**
 * Orquesta TODO el plan de evaluación end-to-end.
 *
 * Ejecuta en orden:
 *  F1: probes=20 sobre IVFFLAT (si está activo) o HNSW si ya se migró
 *  F2: HNSW (asume migración hecha)
 *  F5: BM25 híbrido (requiere content_fts)
 *  F6: + Reranker
 *  F7: + Query expansion (pipeline completo)
 *  F8: factualidad sobre pipeline completo
 *  F9: consistencia (determinismo + robustez + regresión)
 *
 * Genera eval/final-report.md con tabla comparativa de todas las fases.
 *
 * Uso:
 *   npx tsx eval/run-all.mts             # corre todo
 *   npx tsx eval/run-all.mts --skip f8   # saltar fase F8
 *   npx tsx eval/run-all.mts --from f5   # arrancar desde F5
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { EvalRun } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = resolve(__dirname, "runs");

const argv = process.argv.slice(2);
const SKIP = new Set((argv.includes("--skip") ? argv[argv.indexOf("--skip") + 1] : "").split(",").filter(Boolean));
const FROM = argv.includes("--from") ? argv[argv.indexOf("--from") + 1] : null;

interface Phase {
  id: string;
  label: string;
  cmd: string[];
  estimatedMin: number;
}

const PHASES: Phase[] = [
  {
    id: "f1",
    label: "F1: Quick wins (probes=20)",
    cmd: ["npx", "tsx", "eval/run-retrieval-eval.mts", "--tag", "f1-probes20", "--probes", "20", "--topK", "100", "--threshold", "0.25"],
    estimatedMin: 5,
  },
  {
    id: "f2",
    label: "F2: HNSW",
    cmd: ["npx", "tsx", "eval/run-retrieval-eval.mts", "--tag", "f2-hnsw", "--ef-search", "200", "--topK", "100", "--threshold", "0.25"],
    estimatedMin: 5,
  },
  {
    id: "f5",
    label: "F5: BM25 híbrido",
    cmd: ["npx", "tsx", "eval/run-pipeline-eval.mts", "--tag", "f5-hybrid", "--table", "chunks"],
    estimatedMin: 7,
  },
  {
    id: "f6",
    label: "F6: + Reranker",
    cmd: ["npx", "tsx", "eval/run-pipeline-eval.mts", "--tag", "f6-rerank", "--reranker", "--table", "chunks"],
    estimatedMin: 15,
  },
  {
    id: "f7",
    label: "F7: + Query expansion (pipeline completo)",
    cmd: ["npx", "tsx", "eval/run-pipeline-eval.mts", "--tag", "f7-full", "--reranker", "--query-expansion", "--table", "chunks"],
    estimatedMin: 25,
  },
  {
    id: "f9-determ",
    label: "F9.1: Determinismo (5 runs por pregunta)",
    cmd: ["npx", "tsx", "eval/run-consistency-eval.mts", "--determinism", "5", "--table", "chunks"],
    estimatedMin: 15,
  },
  {
    id: "f9-robust",
    label: "F9.2: Robustez (paráfrasis)",
    cmd: ["npx", "tsx", "eval/run-consistency-eval.mts", "--robustness", "--table", "chunks"],
    estimatedMin: 10,
  },
];

function exec(cmd: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolveProm) => {
    const p = spawn(cmd[0], cmd.slice(1), { cwd: resolve(__dirname, "..") });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (b: Buffer) => {
      const s = b.toString();
      stdout += s;
      process.stdout.write(s);
    });
    p.stderr.on("data", (b: Buffer) => { stderr += b.toString(); });
    p.on("close", (code) => resolveProm({ code: code ?? 0, stdout, stderr }));
  });
}

function loadLatestRun(tag: string): EvalRun | null {
  const files = readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith(".json") && f.startsWith(`${tag}-`))
    .map((f) => ({ f, m: statSync(resolve(RUNS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  if (files.length === 0) return null;
  return JSON.parse(readFileSync(resolve(RUNS_DIR, files[0].f), "utf8"));
}

async function main() {
  console.log(`\n🚀 Ejecutando plan completo de eval\n`);
  console.log(`   Fases: ${PHASES.length}`);
  console.log(`   Skip: ${[...SKIP].join(", ") || "(ninguna)"}`);
  console.log(`   From: ${FROM || "(F1)"}`);
  console.log(`   Tiempo total estimado: ${PHASES.reduce((a, p) => a + p.estimatedMin, 0)} min\n`);

  const tStart = Date.now();
  let started = !FROM;

  for (const phase of PHASES) {
    if (FROM && phase.id === FROM) started = true;
    if (!started) {
      console.log(`⏭️  Saltando ${phase.id} (--from ${FROM})`);
      continue;
    }
    if (SKIP.has(phase.id)) {
      console.log(`⏭️  Saltando ${phase.id} (--skip)`);
      continue;
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log(`▶  ${phase.label}`);
    console.log(`   ETA: ~${phase.estimatedMin} min`);
    console.log(`${"═".repeat(60)}\n`);

    const t0 = Date.now();
    const result = await exec(phase.cmd);
    const dt = ((Date.now() - t0) / 60000).toFixed(1);

    if (result.code !== 0) {
      console.error(`\n❌ ${phase.id} FALLÓ (exit ${result.code}) — continuando con siguientes fases\n`);
    } else {
      console.log(`\n✅ ${phase.id} completado en ${dt} min\n`);
    }
  }

  // Generar reporte final
  console.log(`\n${"═".repeat(60)}`);
  console.log(`📝 Generando reporte final...`);
  console.log(`${"═".repeat(60)}\n`);

  const phases: Array<{ id: string; label: string; run: EvalRun | null }> = [];
  const allPhases: Array<{ id: string; label?: string }> = [
    { id: "baseline", label: "Baseline" },
    ...PHASES,
  ];
  for (const p of allPhases) {
    phases.push({ id: p.id, label: p.label ?? p.id, run: loadLatestRun(p.id) });
  }

  const report = generateFinalReport(phases);
  const reportPath = resolve(__dirname, "final-report.md");
  writeFileSync(reportPath, report);
  console.log(`💾 Reporte: ${reportPath}\n`);

  const totalMin = ((Date.now() - tStart) / 60000).toFixed(1);
  console.log(`✅ Plan completo terminado en ${totalMin} min\n`);
}

function generateFinalReport(phases: Array<{ id: string; label: string; run: EvalRun | null }>): string {
  const lines: string[] = [];
  lines.push(`# Final Report — Plan de remediación RAG`);
  lines.push(``);
  lines.push(`**Fecha**: ${new Date().toISOString()}`);
  lines.push(`**Golden set**: 30 preguntas`);
  lines.push(``);
  lines.push(`## Resumen por fase`);
  lines.push(``);
  lines.push(`| Fase | P@5 | P@10 | Recall@50 | MRR | Latencia |`);
  lines.push(`|---|---|---|---|---|---|`);

  for (const p of phases) {
    if (!p.run) {
      lines.push(`| ${p.label} | _no run_ | | | | |`);
      continue;
    }
    const s = p.run.summary;
    lines.push(`| ${p.label} | ${(s.avgPrecisionAt5 * 100).toFixed(1)}% | ${(s.avgPrecisionAt10 * 100).toFixed(1)}% | ${(s.avgRecallAt50 * 100).toFixed(1)}% | ${s.avgMRR.toFixed(3)} | ${(s.avgLatencyMs / 1000).toFixed(1)}s |`);
  }

  lines.push(``);
  lines.push(`## Targets`);
  lines.push(``);
  lines.push(`| Métrica | Target | ¿Logrado? |`);
  lines.push(`|---|---|---|`);

  const lastPhase = phases.filter((p) => p.run).pop();
  if (lastPhase?.run) {
    const s = lastPhase.run.summary;
    lines.push(`| P@5 ≥ 90% | 90% | ${s.avgPrecisionAt5 >= 0.9 ? "✅" : "❌"} (${(s.avgPrecisionAt5 * 100).toFixed(1)}%) |`);
    lines.push(`| MRR ≥ 0.92 | 0.92 | ${s.avgMRR >= 0.92 ? "✅" : "❌"} (${s.avgMRR.toFixed(3)}) |`);
  }

  lines.push(``);
  lines.push(`## Per-fase: fallos completos (P@5 = 0)`);
  lines.push(``);
  for (const p of phases) {
    if (!p.run) continue;
    const fails = p.run.retrieval.filter((m) => m.relevantInTopK.k5 === 0);
    lines.push(`### ${p.label}`);
    if (fails.length === 0) {
      lines.push(`- (ninguno)`);
    } else {
      for (const f of fails) {
        lines.push(`- **[${f.questionId}]** ${f.question.substring(0, 90)}`);
      }
    }
    lines.push(``);
  }

  return lines.join("\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
