/**
 * Pipeline RAG completo v2 con todas las mejoras:
 *
 *   Query
 *   → Query expansion (variations + HyDE) ────┐
 *   → Embedding paralelo de cada query        │
 *   → Búsqueda híbrida (HNSW + BM25 con RRF)  │
 *   → Fusión RRF entre queries                │
 *   → Cohere Rerank → top-30                  │  Fase 1+2+5+6+7
 *   → Claude Haiku judge → top-15             │
 *   → Expandir children a parents (top-15)    │
 *   → Claude Opus con prompt anti-alucinación │
 *
 * Cada paso es desactivable por flags para A/B testing.
 */
import { generateEmbedding } from "./bedrock";
import { hybridSearch } from "./hybrid-search";
import { searchSimilarChunks, type SearchResult } from "./vector-search";
import { rerankChunks } from "./reranker";
import { expandQuery, flattenQueries } from "./query-expansion";
import { prisma } from "./prisma";

export interface RagPipelineOptions {
  // Retrieval
  retrievalCandidates?: number; // top-K por retriever (100 default)
  vectorThreshold?: number;     // similitud mínima vectorial (0.20 default)
  documentIds?: string[];

  // Query expansion
  useQueryExpansion?: boolean;  // true default
  useHyDE?: boolean;            // true default

  // Hybrid
  useBM25?: boolean;            // true default
  tableName?: "chunks" | "chunks_v2"; // chunks_v2 default

  // Re-ranking
  useReranker?: boolean;        // true default
  rerankTopN?: number;          // 30 default (Cohere stage)
  finalTopK?: number;           // 15 default (Haiku stage)
  useHaikuJudge?: boolean;      // true default

  // Parent expansion
  useParentExpansion?: boolean; // true default
}

export interface RagResult {
  question: string;
  expandedQueries?: string[];
  chunks: SearchResult[];          // chunks finales para el LLM (parents si parent expansion)
  childChunks?: SearchResult[];    // children que originaron los matches
  metrics: {
    totalCandidates: number;
    afterRerank: number;
    final: number;
    latencyMs: {
      queryExpansion?: number;
      embedding: number;
      retrieval: number;
      reranking?: number;
      parentExpansion?: number;
      total: number;
    };
  };
}

const DEFAULTS: Required<Omit<RagPipelineOptions, "documentIds" | "tableName">> & {
  tableName: "chunks" | "chunks_v2";
  documentIds?: string[];
} = {
  retrievalCandidates: 150,    // 100→150 con Opus 4.7 (1M tokens permite más)
  vectorThreshold: 0.20,
  useQueryExpansion: true,
  useHyDE: true,
  useBM25: true,
  tableName: "chunks_v2",
  useReranker: true,
  rerankTopN: 80,              // Cohere reordena 80
  finalTopK: 80,               // Pasamos los 80 directos a Opus 4.7 (no Haiku judge)
  useHaikuJudge: true,
  useParentExpansion: true,
};

