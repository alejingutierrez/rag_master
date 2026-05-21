/**
 * Validación post-hoc de citas en respuestas RAG.
 *
 * Pipeline:
 *  1. Claude genera la respuesta con citas [#N]
 *  2. Para cada oración con cita:
 *     - Extrae el claim factual
 *     - Verifica con Claude Haiku que el chunk N realmente respalda el claim
 *     - Si no, marca para borrar
 *  3. Devuelve la respuesta con las oraciones inválidas removidas (o anotadas)
 *
 * No es perfecto pero sube factualidad significativamente al penalizar
 * citas falsas / claims sin respaldo.
 */
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";
import type { SearchResult } from "./vector-search";

const bedrock = new BedrockRuntimeClient(awsConfig);
const VALIDATOR_MODEL =
  process.env.BEDROCK_VALIDATOR_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0";

interface ClaimToValidate {
  sentence: string;
  citationIndices: number[]; // 1-based, los [#N] que cita la oración
}

interface ValidationResult {
  sentence: string;
  citationIndices: number[];
  supported: boolean;
  reason?: string;
}

/**
 * Extrae oraciones con citas [#N] de una respuesta.
 * Solo evalúa oraciones que TENGAN una cita — si no tiene cita, asumimos
 * que es prosa narrativa (no factual) y la dejamos pasar.
 */
function extractCitedSentences(answer: string): ClaimToValidate[] {
  const results: ClaimToValidate[] = [];

  // Dividir en oraciones (mantener puntuación)
  const sentences = answer
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¡¿*[])/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);

  for (const sentence of sentences) {
    const matches = [...sentence.matchAll(/\[#(\d+)\]/g)];
    if (matches.length === 0) continue;

    const indices = [...new Set(matches.map((m) => Number(m[1])))];
    results.push({ sentence, citationIndices: indices });
  }

  return results;
}

/**
 * Verifica una lista de claims contra los chunks recuperados.
 * Usa Haiku como judge en batch (1 sola llamada por respuesta).
 */
async function batchValidate(
  claims: ClaimToValidate[],
  chunks: SearchResult[]
): Promise<ValidationResult[]> {
  if (claims.length === 0) return [];

  // Mapear índices 1-based de citas a chunks
  const chunksText = chunks
    .slice(0, 30)
    .map((c, i) => `[#${i + 1}] ${c.content.substring(0, 1000)}`)
    .join("\n\n");

  const systemPrompt = `Eres un validador de citas en sistemas RAG.

Para cada oración numerada:
1. Identifica qué cita [#N] usa
2. Verifica si el chunk #N realmente respalda la afirmación de la oración
3. Una cita es VÁLIDA si el chunk contiene la información (literal o por inferencia razonable)
4. Una cita es INVÁLIDA si el chunk NO menciona la información, o si menciona algo distinto

Sé razonable: aceptar paráfrasis y reformulaciones del chunk. Solo marcar como inválido si el claim añade detalles concretos (fechas específicas, cifras, nombres) que NO están en el chunk citado.

Output JSON exacto:
{"validations": [{"index": 0, "supported": true|false, "reason": "<breve>"}]}

NO incluyas otro texto.`;

  const userPrompt = `FRAGMENTOS DISPONIBLES:
${chunksText}

ORACIONES A VALIDAR:
${claims.map((c, i) => `${i}. "${c.sentence}"  (cita: ${c.citationIndices.map(x => `#${x}`).join(",")})`).join("\n")}

JSON:`;

  try {
    const cmd = new ConverseCommand({
      modelId: VALIDATOR_MODEL,
      system: [{ text: systemPrompt }],
      messages: [{ role: "user", content: [{ text: userPrompt }] }],
      inferenceConfig: { maxTokens: 4000, temperature: 0.0 },
    });
    const res = await bedrock.send(cmd);
    const text = res.output?.message?.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return claims.map((c) => ({ ...c, supported: true })); // fail-open

    const parsed: { validations: Array<{ index: number; supported: boolean; reason: string }> } = JSON.parse(jsonMatch[0]);
    const validationMap = new Map<number, { supported: boolean; reason: string }>();
    for (const v of parsed.validations) {
      validationMap.set(v.index, { supported: v.supported, reason: v.reason });
    }

    return claims.map((c, i) => {
      const v = validationMap.get(i);
      return {
        sentence: c.sentence,
        citationIndices: c.citationIndices,
        supported: v?.supported ?? true,
        reason: v?.reason,
      };
    });
  } catch (e) {
    console.warn("[citation-validator] Fallo:", (e as Error).message.substring(0, 100));
    return claims.map((c) => ({ ...c, supported: true })); // fail-open
  }
}

export interface ValidateResult {
  cleanedAnswer: string;        // respuesta con oraciones inválidas removidas
  originalAnswer: string;
  removedSentences: ValidationResult[]; // qué se removió y por qué
  totalSentencesWithCitations: number;
  removedCount: number;
  factualityRate: number;       // ratio de oraciones válidas
}

/**
 * Valida y limpia una respuesta. Remueve oraciones con citas falsas.
 */
export async function validateAndClean(
  answer: string,
  chunks: SearchResult[]
): Promise<ValidateResult> {
  const claims = extractCitedSentences(answer);
  if (claims.length === 0) {
    return {
      cleanedAnswer: answer,
      originalAnswer: answer,
      removedSentences: [],
      totalSentencesWithCitations: 0,
      removedCount: 0,
      factualityRate: 1.0,
    };
  }

  const validations = await batchValidate(claims, chunks);
  const removed = validations.filter((v) => !v.supported);

  // Construir respuesta limpia: borrar las oraciones inválidas
  let cleaned = answer;
  for (const r of removed) {
    // Eliminar la oración exacta (puede ser que se haya cortado en otro lugar)
    cleaned = cleaned.replace(r.sentence, "");
  }
  // Limpiar espacios dobles que dejó el remove
  cleaned = cleaned.replace(/\s{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  return {
    cleanedAnswer: cleaned,
    originalAnswer: answer,
    removedSentences: removed,
    totalSentencesWithCitations: claims.length,
    removedCount: removed.length,
    factualityRate: 1 - removed.length / claims.length,
  };
}
