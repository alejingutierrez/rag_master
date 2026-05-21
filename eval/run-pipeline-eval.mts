/**
 * Eval del pipeline RAG completo (no solo retrieval).
 *
 * Diferencia con run-retrieval-eval.mts:
 *  - Usa el pipeline completo (hybrid + rerank + parent expansion)
 *  - Mide latencia desglosada por etapa
 *  - Soporta flags para A/B testing de cada componente
 *
 * Uso:
 *   npx tsx eval/run-pipeline-eval.mts --tag f5-hybrid                          # full pipeline (sin reranker)
 *   npx tsx eval/run-pipeline-eval.mts --tag f6-rerank --reranker               # con reranker
 *   npx tsx eval/run-pipeline-eval.mts --tag f7-full  --reranker --query-expansion
 *   npx tsx eval/run-pipeline-eval.mts --table chunks               # usa tabla legacy (default chunks_v2)
 */
import "./load-env";

// Prevenir crash silencioso por errores async no manejados
process.on("unhandledRejection", (reason) => {
  console.error("\n⚠️  unhandledRejection:", reason instanceof Error ? reason.message : reason);
});
process.on("uncaughtException", (err) => {
  console.error("\n⚠️  uncaughtException:", err.message);
});

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/lib/prisma";
import { runRagPipeline } from "../src/lib/rag-pipeline";
import {
  isChunkRelevant,
  calculatePrecisionAtK,
  calculateRecallAtK,
  calculateMRR,
  summarizeMetrics,
  summarizeByCategory,
} from "./metrics";
import type { GoldenSet, RetrievalMetrics, EvalRun } from "./types";

const argv = process.argv.slice(2);
function arg(flag: string, def?: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i === -1) return def;
  return argv[i + 1] ?? def;
}

const TAG = arg("--tag", "pipeline");
const TABLE = (arg("--table", "chunks_v2") as "chunks" | "chunks_v2");
const USE_BM25 = !argv.includes("--no-bm25");
const USE_RERANKER = argv.includes("--reranker");
const USE_QUERY_EXPANSION = argv.includes("--query-expansion");
const USE_PARENT_EXPANSION = !argv.includes("--no-parent-expansion");
const FINAL_K = Number(arg("--final-k", "15"));

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_SET_PATH = resolve(__dirname, "golden-set.json");
const RUNS_DIR = resolve(__dirname, "runs");
mkdirSync(RUNS_DIR, { recursive: true });

