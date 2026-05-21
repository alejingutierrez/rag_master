/**
 * Re-ranker multi-stage para chunks recuperados.
 *
 * Stage 1: Cohere Rerank v3.5 vía Bedrock (cross-encoder cheap, ~$2/M tokens)
 *          Re-puntúa top-100 → top-30 por relevancia real.
 *
 * Stage 2: Claude Haiku 4.5 como LLM judge sobre top-30
 *          Decide top-K final con razonamiento sobre la pregunta.
 *
 * El re-ranker es CRÍTICO porque el retrieval (vectorial + BM25) tiene buen recall
 * pero precisión limitada — muchos candidatos son tema-similares pero no responden la
 * pregunta. El cross-encoder ve query y chunk juntos, no embeddings independientes.
 */
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";
import { withBedrockSemaphore } from "./bedrock-semaphore";
import type { SearchResult } from "./vector-search";

const bedrock = new BedrockRuntimeClient(awsConfig);

const COHERE_RERANK_MODEL =
  process.env.BEDROCK_RERANK_MODEL_ID || "cohere.rerank-v3-5:0";
// Modelo del judge LLM. Default: Sonnet 4.6 (más smart que Haiku, ya habilitado en prod).
// Para velocidad/costo, override con: BEDROCK_JUDGE_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
const JUDGE_MODEL =
  process.env.BEDROCK_JUDGE_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0";

// ─── Stage 1: Cohere Rerank ──────────────────────────────────────────

/**
 * Cohere Rerank v3.5: cross-encoder que asigna score 0-1 a cada (query, chunk).
 * Soporta hasta ~1000 documentos por request.
 */
export async function cohereRerank(
  query: string,
  chunks: SearchResult[],
  topN: number = 30
): Promise<SearchResult[]> {
  if (chunks.length === 0) return [];
  if (chunks.length <= topN) {
    // Aún así corremos rerank para reordenar
  }

  const documents = chunks.map((c) =>
    c.content.length > 4000 ? c.content.substring(0, 4000) : c.content
  );

  const payload = {
    api_version: 2,
    query,
    documents,
    top_n: Math.min(topN, chunks.length),
  };

  try {
    const command = new InvokeModelCommand({
      modelId: COHERE_RERANK_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await bedrock.send(command);
    const body = JSON.parse(new TextDecoder().decode(response.body));

    // Cohere retorna: { results: [{ index, relevance_score }, ...] }
    const reranked: SearchResult[] = body.results.map(
      (r: { index: number; relevance_score: number }) => ({
        ...chunks[r.index],
        similarity: r.relevance_score, // Reemplazamos similarity con relevance del reranker
      })
    );

    return reranked;
  } catch (error) {
    console.warn("[reranker] Cohere Rerank no disponible, devolviendo top-N por similitud:", (error as Error).message);
    return chunks.slice(0, topN);
  }
}

// ─── Stage 2: Claude Haiku judge ─────────────────────────────────────

interface ChunkScore {
  index: number;
  score: number; // 0-10
  reason?: string;
}

/**
 * Claude Haiku como judge: para cada chunk, decide qué tan relevante es para la pregunta.
 * Más caro que Cohere Rerank pero entiende razonamiento complejo y multi-hop.
 */
export async function haikuJudgeRerank(
  query: string,
  chunks: SearchResult[],
  topK: number = 15
): Promise<SearchResult[]> {
  if (chunks.length === 0) return [];
  if (chunks.length <= topK) return chunks;

  // Construir lista numerada de chunks (truncados a 600 chars cada uno)
  const chunkLines = chunks.slice(0, 50).map((c, i) => {
    const truncated = c.content.length > 600 ? c.content.substring(0, 600) + "..." : c.content;
    return `[${i}] ${truncated}`;
  }).join("\n\n");

  const systemPrompt = `Eres un evaluador experto de relevancia para sistemas de búsqueda.
Tu tarea es calificar del 0 al 10 qué tan relevante es cada fragmento para responder una pregunta histórica específica.

Criterios:
- 10: el fragmento responde DIRECTAMENTE la pregunta con hechos concretos
- 7-9: el fragmento contiene información clave relacionada
- 4-6: el fragmento toca el tema pero no aporta hechos específicos
- 1-3: el fragmento menciona algo tangencialmente relacionado
- 0: el fragmento es irrelevante

Responde SOLO en formato JSON con la estructura:
{"scores": [{"index": 0, "score": 8}, {"index": 1, "score": 3}, ...]}

NO incluyas razonamiento. SOLO el JSON. Asegúrate de calificar TODOS los fragmentos numerados.`;

  const userPrompt = `PREGUNTA: ${query}

FRAGMENTOS A EVALUAR:
${chunkLines}

Califica cada fragmento del 0 al 10. JSON output:`;

  try {
    const response = await withBedrockSemaphore(async () => {
      const cmd = new ConverseCommand({
        modelId: JUDGE_MODEL,
        system: [{ text: systemPrompt }],
        messages: [{ role: "user", content: [{ text: userPrompt }] }],
        inferenceConfig: { maxTokens: 4000, temperature: 0.0 },
      });
      return await bedrock.send(cmd);
    });

    const text = response.output?.message?.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Haiku judge no devolvió JSON válido");

    const parsed: { scores: ChunkScore[] } = JSON.parse(jsonMatch[0]);

    // Reordenar chunks por score del judge
    const scoreMap = new Map<number, number>();
    for (const s of parsed.scores) {
      scoreMap.set(s.index, s.score);
    }

    const reranked = chunks
      .slice(0, 50)
      .map((c, i) => ({ chunk: c, score: scoreMap.get(i) ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((x) => ({ ...x.chunk, similarity: x.score / 10 })); // Normalizar a 0-1

    return reranked;
  } catch (error) {
    console.warn("[reranker] Haiku judge falló, devolviendo top-K original:", (error as Error).message);
    return chunks.slice(0, topK);
  }
}

// ─── Pipeline completo ───────────────────────────────────────────────

export interface RerankOptions {
  cohereTopN?: number;  // 30 default
  haikuTopK?: number;   // 15 default
  useHaikuJudge?: boolean; // true default (false = solo Cohere)
}

/**
 * Pipeline: top-100 → Cohere Rerank → top-30 → Haiku judge → top-K final.
 */
export async function rerankChunks(
  query: string,
  chunks: SearchResult[],
  opts: RerankOptions = {}
): Promise<SearchResult[]> {
  const { cohereTopN = 30, haikuTopK = 15, useHaikuJudge = true } = opts;

  // Stage 1
  const stage1 = await cohereRerank(query, chunks, cohereTopN);

  // Stage 2 (opcional)
  if (useHaikuJudge && stage1.length > haikuTopK) {
    return await haikuJudgeRerank(query, stage1, haikuTopK);
  }

  return stage1.slice(0, haikuTopK);
}
