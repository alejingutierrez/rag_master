import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";
import type { SearchResult } from "./vector-search";
import {
  buildContextBlock,
  getTemplateById,
  DEFAULT_TEMPLATE_ID,
} from "./chat-templates";

const bedrock = new BedrockRuntimeClient(awsConfig);

const CLAUDE_MODEL =
  process.env.BEDROCK_CLAUDE_MODEL_ID ||
  "us.anthropic.claude-opus-4-6-20250610-v1:0";

/**
 * Envía una pregunta a Claude con los chunks como contexto
 * Retorna un ReadableStream con la respuesta
 */
export async function askClaude(
  question: string,
  chunks: SearchResult[],
  maxTokens?: number,
  options?: { templateId?: string }
): Promise<ReadableStream<Uint8Array>> {
  const template = getTemplateById(options?.templateId ?? DEFAULT_TEMPLATE_ID);
  if (!template) {
    throw new Error(`Template not found: ${options?.templateId}`);
  }

  const contextBlock = buildContextBlock(chunks);
  const systemPrompt = template.buildSystemPrompt(contextBlock);
  const resolvedMaxTokens = maxTokens ?? template.maxTokens;

  const command = new ConverseStreamCommand({
    modelId: CLAUDE_MODEL,
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: "user",
        content: [{ text: question }],
      },
    ],
    inferenceConfig: {
      maxTokens: resolvedMaxTokens,
      temperature: template.temperature,
    },
  });

  // Retry con backoff exponencial para errores transitorios de Bedrock
  let response;
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      response = await bedrock.send(command);
      break;
    } catch (err) {
      const isRetryable =
        err instanceof Error &&
        (err.name === "ThrottlingException" ||
          err.name === "ModelStreamErrorException" ||
          err.name === "ModelTimeoutException" ||
          err.name === "ServiceUnavailableException" ||
          err.name === "InternalServerException" ||
          err.message.includes("throttl") ||
          err.message.includes("Too many requests") ||
          err.message.includes("timeout") ||
          err.message.includes("ECONNRESET") ||
          err.message.includes("socket hang up"));
      if (!isRetryable || attempt === MAX_RETRIES) throw err;
      const delay = Math.min(5000 * Math.pow(2, attempt), 30000);
      console.warn(
        `askClaude: Bedrock error (${err instanceof Error ? err.name : "unknown"}), ` +
        `retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  if (!response) throw new Error("No response from Bedrock after retries");

  // Convertir el stream de Bedrock a un ReadableStream web
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        if (response.stream) {
          for await (const event of response.stream) {
            if (event.contentBlockDelta?.delta?.text) {
              const text = event.contentBlockDelta.delta.text;
              // Formato SSE (Server-Sent Events)
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }

            if (event.messageStop) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
              );
            }
          }
        }
        controller.close();
      } catch (error) {
        console.error("askClaude stream error:", error);
        // Enqueue error info before closing so consumers know what happened
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Stream error" })}\n\n`)
          );
        } catch { /* already closed */ }
        controller.close();
      }
    },
  });
}
