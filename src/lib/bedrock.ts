import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";

const bedrock = new BedrockRuntimeClient(awsConfig);

// IMPORTANTE: Cohere Embed v4 requiere cross-region inference profile (us.*).
// Sin el prefijo `us.`, AWS throttles brutalmente (cuota mínima sin perfil).
// Con inference profile: 2000 RPM, 300k tokens/min (cuota estándar).
const EMBEDDING_MODEL = (() => {
  const raw = process.env.BEDROCK_EMBEDDING_MODEL_ID || "us.cohere.embed-v4:0";
  // Normalizar: si es Cohere v4 sin prefijo, agregar `us.` para evitar throttle
  if (raw === "cohere.embed-v4:0") return "us.cohere.embed-v4:0";
  return raw;
})();

// ────────────────────────────────────────────────────────────────────────
// Semáforo GLOBAL para llamadas a Bedrock embeddings.
//
// Cohere v4 en Bedrock tiene un rate limit estricto (tokens/sec). Cuando
// hay múltiples docs procesando en paralelo en el mismo servidor, cada uno
// con su propio embedding-processor, todos llaman a Bedrock simultáneamente
// y saturan la cuota. Este semáforo limita a MAX_CONCURRENT_EMBEDDINGS
// llamadas en vuelo GLOBALMENTE, sin importar cuántos docs estén procesando.
// ────────────────────────────────────────────────────────────────────────
// Empíricamente con semaforo=4 vimos throttle catastrófico (372/min, backoffs
// 40-321s). Bajamos a 2 para dar tiempo al bucket de tokens de Bedrock.
// 2 calls x 8 texts x 2500 tokens = 40k tokens in flight, 300k/min cuota.
const MAX_CONCURRENT_EMBEDDINGS = Number(
  process.env.BEDROCK_EMBEDDINGS_CONCURRENCY || "2"
);

let activeEmbeddingCalls = 0;
const embeddingWaitQueue: Array<() => void> = [];

async function acquireEmbeddingSlot(): Promise<void> {
  if (activeEmbeddingCalls < MAX_CONCURRENT_EMBEDDINGS) {
    activeEmbeddingCalls++;
    return;
  }
  await new Promise<void>((resolve) => embeddingWaitQueue.push(resolve));
  activeEmbeddingCalls++;
}

function releaseEmbeddingSlot(): void {
  activeEmbeddingCalls--;
  const next = embeddingWaitQueue.shift();
  if (next) next();
}

// Cohere v4 usa 1536 dimensiones, Titan v2 usa 1024
const EMBEDDING_DIMENSIONS = EMBEDDING_MODEL.includes("cohere") ? 1536 : 1024;

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Genera un embedding con retry automático ante throttling
 */
export async function generateEmbedding(
  text: string,
  inputType: "search_document" | "search_query" = "search_document"
): Promise<number[]> {
  // NOTE: Embeddings (Cohere) have separate rate limits from Claude Opus
  // in Bedrock, so they do NOT share the Claude semaphore. They use their
  // own retry with backoff.
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (EMBEDDING_MODEL.includes("cohere")) {
        return await generateCohereEmbedding(text, inputType);
      }
      return await generateTitanEmbedding(text);
    } catch (error: unknown) {
      const isThrottled =
        error instanceof Error &&
        (error.name === "ThrottlingException" ||
          error.message.includes("Too many tokens") ||
          error.message.includes("throttl"));

      if (isThrottled && attempt < MAX_RETRIES - 1) {
        // Backoff exponencial: 5s, 10s, 20s, 40s + jitter
        const delay = Math.pow(2, attempt) * 5000 + Math.random() * 3000;
        console.log(`Embedding throttled, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded for embedding generation");
}

/**
 * Cohere Embed v4 — mejor para español y contenido académico
 */
async function generateCohereEmbedding(
  text: string,
  inputType: "search_document" | "search_query"
): Promise<number[]> {
  const result = await generateCohereEmbeddingsBatch([text], inputType);
  return result[0];
}

/**
 * Cohere Embed v4 BATCH — acepta hasta 96 texts por request.
 * Drásticamente reduce el número de llamadas a Bedrock y el throttling.
 * Usa semáforo global para evitar saturar la cuota de Bedrock.
 */
async function generateCohereEmbeddingsBatch(
  texts: string[],
  inputType: "search_document" | "search_query"
): Promise<number[][]> {
  await acquireEmbeddingSlot();
  try {
    const payload = {
      texts,
      input_type: inputType,
      truncate: "END",
    };

    const command = new InvokeModelCommand({
      modelId: EMBEDDING_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    if (responseBody.embeddings?.float) {
      return responseBody.embeddings.float as number[][];
    }
    return responseBody.embeddings as number[][];
  } finally {
    releaseEmbeddingSlot();
  }
}

/**
 * Amazon Titan Embed v2 — fallback
 */
async function generateTitanEmbedding(text: string): Promise<number[]> {
  const payload = {
    inputText: text,
    dimensions: 1024,
    normalize: true,
  };

  const command = new InvokeModelCommand({
    modelId: EMBEDDING_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.embedding;
}

/**
 * Genera embeddings en lote — usa el batching NATIVO de Cohere v4 (96 texts/request).
 * Una sola llamada a Bedrock por batch, retornando todos los embeddings juntos.
 * Reduce ~10x el número de llamadas a Bedrock vs llamadas individuales.
 */
export async function generateEmbeddings(
  texts: string[],
  inputType: "search_document" | "search_query" = "search_document"
): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Batch=8: ~20k tokens/request. Con semaforo=4 = 80k tokens in flight.
  // Cuota cross-region: 300k tokens/min, dejando margen para sostener.
  const BATCH_SIZE = 8;
  const MAX_RETRIES = 5;

  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    let lastError: unknown;
    let success = false;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const isCohere = EMBEDDING_MODEL.includes("cohere");
        if (isCohere) {
          const batchResults = await generateCohereEmbeddingsBatch(batch, inputType);
          embeddings.push(...batchResults);
        } else {
          // Titan no soporta batch — caer a llamadas individuales
          const batchResults = await Promise.all(batch.map((t) => generateTitanEmbedding(t)));
          embeddings.push(...batchResults);
        }
        success = true;
        break;
      } catch (error: unknown) {
        lastError = error;
        const isThrottled =
          error instanceof Error &&
          (error.name === "ThrottlingException" ||
            error.message.includes("Too many tokens") ||
            error.message.includes("throttl"));
        if (isThrottled && attempt < MAX_RETRIES - 1) {
          const delay = Math.pow(2, attempt) * 4000 + Math.random() * 2000;
          console.log(
            `Embedding batch throttled (size=${batch.length}), retrying in ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1}/${MAX_RETRIES})`
          );
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }
    if (!success) throw lastError ?? new Error("Embedding batch failed");
  }

  return embeddings;
}

export { EMBEDDING_DIMENSIONS };
