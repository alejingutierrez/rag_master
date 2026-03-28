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
 * Genera un embedding para un texto usando Cohere Embed v4 (o Titan v2 como fallback)
 * Cohere v4: 1536 dimensiones, superior para contenido multilingüe
 * Titan v2: 1024 dimensiones
 */
export async function generateEmbedding(
  text: string,
  inputType: "search_document" | "search_query" = "search_document"
): Promise<number[]> {
  if (EMBEDDING_MODEL.includes("cohere")) {
    return generateCohereEmbedding(text, inputType);
  }
  return generateTitanEmbedding(text);
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
 * Genera embeddings en lote para múltiples textos
 */
export async function generateEmbeddings(
  texts: string[],
  inputType: "search_document" | "search_query" = "search_document"
): Promise<number[][]> {
  const embeddings: number[][] = [];
  const batchSize = 10;

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
