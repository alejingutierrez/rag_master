import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";
import type { SearchResult } from "./vector-search";
import {
  buildContextBlock,
  buildReferencesSection,
  getTemplateById,
  DEFAULT_TEMPLATE_ID,
} from "./chat-templates";
import { withBedrockSemaphore } from "./bedrock-semaphore";

const bedrock = new BedrockRuntimeClient(awsConfig);

const CLAUDE_MODEL =
  process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-7";

/**
 * Directiva de identidad/autoría que se ANEXA a todo system prompt (chat y el
 * paper de deep-research, que también pasa por aquí). Blinda la salida contra
 * autorreferencia de modelo o mención de proveedor — la pieza es de autor.
 */
const IDENTIDAD_AUTORIA = `

---

## IDENTIDAD Y AUTORÍA (OBLIGATORIO)

- NUNCA te refieras a ti mismo como modelo, IA o asistente, ni menciones proveedores o nombres de modelos (Anthropic, Claude, Opus, OpenAI, GPT, Gemini, Bedrock, etc.). Esto incluye notas, descargos o firmas del tipo "generado por", "como modelo de lenguaje" o "Usa Anthropic Claude…".
- Escribe como autor humano. La autoría editorial corresponde a **Alejandro Gutiérrez** y la asigna el sistema, no tú: NO firmes ni añadas una línea de autoría al final.
- Entrega únicamente el contenido solicitado, sin metacomentarios sobre cómo, con qué herramienta o por qué fue producido.`;

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
  const systemPrompt = template.buildSystemPrompt(contextBlock) + IDENTIDAD_AUTORIA;
  const resolvedMaxTokens = maxTokens ?? template.maxTokens;

  // Opus 4.7 y posteriores son "thinking models" y NO aceptan temperature
  // (lanzan ValidationException: "temperature is deprecated for this model").
  // Detectamos por nombre del modelo. Para modelos viejos seguimos pasando temperature.
  const isThinkingModel = /claude-(opus|sonnet)-(4-7|4-8|5)/.test(CLAUDE_MODEL);
  const inferenceConfig: { maxTokens: number; temperature?: number } = {
    maxTokens: resolvedMaxTokens,
  };
  if (!isThinkingModel) {
    inferenceConfig.temperature = template.temperature;
  }

  const command = new ConverseStreamCommand({
    modelId: CLAUDE_MODEL,
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: "user",
        content: [{ text: question }],
      },
    ],
    inferenceConfig,
  });

  // Serializar acceso a Bedrock + retry con backoff exponencial
  const response = await withBedrockSemaphore(async () => {
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await bedrock.send(command);
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
    throw new Error("No response from Bedrock after retries");
  });

  // Convertir el stream de Bedrock a un ReadableStream web
  const encoder = new TextEncoder();
  const shouldAppendApa = template.appendApaReferences === true;

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
              // Si el template lo pide, añadir sección APA al final
              if (shouldAppendApa) {
                const apa = buildReferencesSection(chunks);
                if (apa) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: apa })}\n\n`)
                  );
                }
              }
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
