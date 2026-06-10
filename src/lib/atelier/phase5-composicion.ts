/**
 * Fase 5 — Composición. El writer recibe SOLO el brief + los claims verificados
 * empaquetados como prosa (NUNCA chunks crudos, ids, páginas ni contradicciones)
 * y redacta la pieza limpia en el formato elegido. Opus, streaming.
 *
 * `askClaudeAtelier` clona el manejo de stream/retry/identidad de claude.ts:39-154,
 * pero arma el system prompt desde el formato en vez de inyectar buildContextBlock.
 */
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "../aws-config";
import { withBedrockSemaphore } from "../bedrock-semaphore";
import { OPUS_MODEL } from "./bedrock-json";
import { getFormatPrompt, type AtelierFormat } from "./formats";
import type { AtelierBrief, VerifiedDossier } from "./types";

// Misma directiva de autoría que claude.ts:25-33 — la pieza es de autor.
const IDENTIDAD_AUTORIA = `

---

## IDENTIDAD Y AUTORÍA (OBLIGATORIO)

- NUNCA te refieras a ti mismo como modelo, IA o asistente, ni menciones proveedores o nombres de modelos (Anthropic, Claude, Opus, OpenAI, GPT, Gemini, Bedrock, etc.). Esto incluye notas, descargos o firmas del tipo "generado por", "como modelo de lenguaje" o "Usa Anthropic Claude…".
- Escribe como autor humano. La autoría editorial corresponde a **Alejandro Gutiérrez** y la asigna el sistema, no tú: NO firmes ni añadas una línea de autoría al final.
- Entrega únicamente el contenido solicitado, sin metacomentarios sobre cómo, con qué herramienta o por qué fue producido.`;

let _client: BedrockRuntimeClient | null = null;
function client(): BedrockRuntimeClient {
  return (_client ??= new BedrockRuntimeClient(awsConfig));
}

function isThinkingModel(model: string): boolean {
  return /claude-(opus|sonnet)-(4-7|4-8|5)/.test(model);
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Empaqueta los claims verificados como material de base para el writer.
 * Solo el TEXTO del claim, agrupado por núcleo. Sin ids, sin fuentes, sin
 * contradicciones → imposible filtrar andamiaje al cuerpo.
 */
export function packVerifiedContext(verified: VerifiedDossier, brief: AtelierBrief): string {
  const byNucleo = new Map<string, string[]>();
  for (const c of verified.claims) {
    const arr = byNucleo.get(c.nucleo);
    if (arr) arr.push(c.texto);
    else byNucleo.set(c.nucleo, [c.texto]);
  }
  if (byNucleo.size === 0) {
    // Degradación: sin claims, dejar al menos el scope como guía mínima.
    return `(Material escaso) Tema: ${brief.scope || brief.ejes.join("; ")}`;
  }
  const parts: string[] = [];
  for (const [nucleo, textos] of byNucleo) {
    parts.push(`### ${nucleo}`);
    for (const t of textos) parts.push(`- ${t}`);
    parts.push("");
  }
  return parts.join("\n").trim();
}

/** Llamada de escritura en streaming. Devuelve el texto acumulado. */
export async function askClaudeAtelier(
  args: { system: string; user: string; maxTokens: number; model?: string },
  onProgress?: (words: number) => void
): Promise<string> {
  const model = args.model ?? OPUS_MODEL;
  const system = args.system + IDENTIDAD_AUTORIA;
  const inferenceConfig: { maxTokens: number; temperature?: number } = {
    maxTokens: args.maxTokens,
  };
  if (!isThinkingModel(model)) inferenceConfig.temperature = 0.4;

  const command = new ConverseStreamCommand({
    modelId: model,
    system: [{ text: system }],
    messages: [{ role: "user", content: [{ text: args.user }] }],
    inferenceConfig,
  });

  const response = await withBedrockSemaphore(async () => {
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await client().send(command);
      } catch (err) {
        const e = err as Error;
        const retryable =
          [
            "ThrottlingException",
            "ModelStreamErrorException",
            "ModelTimeoutException",
            "ServiceUnavailableException",
            "InternalServerException",
          ].includes(e.name) ||
          /throttl|Too many requests|timeout|ECONNRESET|socket hang up/i.test(e.message);
        if (!retryable || attempt === MAX_RETRIES) throw err;
        const delay = Math.min(5000 * Math.pow(2, attempt), 30000);
        console.warn(`[atelier] writer ${e.name}, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error("Bedrock writer sin respuesta tras reintentos");
  });

  let text = "";
  let lastReport = Date.now();
  if (response.stream) {
    for await (const event of response.stream) {
      const delta = event.contentBlockDelta?.delta?.text;
      if (delta) text += delta;
      if (onProgress && Date.now() - lastReport > 30_000) {
        onProgress(countWords(text));
        lastReport = Date.now();
      }
    }
  }
  if (onProgress) onProgress(countWords(text));
  return text;
}

/** Compone la pieza a partir del brief + el material verificado. */
export async function componer(args: {
  intent: string;
  brief: AtelierBrief;
  verified: VerifiedDossier;
  onProgress?: (words: number) => void;
}): Promise<{ texto: string; format: AtelierFormat }> {
  const format = getFormatPrompt(args.brief.ficha.formato);
  const verifiedContext = packVerifiedContext(args.verified, args.brief);
  const system = format.buildWriterSystemPrompt({ brief: args.brief, verifiedContext });
  const user = `ENCARGO DEL AUTOR:\n${args.intent}\n\nEscribe ahora la pieza completa, siguiendo todas las reglas. Empieza directamente por el título en \`#\`.`;

  // El capítulo es el formato más profesional y caro: puede apuntar a un modelo
  // dedicado (env), cayendo a OPUS_MODEL por defecto.
  const model =
    format.id === "capitulo"
      ? process.env.BEDROCK_ATELIER_CAPITULO_MODEL_ID || OPUS_MODEL
      : OPUS_MODEL;

  const texto = await askClaudeAtelier(
    { system, user, maxTokens: format.maxTokens, model },
    args.onProgress
  );
  return { texto, format };
}