async function countRelevantInCorpus(question: { expected_keywords: string[]; should_fail_elegantly?: boolean }, table: string): Promise<number> {
  if (question.should_fail_elegantly || question.expected_keywords.length === 0) return 0;
  const strong = question.expected_keywords.find((k) => k.length >= 6 && /[A-ZÁ-Ú]/.test(k));
  if (!strong) return 0;
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*) as c FROM ${table} WHERE content ILIKE $1 AND embedding IS NOT NULL`,
    `%${strong}%`
  );
  return Number(rows[0].c);
}

async function main() {
  console.log(`\n🎯 RAG Pipeline Eval — tag="${TAG}"`);
  console.log(`   table=${TABLE} | bm25=${USE_BM25} | reranker=${USE_RERANKER} | query-exp=${USE_QUERY_EXPANSION} | parent=${USE_PARENT_EXPANSION} | k=${FINAL_K}\n`);

  const goldenSet: GoldenSet = JSON.parse(readFileSync(GOLDEN_SET_PATH, "utf8"));
  console.log(`📚 Golden set: ${goldenSet.questions.length} preguntas\n`);

  // Verificar tabla
  const exists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = $1) as exists`,
    TABLE
  );
  if (!exists[0].exists) {
    console.error(`❌ Tabla ${TABLE} no existe.`);
    process.exit(1);
  }

  const metrics: RetrievalMetrics[] = [];
  const latencyBreakdown: { qe: number[]; emb: number[]; ret: number[]; rr: number[]; pe: number[]; total: number[] } = {
    qe: [], emb: [], ret: [], rr: [], pe: [], total: [],
  };

  for (const q of goldenSet.questions) {
    console.log(`[${q.id}] ${q.question.substring(0, 60)}...`);

    // Pequeña pausa para evitar throttling acumulado en Bedrock
    await new Promise(r => setTimeout(r, 500));

    const t0 = Date.now();
    try {
      const result = await runRagPipeline(q.question, {
        tableName: TABLE,
        useBM25: USE_BM25,
        useReranker: USE_RERANKER,
        useQueryExpansion: USE_QUERY_EXPANSION,
        useParentExpansion: USE_PARENT_EXPANSION,
        finalTopK: FINAL_K,
      });

      const latencyMs = Date.now() - t0;
      latencyBreakdown.qe.push(result.metrics.latencyMs.queryExpansion || 0);
      latencyBreakdown.emb.push(result.metrics.latencyMs.embedding || 0);
      latencyBreakdown.ret.push(result.metrics.latencyMs.retrieval || 0);
      latencyBreakdown.rr.push(result.metrics.latencyMs.reranking || 0);
      latencyBreakdown.pe.push(result.metrics.latencyMs.parentExpansion || 0);
      latencyBreakdown.total.push(latencyMs);

      const relevanceScores: number[] = [];
      const chunksRetrieved = result.chunks.map((c, idx) => {
        const isRelevant = isChunkRelevant(c.content, q);
        relevanceScores.push(isRelevant ? 1 : 0);
        return {
          rank: idx + 1,
          similarity: Number(c.similarity),
          documentFilename: c.documentFilename || "",
          pageNumber: c.pageNumber,
          content: c.content.substring(0, 300),
          isRelevant,
        };
      });

      const totalRelevantInCorpus = await countRelevantInCorpus(q, TABLE);

      const m: RetrievalMetrics = {
        questionId: q.id,
        category: q.category,
        question: q.question,
        totalChunks: chunksRetrieved.length,
        relevantInTopK: {
          k1: relevanceScores.slice(0, 1).reduce((a, b) => a + b, 0),
          k3: relevanceScores.slice(0, 3).reduce((a, b) => a + b, 0),
          k5: relevanceScores.slice(0, 5).reduce((a, b) => a + b, 0),
          k10: relevanceScores.slice(0, 10).reduce((a, b) => a + b, 0),
        },
        bestSimilarity: chunksRetrieved[0]?.similarity ?? 0,
        relevanceScores,
        precisionAt5: calculatePrecisionAtK(relevanceScores, 5),
        precisionAt10: calculatePrecisionAtK(relevanceScores, 10),
        recallAt50: calculateRecallAtK(relevanceScores, totalRelevantInCorpus, 50),
        mrr: calculateMRR(relevanceScores),
        latencyMs,
        chunksRetrieved,
      };
      metrics.push(m);

      const mark = m.relevantInTopK.k5 > 0 ? "✅" : "❌";
      const stage = result.expandedQueries ? ` qe=${result.metrics.latencyMs.queryExpansion}ms` : "";
      console.log(`  → ${mark} P@5=${m.precisionAt5.toFixed(2)} cand=${result.metrics.totalCandidates}→${result.metrics.final} | ${latencyMs}ms${stage}`);
    } catch (e) {
      console.log(`❌ ERROR: ${(e as Error).message.substring(0, 80)}`);
      metrics.push({
        questionId: q.id,
        category: q.category,
        question: q.question,
        totalChunks: 0,
        relevantInTopK: { k1: 0, k3: 0, k5: 0, k10: 0 },
        bestSimilarity: 0,
        relevanceScores: [],
        precisionAt5: 0,
        precisionAt10: 0,
        recallAt50: 0,
        mrr: 0,
        latencyMs: Date.now() - t0,
        chunksRetrieved: [],
      });
    }
  }

  const summary = summarizeMetrics(metrics);
  const byCategory = summarizeByCategory(metrics);

  function avg(arr: number[]) { return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`📊 RESUMEN — ${TAG}`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`  Avg Precision@5  : ${(summary.avgPrecisionAt5 * 100).toFixed(1)}%`);
  console.log(`  Avg Precision@10 : ${(summary.avgPrecisionAt10 * 100).toFixed(1)}%`);
  console.log(`  Avg Recall@50    : ${(summary.avgRecallAt50 * 100).toFixed(1)}%`);
  console.log(`  Avg MRR          : ${summary.avgMRR.toFixed(3)}`);
  console.log(`  Avg Latency total: ${summary.avgLatencyMs.toFixed(0)}ms`);
  console.log(`\n  Latencia desglosada:`);
  console.log(`    Query expansion: ${avg(latencyBreakdown.qe).toFixed(0)}ms`);
  console.log(`    Embedding:       ${avg(latencyBreakdown.emb).toFixed(0)}ms`);
  console.log(`    Retrieval:       ${avg(latencyBreakdown.ret).toFixed(0)}ms`);
  console.log(`    Re-ranking:      ${avg(latencyBreakdown.rr).toFixed(0)}ms`);
  console.log(`    Parent expand:   ${avg(latencyBreakdown.pe).toFixed(0)}ms`);

  console.log(`\n  Por categoría:`);
  for (const [cat, s] of Object.entries(byCategory)) {
    console.log(`    ${cat.padEnd(20)} n=${s.n}  P@5=${(s.avgPrecisionAt5 * 100).toFixed(0)}%  MRR=${s.avgMRR.toFixed(3)}  ${s.avgLatencyMs.toFixed(0)}ms`);
  }

  const fails = metrics.filter((m) => m.relevantInTopK.k5 === 0 && !goldenSet.questions.find((q) => q.id === m.questionId)?.should_fail_elegantly);
  if (fails.length > 0) {
    console.log(`\n  ❌ Fallos completos (0 relevantes en top-5):`);
    for (const f of fails) {
      console.log(`     [${f.questionId}] best sim=${f.bestSimilarity.toFixed(3)} | ${f.question.substring(0, 80)}`);
    }
  }

  const run: EvalRun = {
    runId: `${TAG}-${Date.now()}`,
    timestamp: new Date().toISOString(),
    config: {
      topK: 100,
      similarityThreshold: 0.20,
      indexType: "hnsw",
      embeddingModel: process.env.BEDROCK_EMBEDDING_MODEL_ID || "cohere.embed-v4:0",
      chunkStrategy: TABLE === "chunks_v2" ? "FIXED-parent-child" : "FIXED",
      chunkSize: TABLE === "chunks_v2" ? 500 : 3000,
      chunkOverlap: TABLE === "chunks_v2" ? 100 : 750,
      rerankerEnabled: USE_RERANKER,
      bm25Enabled: USE_BM25,
      queryExpansionEnabled: USE_QUERY_EXPANSION,
      answerModel: process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-6-v1",
      templateId: "mini-ensayo",
    },
    retrieval: metrics,
    summary,
  };

  const outPath = resolve(RUNS_DIR, `${run.runId}.json`);
  writeFileSync(outPath, JSON.stringify(run, null, 2));
  console.log(`\n💾 Run guardado: eval/runs/${run.runId}.json\n`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
