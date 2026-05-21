/**
 * Query expansion para mejorar el recall en preguntas vagas o con vocabulario distinto al corpus.
 *
 * Estrategias:
 * 1. Multi-query: Claude Haiku genera 3 variaciones de la pregunta
 * 2. HyDE (Hypothetical Document Embeddings): Haiku genera una "respuesta hipotética"
 *    que tiene vocabulario más cercano a los chunks (1-2 párrafos enciclopédicos)
 *
 * Cada query expandido genera su propio embedding → retrieval híbrido → fusión RRF final.
 */
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";
import { withBedrockSemaphore } from "./bedrock-semaphore";

const bedrock = new BedrockRuntimeClient(awsConfig);
const EXPANSION_MODEL =
  process.env.BEDROCK_EXPANSION_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0";

export interface ExpandedQuery {
  original: string;
  variations: string[];
  hyde: string; // Respuesta hipotética
}

/**
 * Genera 3 variaciones de la pregunta + 1 respuesta hipotética usando Claude Haiku.
 */
export async function expandQuery(query: string): Promise<ExpandedQuery> {
  const systemPrompt = `Eres un asistente que prepara consultas para un sistema de búsqueda en una biblioteca de historia colombiana.

Tu tarea: dada una pregunta del usuario, genera:
1. Tres variaciones de la pregunta usando sinónimos y reformulaciones que un libro académico usaría.
2. Una "respuesta hipotética" de 2-3 oraciones que un libro de historia podría contener, escrita en estilo enciclopédico denso con nombres, fechas y términos específicos.

Esto es para mejorar el recall del sistema: el corpus puede usar terminología distinta a la del usuario.

Formato EXACTO de respuesta (JSON):
{
  "variations": [
    "variación 1 de la pregunta",
    "variación 2 de la pregunta",
    "variación 3 de la pregunta"
  ],
  "hyde": "Respuesta hipotética estilo enciclopedia con nombres propios, fechas y datos concretos."
}

NO incluyas otro texto. SOLO el JSON.`;

  const userPrompt = `PREGUNTA: ${query}

JSON:`;

  try {
    const response = await withBedrockSemaphore(async () => {
      const cmd = new ConverseCommand({
        modelId: EXPANSION_MODEL,
        system: [{ text: systemPrompt }],
        messages: [{ role: "user", content: [{ text: userPrompt }] }],
        inferenceConfig: { maxTokens: 800, temperature: 0.4 },
      });
      return await bedrock.send(cmd);
    });

    const text = response.output?.message?.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Query expansion: no JSON válido");

    const parsed: { variations: string[]; hyde: string } = JSON.parse(jsonMatch[0]);

    return {
      original: query,
      variations: parsed.variations.slice(0, 3),
      hyde: parsed.hyde,
    };
  } catch (error) {
    console.warn("[query-expansion] Falló, devolviendo solo original:", (error as Error).message);
    return { original: query, variations: [], hyde: "" };
  }
}

/**
 * Devuelve TODAS las queries a usar para retrieval: original + variaciones + hyde
 */
export function flattenQueries(expanded: ExpandedQuery): string[] {
  const queries = [expanded.original, ...expanded.variations];
  if (expanded.hyde) queries.push(expanded.hyde);
  return queries.filter(Boolean);
}
