import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";
import type { SearchResult } from "./vector-search";
import { buildContextBlock } from "./rag-context";
import { withBedrockSemaphore } from "./bedrock-semaphore";

const bedrock = new BedrockRuntimeClient(awsConfig);

// Modelo rápido para "Consultar" (respuesta tipo buscador con RAG).
// Por defecto Sonnet 4.6: alta calidad SIN la pausa de "thinking" de Opus 4.7,
// así el primer token llega en ~1-2s en vez de tras un bloque de razonamiento.
// El Taller sigue usando Opus para la profundidad. Override por env.
const CONSULTA_MODEL =
  process.env.BEDROCK_CHAT_LIGHT_MODEL_ID ||
  process.env.BEDROCK_ANNEX_MODEL_ID ||
  "us.anthropic.claude-sonnet-4-6";

const CONSULTA_MAX_TOKENS = Number(process.env.CONSULTA_MAX_TOKENS ?? "2600");

// Los "thinking models" (opus/sonnet 4-7, 4-8, 5) rechazan `temperature`.
// Sonnet 4-6 NO lo es → sí acepta temperature (y arranca a streamear sin pausa).
const isThinkingModel = (m: string) =>
  /claude-(opus|sonnet)-(4-7|4-8|5)/.test(m);

function buildConsultaSystem(contextBlock: string): string {
  return `Eres un historiador que responde consultas sobre un corpus de historia de Colombia. Respondes de forma DIRECTA y CONCISA, como un buscador experto: vas al grano, sin preámbulos de cortesía ni relleno.

REGLAS:
- Responde SOLO con base en los FRAGMENTOS de abajo. No inventes hechos, fechas, cifras, nombres ni citas que no estén en los fragmentos.
- Cita en línea con [#N] cada afirmación factual, donde N es el número del fragmento que la respalda. Puedes encadenar varios: [#2][#7].
- Si los fragmentos no alcanzan para responder, dilo explícitamente en una línea, en vez de especular.
- Tono: claro, preciso, sobrio, sin grandilocuencia. Extensión: lo justo para responder bien — típicamente 2 a 5 párrafos. NO escribas un ensayo ni una sección de bibliografía.
- Estructura en párrafos. Usa subtítulos (##) o listas solo si la pregunta realmente lo exige.
- OCR: el corpus viene de PDFs escaneados; corrige mentalmente errores obvios ("M anuel" = "Manuel", "iden tidad" = "identidad") sin comentarlo.
- Responde en el mismo idioma de la pregunta (español por defecto).

IDENTIDAD: nunca te refieras a ti mismo como modelo, IA o asistente, ni menciones proveedores o nombres de modelos. Escribe como autor; la autoría la asigna el sistema, no firmes.

FRAGMENTOS DEL CORPUS:
${contextBlock}`;
}

/**
 * Genera la respuesta de Consultar token a token desde Bedrock.
 *
 * Devuelve un async generator de deltas de texto — la ruta SSE los re-emite al
 * cliente y los acumula para persistir. No envuelve en formato SSE para que la
 * ruta sea dueña del protocolo (status / chunks / delta / done).
 */
export async function* consultaDeltas(
  question: string,
  chunks: SearchResult[],
  opts?: { maxTokens?: number }
): AsyncGenerator<string, void, unknown> {
  const contextBlock = buildContextBlock(chunks);
  const system = buildConsultaSystem(contextBlock);

  const inferenceConfig: { maxTokens: number; temperature?: number } = {
    maxTokens: opts?.maxTokens ?? CONSULTA_MAX_TOKENS,
  };
  if (!isThinkingModel(CONSULTA_MODEL)) inferenceConfig.temperature = 0.3;

  const command = new ConverseStreamCommand({
    modelId: CONSULTA_MODEL,
    system: [{ text: system }],
    messages: [{ role: "user", content: [{ text: question }] }],
    inferenceConfig,
  });

  // Serializar acceso a Bedrock + retry con backoff (mismo patrón que askClaude).
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
            err.name === "UnrecognizedClientException" ||
            err.name === "InvalidSignatureException" ||
            err.name === "ExpiredTokenException" ||
            err.message.includes("throttl") ||
            err.message.includes("Too many requests") ||
            err.message.includes("timeout") ||
            err.message.includes("ECONNRESET") ||
            err.message.includes("socket hang up") ||
            /security token|InvalidClientTokenId|Signature expired|ExpiredToken/i.test(err.message));
        if (!isRetryable || attempt === MAX_RETRIES) throw err;
        const delay = Math.min(5000 * Math.pow(2, attempt), 30000);
        console.warn(
          `consultaDeltas: Bedrock error (${err instanceof Error ? err.name : "unknown"}), ` +
            `retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error("No response from Bedrock after retries");
  });

  if (!response.stream) return;
  for await (const event of response.stream) {
    const text = event.contentBlockDelta?.delta?.text;
    if (text) yield text;
  }
}
