/**
 * Anexos historiográficos para Deep Research.
 *
 * Una vez generado el paper académico principal, se llaman 3 sub-tareas en
 * paralelo con Claude Haiku/Sonnet (modelos rápidos) que generan:
 * - Cronología: línea de tiempo con eventos y fechas extraídos del corpus.
 * - Tabla de actores: personas e instituciones principales con su rol.
 * - Vacíos: preguntas que el corpus no permite responder.
 *
 * Cada anexo va en Markdown y se ancla con citas [#N] cuando aplica.
 */
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";
import { withBedrockSemaphore } from "./bedrock-semaphore";
import { buildContextBlock } from "./chat-templates";
import type { SearchResult } from "./vector-search";

const bedrock = new BedrockRuntimeClient(awsConfig);
const ANNEX_MODEL =
  process.env.BEDROCK_ANNEX_MODEL_ID ||
  process.env.BEDROCK_JUDGE_MODEL_ID ||
  "us.anthropic.claude-sonnet-4-6";

export interface Annexes {
  cronologia: string;
  actores: string;
  vacios: string;
}

async function callAnnexModel(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const isThinking = /claude-(opus|sonnet)-(4-7|4-8|5)/.test(ANNEX_MODEL);
  const inferenceConfig: { maxTokens: number; temperature?: number } = { maxTokens };
  if (!isThinking) inferenceConfig.temperature = 0.2;

  const response = await withBedrockSemaphore(async () => {
    const cmd = new ConverseCommand({
      modelId: ANNEX_MODEL,
      system: [{ text: systemPrompt }],
      messages: [{ role: "user", content: [{ text: userPrompt }] }],
      inferenceConfig,
    });
    return await bedrock.send(cmd);
  });
  return response.output?.message?.content?.[0]?.text ?? "";
}

const CHRONOLOGY_SYSTEM = `Eres un historiador construyendo una cronología precisa a partir de un corpus documental.

A partir de los fragmentos provistos, extrae los eventos con fecha explícita relacionados con la pregunta. Devuelve una línea de tiempo en Markdown.

Formato OBLIGATORIO:

| Año | Evento | Fuente |
|---|---|---|
| 1886 | Promulgación de la Constitución de la Regeneración | [#15] |
| 1887 | Firma del Concordato entre Colombia y la Santa Sede | [#3, #22] |
| … | … | … |

Reglas:
- Ordena cronológicamente ascendente.
- Solo eventos con fecha (año mínimo) explícita en los fragmentos.
- Cita el fragmento con \`[#N]\` en la columna Fuente.
- Si no hay suficientes eventos datados, di: "El corpus aporta menos de 5 eventos con fecha precisa relacionados con la pregunta." y lista los que hay.
- NO inventes fechas, NO interpoles años, NO mezcles eventos de períodos no relacionados.
- Máximo 25 entradas. Si hay más, prioriza los más relevantes a la pregunta.

NO escribas introducción ni cierre. Solo el título "## Cronología" y la tabla.`;

const ACTORS_SYSTEM = `Eres un historiador identificando los actores principales (personas e instituciones) de un episodio histórico a partir de un corpus documental.

A partir de los fragmentos provistos, identifica las personas y las instituciones más relevantes para la pregunta. Devuelve una tabla en Markdown.

Formato OBLIGATORIO:

| Actor | Tipo | Rol / Relevancia | Fuente |
|---|---|---|---|
| Rafael Núñez | Persona | Presidente, arquitecto político de la Regeneración | [#3, #15] |
| Iglesia Católica | Institución | Beneficiaria del Concordato, recuperó privilegios | [#22] |
| … | … | … | … |

Reglas:
- Columna "Tipo": "Persona" o "Institución" exclusivamente.
- Columna "Rol / Relevancia": una frase concisa.
- Cita el fragmento con \`[#N]\`.
- Si la persona se menciona pero su rol no se explica en el corpus, di: "Rol no detallado en el corpus".
- Ordena por relevancia descendente (los más centrales primero).
- Máximo 15 entradas.

NO escribas introducción ni cierre. Solo el título "## Actores principales" y la tabla.`;

const GAPS_SYSTEM = `Eres un historiador identificando los vacíos documentales de un corpus respecto a una pregunta de investigación.

Lee los fragmentos y la pregunta. Identifica qué aspectos legítimos de la pregunta el corpus NO permite responder o responde de manera muy débil.

Formato OBLIGATORIO:

## Lo que el corpus no responde

- **[Aspecto 1]**: explica en 1-2 frases qué falta o qué solo se menciona superficialmente. Indica si la ausencia es estructural (las fuentes no cubren ese período/perspectiva) o táctica (solo faltan más detalles).
- **[Aspecto 2]**: …
- **[Aspecto 3]**: …

Reglas:
- Entre 3 y 6 vacíos identificados.
- Sé específico: "No hay testimonios de campesinos" es mejor que "Falta información popular".
- Indica si la perspectiva ausente es de víctimas, mujeres, regiones periféricas, oposición, fuentes primarias, etc.
- Si el corpus cubre razonablemente bien la pregunta, dilo: "El corpus cubre los aspectos principales de la pregunta; los vacíos son menores." y lista 1-2 vacíos secundarios.

NO escribas introducción larga. Solo el título "## Lo que el corpus no responde" y la lista.`;

/**
 * Genera los 3 anexos en paralelo. Si alguno falla, devuelve string vacío
 * para ese anexo y deja que los otros se entreguen.
 */
export async function generateAnnexes(
  question: string,
  chunks: SearchResult[]
): Promise<Annexes> {
  const context = buildContextBlock(chunks.slice(0, 80));
  const userPrompt = `PREGUNTA: ${question}\n\nFRAGMENTOS DEL CORPUS:\n\n${context}`;

  const [cronologia, actores, vacios] = await Promise.allSettled([
    callAnnexModel(CHRONOLOGY_SYSTEM, userPrompt, 6000),
    callAnnexModel(ACTORS_SYSTEM, userPrompt, 6000),
    callAnnexModel(GAPS_SYSTEM, userPrompt, 3000),
  ]);

  return {
    cronologia: cronologia.status === "fulfilled" ? cronologia.value : "",
    actores: actores.status === "fulfilled" ? actores.value : "",
    vacios: vacios.status === "fulfilled" ? vacios.value : "",
  };
}
