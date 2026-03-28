import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";

const bedrock = new BedrockRuntimeClient(awsConfig);

const EMBEDDING_MODEL =
  process.env.BEDROCK_EMBEDDING_MODEL_ID || "cohere.embed-v4:0";

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
        // Backoff exponencial: 2s, 4s, 8s, 16s
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.log(`Bedrock throttled, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
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
  const payload = {
    texts: [text],
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

  // Cohere v4 retorna embeddings.float[0], v3 retorna embeddings[0]
  if (responseBody.embeddings?.float) {
    return responseBody.embeddings.float[0];
  }
  return responseBody.embeddings[0];
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
 * Genera embeddings en lote — concurrencia reducida a 3 para evitar throttling
 */
export async function generateEmbeddings(
  texts: string[],
  inputType: "search_document" | "search_query" = "search_document"
): Promise<number[][]> {
  const embeddings: number[][] = [];
  const batchSize = 3; // Reducido de 10 a 3 para evitar throttling

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((text) => generateEmbedding(text, inputType))
    );
    embeddings.push(...batchResults);
  }

  return embeddings;
}

export { EMBEDDING_DIMENSIONS };
