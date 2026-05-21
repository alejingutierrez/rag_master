/**
 * Runner principal de evaluación del retriever.
 *
 * Uso:
 *   npx tsx eval/run-retrieval-eval.mts                 # Config actual de producción
 *   npx tsx eval/run-retrieval-eval.mts --probes 20     # Override probes IVFFLAT
 *   npx tsx eval/run-retrieval-eval.mts --topK 100 --threshold 0.25
 *   npx tsx eval/run-retrieval-eval.mts --tag baseline  # Etiqueta para guardar el report
 *
 * Salida: eval/runs/<tag>-<timestamp>.json + impresión por consola con tabla resumen.
 */
import "./load-env";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/lib/prisma";
import { generateEmbedding } from "../src/lib/bedrock";
import {
  isChunkRelevant,
  calculatePrecisionAtK,
  calculateRecallAtK,
  calculateMRR,
  summarizeMetrics,
  summarizeByCategory,
} from "./metrics";
import type { GoldenSet, RetrievalMetrics, EvalRun } from "./types";

// ─── Args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function getArg(flag: string, def?: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i === -1) return def;
  return argv[i + 1] ?? def;
}

const TOP_K = Number(getArg("--topK", "50"));
const THRESHOLD = Number(getArg("--threshold", "0.35"));
const PROBES = getArg("--probes") ? Number(getArg("--probes")) : undefined;
const EF_SEARCH = getArg("--ef-search") ? Number(getArg("--ef-search")) : undefined;
const TAG = getArg("--tag", "run");
const SAVE_CHUNKS = argv.includes("--save-chunks");

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_SET_PATH = resolve(__dirname, "golden-set.json");
const RUNS_DIR = resolve(__dirname, "runs");

mkdirSync(RUNS_DIR, { recursive: true });

// ─── Determine current index type ────────────────────────────────────
async function detectIndexType(): Promise<"ivfflat" | "hnsw"> {
  const rows = await prisma.$queryRawUnsafe<Array<{ indexdef: string }>>(
    `SELECT indexdef FROM pg_indexes
     WHERE tablename = 'chunks' AND indexname LIKE '%embedding%'`
  );
  for (const r of rows) {
    if (r.indexdef.toLowerCase().includes("hnsw")) return "hnsw";
  }
  return "ivfflat";
}

