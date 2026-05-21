/**
 * Búsqueda híbrida: combina retrieval vectorial (HNSW/IVFFLAT) con BM25 (PostgreSQL FTS)
 * usando Reciprocal Rank Fusion (RRF).
 *
 * RRF: score(d) = Σ_q 1 / (k + rank_q(d))
 * - k=60 es el valor estándar de la literatura (Cormack et al., 2009)
 * - Tolerante a escalas diferentes de scores
 * - Funciona mejor cuando los retrievers son complementarios (vector + lexical)
 *
 * Vectorial recupera por significado semántico.
 * BM25 recupera por coincidencia léxica de términos raros (perfecto para nombres propios).
 */
import { prisma } from "./prisma";
import type { SearchResult } from "./vector-search";

const RRF_K = 60;
const HYBRID_CANDIDATE_K = 100; // top-K de cada retriever antes de fusionar

interface RankedCandidate {
  id: string;
  documentId: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  metadata: Record<string, unknown>;
  filename: string;
  similarity: number;       // de vector search (si aplica)
  bm25_score: number;       // de BM25 (si aplica)
  vector_rank?: number;
  bm25_rank?: number;
  rrf_score: number;
}

/**
 * Búsqueda híbrida: vectorial + BM25 con RRF.
 *
 * @param queryEmbedding embedding de la pregunta (search_query)
 * @param queryText      texto raw de la pregunta para BM25
 * @param topK           cuántos resultados finales devolver
 * @param threshold      similitud vectorial mínima (BM25 no se filtra por threshold)
 */
export async function hybridSearch(
  queryEmbedding: number[],
  queryText: string,
  topK: number = 100,
  threshold: number = 0.20,
  documentIds?: string[],
  tableName: "chunks" | "chunks_v2" = "chunks_v2"
): Promise<SearchResult[]> {
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const documentFilter = documentIds?.length
    ? `AND c."documentId" IN (${documentIds.map((id) => `'${id}'`).join(",")})`
    : "";

  // 1. Recuperar top-K candidatos del vector search
  const vectorCandidates = await prisma.$queryRawUnsafe<RankedCandidate[]>(
    `SELECT
       c.id,
       c."documentId",
       c.content,
       c."pageNumber",
       c."chunkIndex",
       c.metadata,
       d.filename,
       1 - (c.embedding <=> '${embeddingStr}'::vector) AS similarity,
       0::float AS bm25_score,
       ROW_NUMBER() OVER (ORDER BY c.embedding <=> '${embeddingStr}'::vector) AS vector_rank,
       NULL::bigint AS bm25_rank,
       0::float AS rrf_score
     FROM ${tableName} c
     JOIN documents d ON c."documentId" = d.id
     WHERE c.embedding IS NOT NULL
       AND 1 - (c.embedding <=> '${embeddingStr}'::vector) >= ${threshold}
       ${documentFilter}
     ORDER BY c.embedding <=> '${embeddingStr}'::vector
     LIMIT ${HYBRID_CANDIDATE_K}`
  );

  // 2. Recuperar top-K candidatos del BM25 (PostgreSQL FTS en español)
  // websearch_to_tsquery acepta sintaxis humana (frases, OR, comillas)
  const bm25Candidates = await prisma.$queryRawUnsafe<RankedCandidate[]>(
    `SELECT
       c.id,
       c."documentId",
       c.content,
       c."pageNumber",
       c."chunkIndex",
       c.metadata,
       d.filename,
       0::float AS similarity,
       ts_rank_cd(c.content_fts, q, 32) AS bm25_score,
       NULL::bigint AS vector_rank,
       ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.content_fts, q, 32) DESC) AS bm25_rank,
       0::float AS rrf_score
     FROM ${tableName} c
     JOIN documents d ON c."documentId" = d.id,
          websearch_to_tsquery('spanish', $1) q
     WHERE c.content_fts @@ q
       ${documentFilter}
     ORDER BY ts_rank_cd(c.content_fts, q, 32) DESC
     LIMIT ${HYBRID_CANDIDATE_K}`,
    queryText
  );

  // 3. Reciprocal Rank Fusion
  const fused = new Map<string, RankedCandidate>();

  for (const c of vectorCandidates) {
    const r = Number(c.vector_rank);
    fused.set(c.id, {
      ...c,
      vector_rank: r,
      bm25_rank: undefined,
      rrf_score: 1 / (RRF_K + r),
    });
  }

  for (const c of bm25Candidates) {
    const r = Number(c.bm25_rank);
    const existing = fused.get(c.id);
    if (existing) {
      existing.bm25_rank = r;
      existing.bm25_score = Number(c.bm25_score);
      existing.rrf_score += 1 / (RRF_K + r);
    } else {
      fused.set(c.id, {
        ...c,
        vector_rank: undefined,
        bm25_rank: r,
        rrf_score: 1 / (RRF_K + r),
      });
    }
  }

  // 4. Ordenar por RRF score, devolver top-K
  const sorted = Array.from(fused.values()).sort((a, b) => b.rrf_score - a.rrf_score);
  const top = sorted.slice(0, topK);

  // 5. Si los candidatos vienen de BM25 puro (sin embedding visto), necesitamos la similitud
  // real para reportarla — la podemos calcular pero por simplicidad usamos un proxy.
  const results: SearchResult[] = top.map((c) => ({
    id: c.id,
    documentId: c.documentId,
    content: c.content,
    pageNumber: c.pageNumber,
    chunkIndex: c.chunkIndex,
    similarity: Number(c.similarity) || (c.rrf_score * 100), // RRF score como fallback
    metadata: c.metadata,
    documentFilename: c.filename,
  }));

  return results;
}

/**
 * Conveniencia: solo BM25 (debug / comparación).
 */
export async function bm25Only(
  queryText: string,
  topK: number = 50,
  tableName: "chunks" | "chunks_v2" = "chunks_v2"
): Promise<SearchResult[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string;
    documentId: string;
    content: string;
    pageNumber: number;
    chunkIndex: number;
    metadata: Record<string, unknown>;
    filename: string;
    bm25_score: number;
  }>>(
    `SELECT c.id, c."documentId", c.content, c."pageNumber", c."chunkIndex",
            c.metadata, d.filename,
            ts_rank_cd(c.content_fts, q, 32) AS bm25_score
     FROM ${tableName} c
     JOIN documents d ON c."documentId" = d.id,
          websearch_to_tsquery('spanish', $1) q
     WHERE c.content_fts @@ q
     ORDER BY bm25_score DESC
     LIMIT ${topK}`,
    queryText
  );

  return rows.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    content: r.content,
    pageNumber: r.pageNumber,
    chunkIndex: r.chunkIndex,
    similarity: Number(r.bm25_score),
    metadata: r.metadata,
    documentFilename: r.filename,
  }));
}
