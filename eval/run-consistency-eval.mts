/**
 * Pruebas de consistencia exhaustivas (Fase 9).
 *
 * Tres tipos:
 *  1. Determinismo: misma pregunta N veces → ¿qué tanto varían chunks y respuesta?
 *  2. Robustez: paráfrasis de cada pregunta → ¿retrieval similar?
 *  3. Estabilidad: comparar runs históricos → no-regression check
 *
 * Uso:
 *   npx tsx eval/run-consistency-eval.mts --determinism 5
 *   npx tsx eval/run-consistency-eval.mts --robustness
 *   npx tsx eval/run-consistency-eval.mts --regression eval/runs/baseline-X.json
 */
import "./load-env";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { prisma } from "../src/lib/prisma";
import { awsConfig } from "../src/lib/aws-config";
import { runRagPipeline } from "../src/lib/rag-pipeline";
import type { GoldenSet, EvalRun } from "./types";

const argv = process.argv.slice(2);
function arg(flag: string, def?: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i === -1) return def;
  return argv[i + 1] ?? def;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_SET_PATH = resolve(__dirname, "golden-set.json");
const RUNS_DIR = resolve(__dirname, "runs");
mkdirSync(RUNS_DIR, { recursive: true });

const DETERMINISM_N = Number(arg("--determinism", "0"));
const ROBUSTNESS = argv.includes("--robustness");
const REGRESSION_VS = arg("--regression");
const TABLE = (arg("--table", "chunks_v2") as "chunks" | "chunks_v2");

const bedrock = new BedrockRuntimeClient(awsConfig);

// ─── Test 1: Determinismo ─────────────────────────────────────────────

async function testDeterminism(n: number) {
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`🎲 DETERMINISMO (${n} ejecuciones por pregunta)`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  const goldenSet: GoldenSet = JSON.parse(readFileSync(GOLDEN_SET_PATH, "utf8"));
  const questions = goldenSet.questions.filter((q) => !q.should_fail_elegantly).slice(0, 5);

  const results: Array<{
    questionId: string;
    runs: Array<{ chunkIds: string[]; topSimilarity: number }>;
    uniqueChunksUnion: number;
    intersectionSize: number;
    stability: number; // 0-1, qué tan estables son los top-K
  }> = [];

  for (const q of questions) {
    process.stdout.write(`  [${q.id}] `);
    const runs: Array<{ chunkIds: string[]; topSimilarity: number }> = [];

    for (let i = 0; i < n; i++) {
      const r = await runRagPipeline(q.question, {
        tableName: TABLE,
        useBM25: true,
        useReranker: true,
        useQueryExpansion: true,
        useParentExpansion: false,
        finalTopK: 10,
      });
      runs.push({
        chunkIds: r.chunks.map((c) => c.id),
        topSimilarity: r.chunks[0]?.similarity ?? 0,
      });
      process.stdout.write(`.`);
    }

    // Calcular intersección de los top-10 entre todos los runs
    const allChunks = new Set<string>();
    for (const run of runs) {
      for (const id of run.chunkIds) allChunks.add(id);
    }
    const intersection = runs[0].chunkIds.filter((id) =>
      runs.every((r) => r.chunkIds.includes(id))
    );
    // Estabilidad = % de chunks que aparecen en TODOS los runs (sobre los del 1er run)
    const stability = runs[0].chunkIds.length > 0
      ? intersection.length / runs[0].chunkIds.length
      : 0;

    results.push({
      questionId: q.id,
      runs,
      uniqueChunksUnion: allChunks.size,
      intersectionSize: intersection.length,
      stability,
    });

    console.log(` stability=${(stability * 100).toFixed(0)}%  unique=${allChunks.size}  intersect=${intersection.length}/10`);
  }

  const avgStability = results.reduce((a, r) => a + r.stability, 0) / results.length;
  console.log(`\n  📊 Estabilidad promedio: ${(avgStability * 100).toFixed(1)}%`);
  console.log(`     (100% = los mismos top-10 chunks aparecen siempre)`);

  return { type: "determinism", n, results, avgStability };
}

// ─── Test 2: Robustez (paráfrasis) ────────────────────────────────────

async function generateParaphrases(question: string): Promise<string[]> {
  const cmd = new ConverseCommand({
    modelId: "us.anthropic.claude-sonnet-4-6",
    system: [{
      text: `Genera 3 paráfrasis de una pregunta. Mantén el sentido pero cambia palabras y estructura.
Output: JSON {"paraphrases": ["...", "...", "..."]}. NO incluyas otro texto.`,
    }],
    messages: [{ role: "user", content: [{ text: `Pregunta: ${question}\n\nJSON:` }] }],
    inferenceConfig: { maxTokens: 500, temperature: 0.7 },
  });
  const res = await bedrock.send(cmd);
  const text = res.output?.message?.content?.[0]?.text || "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    return JSON.parse(m[0]).paraphrases || [];
  } catch {
    return [];
  }
}

