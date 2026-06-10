/**
 * Helpers de llamada a Claude vía Bedrock para las fases internas del Taller
 * (encuadre, triangulación, verificación, edición). No-stream (ConverseCommand),
 * con retry exponencial y parseo JSON robusto. Centraliza el patrón disperso
 * en deep-research-planner.ts y deep-research-annexes.ts.
 *
 * El cliente se crea perezosamente para no requerir credenciales al solo
 * importar el módulo (los tests unitarios importan utilidades hermanas).
 */
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "../aws-config";
import { withBedrockSemaphore } from "../bedrock-semaphore";
import { extractJsonObject } from "./json";

let _client: BedrockRuntimeClient | null = null;
function client(): BedrockRuntimeClient {
  return (_client ??= new BedrockRuntimeClient(awsConfig));
}

/**
 * Modelo pesado del Taller (razonamiento, composición). `BEDROCK_ATELIER_MODEL_ID`
 * tiene precedencia para poder moverlo a Opus 4.8 SIN tocar el chat (que lee
 * BEDROCK_CLAUDE_MODEL_ID). Para activarlo en prod: setear ese env en App Runner
 * tras confirmar que el modelo está habilitado en tu Bedrock. El regex de
 * thinking-models ya cubre 4-8.
 */
export const OPUS_MODEL =
  process.env.BEDROCK_ATELIER_MODEL_ID ||
  process.env.BEDROCK_PLANNER_MODEL_ID ||
  process.env.BEDROCK_CLAUDE_MODEL_ID ||
  "us.anthropic.claude-opus-4-8";

/** Modelo barato (extracción estructurada, verificación, crítica). */
export const SONNET_MODEL =
  process.env.BEDROCK_ANNEX_MODEL_ID ||
  process.env.BEDROCK_JUDGE_MODEL_ID ||
  "us.anthropic.claude-sonnet-4-6";

/** Opus 4.7+/Sonnet 4.6+ son thinking models: no aceptan temperature. */
function isThinkingModel(model: string): boolean {
  return /claude-(opus|sonnet)-(4-7|4-8|5)/.test(model);
}

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    [
      "ThrottlingException",
      "ModelTimeoutException",
      "ServiceUnavailableException",
      "InternalServerException",
      "ModelStreamErrorException",
      // Errores de credencial/firma que AWS devuelve de forma TRANSITORIA bajo
      // alta concurrencia o durante un rollout de App Runner. Reintentar con
      // backoff los recupera; si la llave está realmente mal, falla tras 3 intentos.
      "UnrecognizedClientException",
      "InvalidSignatureException",
      "ExpiredTokenException",
    ].includes(err.name) ||
    /throttl|Too many requests|timeout|ECONNRESET|socket hang up|security token|InvalidClientTokenId|Signature expired|ExpiredToken/i.test(
      err.message
    )
  );
}

export interface ClaudeTextArgs {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
}

/** Llamada Converse no-stream con retry. Devuelve el texto del primer bloque. */
export async function callClaudeText(args: ClaudeTextArgs): Promise<string> {
  const inferenceConfig: { maxTokens: number; temperature?: number } = {
    maxTokens: args.maxTokens,
  };
  if (!isThinkingModel(args.model)) {
    inferenceConfig.temperature = args.temperature ?? 0.3;
  }

  const cmd = new ConverseCommand({
    modelId: args.model,
    system: [{ text: args.system }],
    messages: [{ role: "user", content: [{ text: args.user }] }],
    inferenceConfig,
  });

  return withBedrockSemaphore(async () => {
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await client().send(cmd);
        return res.output?.message?.content?.[0]?.text ?? "";
      } catch (err) {
        if (!isRetryable(err) || attempt === MAX_RETRIES) throw err;
        const delay = Math.min(4000 * Math.pow(2, attempt), 24000);
        console.warn(
          `[atelier] Bedrock ${(err as Error).name ?? "error"}, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error("Bedrock sin respuesta tras reintentos");
  });
}

export interface ClaudeJsonArgs<T> extends Omit<ClaudeTextArgs, never> {
  /** Validación/normalización del objeto parseado; debe lanzar si es inválido. */
  validate?: (parsed: unknown) => T;
}

/**
 * Llama pidiendo JSON y lo parsea. Si el parseo falla, reintenta una vez
 * exigiendo "solo JSON". Lanza si tras 2 intentos no hay JSON válido.
 */
export async function callClaudeJson<T>(args: ClaudeJsonArgs<T>): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const user =
      attempt === 0
        ? args.user
        : args.user +
          "\n\nIMPORTANTE: responde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código markdown.";
    const text = await callClaudeText({ ...args, user });
    try {
      const parsed = JSON.parse(extractJsonObject(text)) as unknown;
      return args.validate ? args.validate(parsed) : (parsed as T);
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw new Error(`callClaudeJson falló tras 2 intentos: ${lastErr?.message}`);
}