// ─── Total chunks relevantes en el corpus (para Recall) ──────────────
async function countRelevantInCorpus(question: { expected_keywords: string[]; should_fail_elegantly?: boolean }): Promise<number> {
  if (question.should_fail_elegantly || question.expected_keywords.length === 0) {
    return 0;
  }
  // Usa el primer keyword "fuerte" (>5 chars con mayúscula) como proxy
  const strong = question.expected_keywords.find(
    (k) => k.length >= 6 && /[A-ZÁ-Ú]/.test(k)
  );
  if (!strong) return 0;

  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*) as c FROM chunks WHERE content ILIKE $1 AND embedding IS NOT NULL`,
    `%${strong}%`
  );
  return Number(rows[0].c);
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🎯 RAG Retrieval Eval — tag="${TAG}"`);
  console.log(`   topK=${TOP_K}, threshold=${THRESHOLD}, probes=${PROBES ?? "default"}, ef_search=${EF_SEARCH ?? "default"}\n`);

  const goldenSet: GoldenSet = JSON.parse(readFileSync(GOLDEN_SET_PATH, "utf8"));
  console.log(`📚 Golden set: ${goldenSet.questions.length} preguntas\n`);

  const indexType = await detectIndexType();
  console.log(`📦 Índice detectado: ${indexType}\n`);

  // Setear probes/ef_search por la sesión Prisma
  if (PROBES !== undefined && indexType === "ivfflat") {
    await prisma.$executeRawUnsafe(`SET ivfflat.probes = ${PROBES}`);
    console.log(`   ✓ SET ivfflat.probes = ${PROBES}`);
  }
  if (EF_SEARCH !== undefined && indexType === "hnsw") {
    await prisma.$executeRawUnsafe(`SET hnsw.ef_search = ${EF_SEARCH}`);
    console.log(`   ✓ SET hnsw.ef_search = ${EF_SEARCH}`);
  }

  const metrics: RetrievalMetrics[] = [];

  for (const q of goldenSet.questions) {
    process.stdout.write(`  [${q.id}] ${q.question.substring(0, 60)}...  `);

    const t0 = Date.now();
    const emb = await generateEmbedding(q.question, "search_query");
    const embStr = `[${emb.join(",")}]`;

    // Re-setear probes/ef_search por si la conexión Prisma resetea entre queries
    if (PROBES !== undefined && indexType === "ivfflat") {
      await prisma.$executeRawUnsafe(`SET ivfflat.probes = ${PROBES}`);
    }
    if (EF_SEARCH !== undefined && indexType === "hnsw") {
      await prisma.$executeRawUnsafe(`SET hnsw.ef_search = ${EF_SEARCH}`);
    }

    const rows = await prisma.$queryRawUnsafe<Array<{
      filename: string;
      page: number;
      sim: number;
      content: string;
    }>>(
      `SELECT d.filename, c."pageNumber" as page,
              1 - (c.embedding <=> $1::vector) as sim,
              c.content
       FROM chunks c JOIN documents d ON c."documentId" = d.id
       WHERE c.embedding IS NOT NULL
         AND 1 - (c.embedding <=> $1::vector) >= ${THRESHOLD}
       ORDER BY c.embedding <=> $1::vector
       LIMIT ${TOP_K}`,
      embStr
    );
    const latencyMs = Date.now() - t0;

    const relevanceScores: number[] = [];
    const chunksRetrieved = rows.map((r, idx) => {
      const isRelevant = isChunkRelevant(r.content, q);
      relevanceScores.push(isRelevant ? 1 : 0);
      return {
        rank: idx + 1,
        similarity: Number(r.sim),
        documentFilename: r.filename,
        pageNumber: r.page,
        content: SAVE_CHUNKS ? r.content : r.content.substring(0, 200),
        isRelevant,
      };
    });

    const totalRelevantInCorpus = await countRelevantInCorpus(q);

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
    console.log(`${mark} P@5=${m.precisionAt5.toFixed(2)} | k1=${m.relevantInTopK.k1} k5=${m.relevantInTopK.k5} | bestSim=${m.bestSimilarity.toFixed(3)} | ${latencyMs}ms`);
  }

  const summary = summarizeMetrics(metrics);
  const byCategory = summarizeByCategory(metrics);

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`📊 RESUMEN — ${TAG}`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`  Avg Precision@5  : ${(summary.avgPrecisionAt5 * 100).toFixed(1)}%`);
  console.log(`  Avg Precision@10 : ${(summary.avgPrecisionAt10 * 100).toFixed(1)}%`);
  console.log(`  Avg Recall@50    : ${(summary.avgRecallAt50 * 100).toFixed(1)}%`);
  console.log(`  Avg MRR          : ${summary.avgMRR.toFixed(3)}`);
  console.log(`  Avg Latency      : ${summary.avgLatencyMs.toFixed(0)}ms`);

  console.log(`\n  Por categoría:`);
  for (const [cat, s] of Object.entries(byCategory)) {
    console.log(`    ${cat.padEnd(20)} n=${s.n}  P@5=${(s.avgPrecisionAt5 * 100).toFixed(0)}%  P@10=${(s.avgPrecisionAt10 * 100).toFixed(0)}%  MRR=${s.avgMRR.toFixed(3)}  ${s.avgLatencyMs.toFixed(0)}ms`);
  }

  // Top fallos
  const fails = metrics
    .filter((m) => m.relevantInTopK.k5 === 0 && !goldenSet.questions.find((q) => q.id === m.questionId)?.should_fail_elegantly)
    .map((m) => ({ id: m.questionId, q: m.question, sim: m.bestSimilarity }));

  if (fails.length > 0) {
    console.log(`\n  ❌ Fallos completos (0 relevantes en top-5):`);
    for (const f of fails) {
      console.log(`     [${f.id}] best sim=${f.sim.toFixed(3)} | ${f.q.substring(0, 80)}`);
    }
  }

  const run: EvalRun = {
    runId: `${TAG}-${Date.now()}`,
    timestamp: new Date().toISOString(),
    config: {
      topK: TOP_K,
      similarityThreshold: THRESHOLD,
      probes: PROBES,
      indexType,
      embeddingModel: process.env.BEDROCK_EMBEDDING_MODEL_ID || "cohere.embed-v4:0",
      chunkStrategy: "FIXED",
      chunkSize: 3000,
      chunkOverlap: 750,
      rerankerEnabled: false,
      bm25Enabled: false,
      queryExpansionEnabled: false,
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
