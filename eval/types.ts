export interface GoldenQuestion {
  id: string;
  category: "nombres_propios" | "conceptos" | "fechas_eventos" | "multi_hop" | "vagas";
  question: string;
  expected_keywords: string[];
  expected_facts: string[];
  should_fail_elegantly?: boolean;
  expected_behavior?: string;
}

export interface GoldenSet {
  version: string;
  description: string;
  categories: Record<string, string>;
  questions: GoldenQuestion[];
}

export interface RetrievalMetrics {
  questionId: string;
  category: string;
  question: string;
  totalChunks: number;
  relevantInTopK: { k1: number; k3: number; k5: number; k10: number };
  bestSimilarity: number;
  relevanceScores: number[]; // 1 si el chunk es pertinente, 0 si no
  precisionAt5: number;
  precisionAt10: number;
  recallAt50: number;
  mrr: number; // Mean Reciprocal Rank
  latencyMs: number;
  chunksRetrieved: Array<{
    rank: number;
    similarity: number;
    documentFilename: string;
    pageNumber: number;
    content: string;
    isRelevant: boolean;
  }>;
}

export interface AnswerMetrics {
  questionId: string;
  category: string;
  question: string;
  answer: string;
  factsExpected: string[];
  factsFound: { fact: string; found: boolean; confidence: number }[];
  factualityScore: number; // % de expected_facts en la respuesta
  hallucinationCount: number; // # de claims no soportados por chunks
  answerLatencyMs: number;
  tokensIn: number;
  tokensOut: number;
}

export interface EvalRun {
  runId: string;
  timestamp: string;
  config: {
    topK: number;
    similarityThreshold: number;
    probes?: number;
    indexType: "ivfflat" | "hnsw";
    embeddingModel: string;
    chunkStrategy: string;
    chunkSize: number;
    chunkOverlap: number;
    rerankerEnabled: boolean;
    bm25Enabled: boolean;
    queryExpansionEnabled: boolean;
    answerModel: string;
    templateId: string;
  };
  retrieval: RetrievalMetrics[];
  answers?: AnswerMetrics[];
  summary: {
    avgPrecisionAt5: number;
    avgPrecisionAt10: number;
    avgRecallAt50: number;
    avgMRR: number;
    avgFactuality?: number;
    avgLatencyMs: number;
    totalCost?: number;
  };
}
