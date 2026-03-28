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
  topK: number = 200,
  similarityThreshold: number = 0.35,
  documentIds?: string[]
): Promise<SearchResult[]> {
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  // Construir filtro de documentos si se especifica
  const documentFilter = documentIds?.length
    ? `AND c."documentId" IN (${documentIds.map((id) => `'${id}'`).join(",")})`
    : "";

  // NOTA: Se interpola el vector directamente en el SQL porque Prisma $queryRawUnsafe
  // no castea correctamente parámetros posicionales ($1::vector) con el operador <=>
  // de pgvector. El UPDATE (SET embedding = $1::vector) funciona, pero el SELECT con
  // comparación <=> retorna 0 resultados cuando se usa parámetro posicional.
  // El similarityThreshold y topK sí se pasan como parámetros seguros.
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
      1 - (c.embedding <=> '${embeddingStr}'::vector) as similarity
    FROM chunks c
    JOIN documents d ON c."documentId" = d.id
    WHERE c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> '${embeddingStr}'::vector) >= $1
      ${documentFilter}
    ORDER BY c.embedding <=> '${embeddingStr}'::vector
    LIMIT $2`,
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
