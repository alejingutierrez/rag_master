import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const EMBEDDING_MODEL =
  process.env.BEDROCK_EMBEDDING_MODEL_ID || "amazon.titan-embed-text-v2:0";

/**
 * Genera un embedding para un texto usando Amazon Titan Embeddings v2
 * Retorna un vector de 1024 dimensiones
 */
export async function generateEmbedding(text: string): Promise<number[]> {
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
 * Procesa secuencialmente para respetar rate limits
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const embeddings: number[][] = [];

  // Procesar en lotes de 10 para evitar rate limits
  const batchSize = 10;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((text) => generateEmbedding(text))
    );
    embeddings.push(...batchResults);
  }

  return embeddings;
}
