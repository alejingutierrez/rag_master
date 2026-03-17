import { prisma } from "./prisma";

export interface SearchResult {
  id: string;
  documentId: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
  metadata: Record<string, unknown>;
  documentFilename?: string;
}

/**
 * Busca los chunks más similares a un vector de consulta usando cosine similarity
 * Usa pgvector con el operador <=> (distancia coseno)
 */
export async function searchSimilarChunks(
  queryEmbedding: number[],
  topK: number = 5,
  similarityThreshold: number = 0.7,
  documentIds?: string[]
): Promise<SearchResult[]> {
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  // Construir filtro de documentos si se especifica
  const documentFilter = documentIds?.length
    ? `AND c."documentId" IN (${documentIds.map((id) => `'${id}'`).join(",")})`
    : "";

  const results = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      documentId: string;
      content: string;
      pageNumber: number;
      chunkIndex: number;
      similarity: number;
      metadata: Record<string, unknown>;
      filename: string;
    }>
  >(
    `SELECT
      c.id,
      c."documentId",
      c.content,
      c."pageNumber",
      c."chunkIndex",
      c.metadata,
      d.filename,
      1 - (c.embedding <=> $1::vector) as similarity
    FROM chunks c
    JOIN documents d ON c."documentId" = d.id
    WHERE c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> $1::vector) >= $2
      ${documentFilter}
    ORDER BY c.embedding <=> $1::vector
    LIMIT $3`,
    embeddingStr,
    similarityThreshold,
    topK
  );

  return results.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    content: r.content,
    pageNumber: r.pageNumber,
    chunkIndex: r.chunkIndex,
    similarity: Number(r.similarity),
    metadata: r.metadata,
    documentFilename: r.filename,
  }));
}

/**
 * Guarda el embedding de un chunk en la base de datos
 */
export async function saveChunkEmbedding(
  chunkId: string,
  embedding: number[]
): Promise<void> {
  const embeddingStr = `[${embedding.join(",")}]`;
  await prisma.$executeRawUnsafe(
    `UPDATE chunks SET embedding = $1::vector WHERE id = $2`,
    embeddingStr,
    chunkId
  );
}

/**
 * Guarda embeddings para múltiples chunks en lote
 */
export async function saveChunkEmbeddings(
  chunkEmbeddings: Array<{ chunkId: string; embedding: number[] }>
): Promise<void> {
  for (const { chunkId, embedding } of chunkEmbeddings) {
    await saveChunkEmbedding(chunkId, embedding);
  }
}
