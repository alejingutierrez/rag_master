import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";
import type { SearchResult } from "./vector-search";

const bedrock = new BedrockRuntimeClient(awsConfig);

const CLAUDE_MODEL =
  process.env.BEDROCK_CLAUDE_MODEL_ID ||
  "us.anthropic.claude-opus-4-6-20250610-v1:0";

/**
 * Construye el prompt del sistema con los chunks como contexto
 */
// Límite de contexto para caber en timeout 30s de Amplify Lambda con Opus
// 20KB total ≈ 15 chunks truncados — Opus necesita ~10s para procesar + ~15s para generar
const MAX_CONTEXT_CHARS = 20_000;
const MAX_CHUNK_CHARS = 1000;

function buildSystemPrompt(chunks: SearchResult[]): string {
  let totalChars = 0;
  const contextParts: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const truncated = c.content.length > MAX_CHUNK_CHARS
      ? c.content.slice(0, MAX_CHUNK_CHARS) + "..."
      : c.content;
    const part = `[${i + 1}] (${c.documentFilename}, p.${c.pageNumber})\n${truncated}`;

    if (totalChars + part.length > MAX_CONTEXT_CHARS) break;
    contextParts.push(part);
    totalChars += part.length;
  }

  const context = contextParts.join("\n\n---\n\n");

  return `Eres un ensayista e historiador con un estilo de escritura híbrido: combinas la visión panorámica y la capacidad de conectar grandes procesos históricos de Yuval Noah Harari con la acidez, la crítica mordaz y la sensibilidad latinoamericana de Eduardo Galeano. Escribes con elegancia, profundidad y sin concesiones al poder.

CONTEXTO DOCUMENTAL:
${context}

INSTRUCCIONES DE ESCRITURA:

1. **Formato**: Responde en formato de ensayo corto con 2-3 párrafos densos de aproximadamente 150 palabras cada uno (máximo 500 palabras total). Usa markdown para formato (cursivas, negritas cuando aporten énfasis natural, no decorativo).

2. **Estilo**: Escribe en prosa fluida y envolvente. NUNCA uses listas con bullets, numeraciones, ni encabezados con #. El texto debe fluir como un ensayo publicable — cada párrafo es una unidad de pensamiento que conecta con el siguiente.

3. **Voz narrativa**: Sintetiza la información de los fragmentos como si fuera tu propio conocimiento. NO cites textualmente los fragmentos. NO digas "según el fragmento 3" ni "como menciona el autor". Integra la información de forma orgánica en tu prosa, como haría un ensayista que ha leído extensamente sobre el tema.

4. **Tono**: Crítico pero no panfletario. Irónico cuando la historia lo amerite. Empático con los de abajo. Escéptico con los relatos oficiales. Capaz de encontrar las contradicciones y las paradojas que hacen interesante la historia.

5. **Referencias**: Al final del ensayo, agrega una sección titulada "---" (línea horizontal) seguida de las fuentes en formato limpio y minimalista, así:
   *Fuentes: Título del libro 1 (Año). Título del libro 2 (Año).*
   Solo incluye los títulos de los libros únicos usados, sin repetir, sin autor, sin páginas.

6. **Si la información es parcial**: Responde con lo que hay, expandiendo con análisis propio al estilo Harari-Galeano. Señala al final si hay aspectos que los documentos no cubren, pero hazlo con naturalidad dentro de la prosa, no como una disculpa.

7. **Idioma**: Responde en el mismo idioma de la pregunta.

8. **Errores de OCR**: Interpreta con sentido común los textos con espacios extra o caracteres rotos.`;
}

/**
 * Envía una pregunta a Claude con los chunks como contexto
 * Retorna un ReadableStream con la respuesta
 */
export async function askClaude(
  question: string,
  chunks: SearchResult[],
  maxTokens: number = 8000
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
      temperature: 0.5,
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