async function testRobustness() {
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`🔄 ROBUSTEZ (paráfrasis)`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  const goldenSet: GoldenSet = JSON.parse(readFileSync(GOLDEN_SET_PATH, "utf8"));
  // Subset diverso
  const subset = [
    goldenSet.questions.find((q) => q.id === "np_01")!,
    goldenSet.questions.find((q) => q.id === "co_07")!,
    goldenSet.questions.find((q) => q.id === "fe_01")!,
    goldenSet.questions.find((q) => q.id === "mh_01")!,
  ].filter(Boolean);

  const results: Array<{
    questionId: string;
    originalChunks: string[];
    paraphrasedRuns: Array<{ paraphrase: string; chunks: string[]; overlap: number }>;
    avgOverlap: number;
  }> = [];

  for (const q of subset) {
    process.stdout.write(`  [${q.id}] generando paráfrasis... `);
    const paraphrases = await generateParaphrases(q.question);
    if (paraphrases.length === 0) {
      console.log(`❌ no paraphrases`);
      continue;
    }
    console.log(`${paraphrases.length} paraphrases`);

    const orig = await runRagPipeline(q.question, {
      tableName: TABLE, useBM25: true, useReranker: true, useQueryExpansion: false, finalTopK: 10,
    });
    const origIds = orig.chunks.map((c) => c.id);
    console.log(`     original retrieved ${origIds.length} chunks`);

    const paraphrasedRuns: { paraphrase: string; chunks: string[]; overlap: number }[] = [];
    for (const p of paraphrases) {
      const r = await runRagPipeline(p, {
        tableName: TABLE, useBM25: true, useReranker: true, useQueryExpansion: false, finalTopK: 10,
      });
      const ids = r.chunks.map((c) => c.id);
      const overlap = ids.filter((id) => origIds.includes(id)).length;
      paraphrasedRuns.push({ paraphrase: p, chunks: ids, overlap });
      console.log(`     "${p.substring(0, 60)}" → overlap=${overlap}/10`);
    }

    const avgOverlap = paraphrasedRuns.reduce((a, r) => a + r.overlap, 0) / paraphrasedRuns.length;
    results.push({
      questionId: q.id,
      originalChunks: origIds,
      paraphrasedRuns,
      avgOverlap,
    });
  }

  const totalAvgOverlap = results.reduce((a, r) => a + r.avgOverlap, 0) / results.length;
  console.log(`\n  📊 Overlap promedio: ${totalAvgOverlap.toFixed(1)}/10`);
  console.log(`     (10 = paráfrasis recuperan exactamente los mismos chunks)`);

  return { type: "robustness", results, avgOverlap: totalAvgOverlap };
}

// ─── Test 3: Regresión ────────────────────────────────────────────────

async function testRegression(prevRunPath: string) {
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`📈 NO-REGRESSION CHECK vs ${prevRunPath}`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  const prevRun: EvalRun = JSON.parse(readFileSync(prevRunPath, "utf8"));

  // Correr el pipeline actual sobre las mismas preguntas
  console.log(`  Re-ejecutando ${prevRun.retrieval.length} preguntas con pipeline actual...`);

  const goldenSet: GoldenSet = JSON.parse(readFileSync(GOLDEN_SET_PATH, "utf8"));
  const regressions: Array<{ questionId: string; before: number; after: number }> = [];
  let improved = 0;
  let same = 0;
  let degraded = 0;

  for (const prev of prevRun.retrieval) {
    const q = goldenSet.questions.find((x) => x.id === prev.questionId);
    if (!q) continue;
    if (q.should_fail_elegantly) continue;

    const r = await runRagPipeline(q.question, {
      tableName: TABLE, useBM25: true, useReranker: true, useQueryExpansion: true, finalTopK: 10,
    });

    // Reuse relevance check
    const { isChunkRelevant, calculatePrecisionAtK } = await import("./metrics");
    const scores = r.chunks.map((c) => isChunkRelevant(c.content, q) ? 1 : 0);
    const currentP5 = calculatePrecisionAtK(scores, 5);

    const delta = currentP5 - prev.precisionAt5;
    if (delta > 0.05) improved++;
    else if (delta < -0.05) { degraded++; regressions.push({ questionId: q.id, before: prev.precisionAt5, after: currentP5 }); }
    else same++;

    process.stdout.write(`  [${q.id}] ${(prev.precisionAt5 * 100).toFixed(0)}% → ${(currentP5 * 100).toFixed(0)}% `);
    console.log(delta > 0.05 ? "✅" : delta < -0.05 ? "❌" : " =");
  }

  console.log(`\n  📊 Improved: ${improved}, Same: ${same}, Degraded: ${degraded}`);
  if (regressions.length > 0) {
    console.log(`\n  ⚠️  Regresiones:`);
    for (const r of regressions) {
      console.log(`     ${r.questionId}: ${(r.before * 100).toFixed(0)}% → ${(r.after * 100).toFixed(0)}%`);
    }
  }

  return { type: "regression", improved, same, degraded, regressions };
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const outputs: unknown[] = [];

  if (DETERMINISM_N > 0) {
    outputs.push(await testDeterminism(DETERMINISM_N));
  }
  if (ROBUSTNESS) {
    outputs.push(await testRobustness());
  }
  if (REGRESSION_VS) {
    outputs.push(await testRegression(REGRESSION_VS));
  }

  if (outputs.length === 0) {
    console.log("Usa --determinism N, --robustness, o --regression <run.json>");
    process.exit(1);
  }

  const ts = Date.now();
  const path = resolve(RUNS_DIR, `consistency-${ts}.json`);
  writeFileSync(path, JSON.stringify({ timestamp: new Date().toISOString(), tests: outputs }, null, 2));
  console.log(`\n💾 Guardado: ${path}\n`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
