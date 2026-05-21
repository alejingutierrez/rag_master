/**
 * Smoke test rápido del pipeline RAG.
 * Ejecuta UNA pregunta y muestra qué chunks/respuesta se obtienen.
 *
 * Útil para validar cada fase incremental sin correr todo el golden set.
 */
import { runRagPipeline } from "../src/lib/rag-pipeline";
import { prisma } from "../src/lib/prisma";

const Q = process.argv[2] || "cuentame la historia de Manuel Cepeda Vargas, el padre del senador Iván Cepeda";
const TABLE = (process.argv[3] || "chunks") as "chunks" | "chunks_v2";

async function main() {
  console.log(`\n🧪 Smoke test`);
  console.log(`   Q: "${Q}"`);
  console.log(`   table: ${TABLE}\n`);

  const flags = [
    { useBM25: false, useReranker: false, useQueryExpansion: false, useParentExpansion: false, label: "vector only" },
    { useBM25: true, useReranker: false, useQueryExpansion: false, useParentExpansion: false, label: "vector+BM25 (hybrid)" },
    { useBM25: true, useReranker: true, useQueryExpansion: false, useParentExpansion: false, label: "+ Cohere/Haiku rerank" },
    { useBM25: true, useReranker: true, useQueryExpansion: true, useParentExpansion: false, label: "+ query expansion" },
    { useBM25: true, useReranker: true, useQueryExpansion: true, useParentExpansion: true, label: "+ parent expansion (full)" },
  ];

  for (const f of flags) {
    console.log(`━━━ ${f.label} ━━━`);
    const t0 = Date.now();
    try {
      const r = await runRagPipeline(Q, {
        tableName: TABLE,
        useBM25: f.useBM25,
        useReranker: f.useReranker,
        useQueryExpansion: f.useQueryExpansion,
        useParentExpansion: f.useParentExpansion,
        finalTopK: 10,
      });
      const dt = Date.now() - t0;

      // Marcar relevantes (mención de Manuel Cepeda)
      const relevantCount = r.chunks.filter((c) =>
        /manuel cepeda|cepeda vargas|ivan cepeda|iván cepeda/i.test(c.content)
      ).length;

      console.log(`   ⏱  ${dt}ms | candidates=${r.metrics.totalCandidates} → final=${r.metrics.final} | relevantes (Cepeda): ${relevantCount}/${r.chunks.length}`);
      console.log(`   Latency desglose: qe=${r.metrics.latencyMs.queryExpansion ?? 0} emb=${r.metrics.latencyMs.embedding} ret=${r.metrics.latencyMs.retrieval} rr=${r.metrics.latencyMs.reranking ?? 0} pe=${r.metrics.latencyMs.parentExpansion ?? 0}`);

      console.log(`   Top 5 chunks:`);
      for (let i = 0; i < Math.min(5, r.chunks.length); i++) {
        const c = r.chunks[i];
        const isRel = /manuel cepeda|cepeda vargas/i.test(c.content);
        const mark = isRel ? "🎯" : "  ";
        console.log(`     ${mark} #${i + 1} sim=${c.similarity.toFixed(3)} | ${c.documentFilename?.substring(0, 60)} p.${c.pageNumber}`);
        console.log(`        "${c.content.substring(0, 150).replace(/\n/g, " ")}..."`);
      }
      console.log();
    } catch (e) {
      console.log(`   ❌ ERROR: ${(e as Error).message.substring(0, 150)}\n`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