export async function runRagPipeline(
  question: string,
  options: RagPipelineOptions = {}
): Promise<RagResult> {
  const opts = { ...DEFAULTS, ...options };
  const t0 = Date.now();
  const latency: RagResult["metrics"]["latencyMs"] = { embedding: 0, retrieval: 0, total: 0 };

  // 1. Query expansion (si está habilitado)
  let queries: string[] = [question];
  let expandedQueries: string[] | undefined;
  if (opts.useQueryExpansion) {
    const tQe = Date.now();
    const exp = await expandQuery(question);
    queries = flattenQueries(exp);
    expandedQueries = queries.slice(1); // sin la original
    latency.queryExpansion = Date.now() - tQe;
    if (!opts.useHyDE && exp.hyde) {
      queries = queries.filter((q) => q !== exp.hyde);
    }
  }

  // 2. Embedding de cada query (concurrencia limitada para evitar throttling)
  const tEmb = Date.now();
  const embeddings: number[][] = [];
  const EMB_CONCURRENCY = 3;
  for (let i = 0; i < queries.length; i += EMB_CONCURRENCY) {
    const batch = queries.slice(i, i + EMB_CONCURRENCY);
    const batchEmbs = await Promise.all(
      batch.map((q) => generateEmbedding(q, "search_query"))
    );
    embeddings.push(...batchEmbs);
  }
  latency.embedding = Date.now() - tEmb;

  // 3. Retrieval híbrido paralelo para cada query
  const tRet = Date.now();
  const allResults: SearchResult[][] = await Promise.all(
    queries.map((q, i) =>
      opts.useBM25
        ? hybridSearch(embeddings[i], q, opts.retrievalCandidates, opts.vectorThreshold, opts.documentIds, opts.tableName)
        : searchSimilarChunks(embeddings[i], opts.retrievalCandidates, opts.vectorThreshold, opts.documentIds)
    )
  );
  latency.retrieval = Date.now() - tRet;

  // 4. Fusión RRF entre las queries
  const RRF_K = 60;
  const fused = new Map<string, { chunk: SearchResult; score: number }>();
  for (const results of allResults) {
    for (let i = 0; i < results.length; i++) {
      const c = results[i];
      const existing = fused.get(c.id);
      const score = 1 / (RRF_K + i + 1);
      if (existing) {
        existing.score += score;
      } else {
        fused.set(c.id, { chunk: c, score });
      }
    }
  }

  let candidates = Array.from(fused.values())
    .sort((a, b) => b.score - a.score)
    .map((x) => x.chunk);

  const totalCandidates = candidates.length;

  // 5. Re-ranking
  // Stack: vector + BM25 → top-150 → Cohere Rerank (cross-encoder) → top-80 → Opus 4.7
  // El Haiku judge intermedio está deshabilitado por defecto: Opus 4.7 hace su propia
  // selección final consciente desde los 80 chunks (es más smart que Haiku para esto).
  const safeFinalTopK = Number.isFinite(opts.finalTopK) && opts.finalTopK > 0 ? opts.finalTopK : 80;
  let afterRerank = candidates.length;
  if (opts.useReranker && candidates.length > safeFinalTopK) {
    const tRr = Date.now();
    candidates = await rerankChunks(question, candidates, {
      cohereTopN: safeFinalTopK,
      haikuTopK: safeFinalTopK,
      useHaikuJudge: false, // Opus 4.7 hace la selección final consciente
    });
    afterRerank = candidates.length;
    latency.reranking = Date.now() - tRr;
  } else {
    candidates = candidates.slice(0, safeFinalTopK);
  }

  // 6. Parent expansion (solo si estamos sobre chunks_v2 con esquema parent-child)
  let finalChunks = candidates;
  let childChunks: SearchResult[] | undefined;
  if (opts.useParentExpansion && opts.tableName === "chunks_v2" && candidates.length > 0) {
    const tPe = Date.now();
    childChunks = candidates;

    // Para cada child, obtener su parent
    const parentKeys = candidates
      .map((c) => ({ docId: c.documentId, parentIdx: (c.metadata as { parentIndex?: number })?.parentIndex }))
      .filter((p) => p.parentIdx !== undefined);

    if (parentKeys.length > 0) {
      const conditions = parentKeys
        .map((p) => `("documentId" = '${p.docId}' AND "parentIndex" = ${p.parentIdx})`)
        .join(" OR ");

      const parents = await prisma.$queryRawUnsafe<Array<{
        id: string;
        documentId: string;
        content: string;
        pageNumber: number;
        parentIndex: number;
        filename: string;
      }>>(
        `SELECT c.id, c."documentId", c.content, c."pageNumber", c."parentIndex", d.filename
         FROM chunks_v2 c JOIN documents d ON c."documentId" = d.id
         WHERE c."isParent" = true AND (${conditions})`
      );

      const parentMap = new Map<string, typeof parents[0]>();
      for (const p of parents) {
        parentMap.set(`${p.documentId}-${p.parentIndex}`, p);
      }

      // De-duplicar: si dos children comparten parent, usamos uno solo
      const seenParents = new Set<string>();
      finalChunks = [];
      for (const c of candidates) {
        const pIdx = (c.metadata as { parentIndex?: number })?.parentIndex;
        if (pIdx === undefined) {
          finalChunks.push(c);
          continue;
        }
        const key = `${c.documentId}-${pIdx}`;
        if (seenParents.has(key)) continue;
        seenParents.add(key);

        const parent = parentMap.get(key);
        if (parent) {
          finalChunks.push({
            id: parent.id,
            documentId: parent.documentId,
            content: parent.content,
            pageNumber: parent.pageNumber,
            chunkIndex: -1,
            similarity: c.similarity,
            metadata: { ...c.metadata, expandedFromChild: c.id, parentIndex: pIdx },
            documentFilename: parent.filename,
          });
        } else {
          finalChunks.push(c); // fallback
        }
      }
    }

    latency.parentExpansion = Date.now() - tPe;
  }

  latency.total = Date.now() - t0;

  return {
    question,
    expandedQueries,
    chunks: finalChunks,
    childChunks,
    metrics: {
      totalCandidates,
      afterRerank,
      final: finalChunks.length,
      latencyMs: latency,
    },
  };
}
