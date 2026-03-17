import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";
import type { SearchResult } from "./vector-search";

const bedrock = new BedrockRuntimeClient(awsConfig);

const CLAUDE_MODEL =
  process.env.BEDROCK_CLAUDE_MODEL_ID ||
  "us.anthropic.claude-opus-4-6-v1";

/**
 * Construye el prompt del sistema con los chunks como contexto
 */
function buildSystemPrompt(chunks: SearchResult[]): string {
  const context = chunks
    .map(
      (c, i) =>
        `[Fragmento ${i + 1}] (Archivo: ${c.documentFilename}, Página: ${c.pageNumber}, Similitud: ${(c.similarity * 100).toFixed(1)}%)\n${c.content}`
    )
    .join("\n\n---\n\n");

  return `Eres un asistente experto que responde preguntas basándose en los documentos proporcionados.

CONTEXTO DE DOCUMENTOS:
${context}

INSTRUCCIONES:
- Responde basándote EXCLUSIVAMENTE en el contexto proporcionado.
- Si la información no está en el contexto, indícalo claramente.
- Cita los fragmentos relevantes indicando el número de fragmento [Fragmento N].
- Responde en el mismo idioma de la pregunta.
- Sé preciso y conciso.`;
}

/**
 * Envía una pregunta a Claude con los chunks como contexto
 * Retorna un ReadableStream con la respuesta
 */
export async function askClaude(
  question: string,
  chunks: SearchResult[],
  maxTokens: number = 4096
): Promise<ReadableStream<Uint8Array>> {
  const systemPrompt = buildSystemPrompt(chunks);

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
      maxTokens,
      temperature: 0.3,
    },
  });

  const response = await bedrock.send(command);

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
        controller.error(error);
      }
    },
  });
}
