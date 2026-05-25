/**
 * Planificador agéntico para Deep Research.
 *
 * Toma la pregunta del usuario y la descompone en 6-10 sub-preguntas reales,
 * usando Claude Opus 4.7 con thinking implícito. Cada sub-pregunta apunta a
 * un ángulo distinto del problema (contexto, actores, causas, consecuencias,
 * cronología, historiografía, contraevidencia, etc.) pero formuladas de
 * manera específica para el tema, NO genérica.
 *
 * Devuelve también:
 * - scope: delimitación temporal/geográfica/temática
 * - entities: personas, instituciones, lugares, conceptos clave detectados
 * - thinking: razonamiento del planificador (para mostrar en UI)
 */
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";
import { withBedrockSemaphore } from "./bedrock-semaphore";

const bedrock = new BedrockRuntimeClient(awsConfig);
const PLANNER_MODEL =
  process.env.BEDROCK_PLANNER_MODEL_ID ||
  process.env.BEDROCK_CLAUDE_MODEL_ID ||
  "us.anthropic.claude-opus-4-7";

export interface ResearchPlan {
  thinking: string;
  scope: string;
  entities: {
    personas: string[];
    instituciones: string[];
    lugares: string[];
    conceptos: string[];
    temporalidad: string;
  };
  subqueries: string[];
}

const PLANNER_SYSTEM = `Eres un historiador planificador de investigaciones académicas. Recibes una pregunta de investigación y la descompones en un plan de búsqueda riguroso para un sistema RAG sobre historia colombiana y latinoamericana.

Tu tarea:

1. **Lee la pregunta** y identifica:
   - Temporalidad: año(s), década(s), período histórico explícito o implícito.
   - Entidades nombradas: personas, instituciones, lugares específicos.
   - Conceptos clave: ideas/categorías analíticas que aparecen.
   - Geografía: país, región, localidad si se menciona.

2. **Delimita el scope**: en 1-2 frases, qué cubre y qué no cubre esta pregunta. Sé estricto.

3. **Genera 6 a 8 sub-preguntas específicas** que cubran ángulos complementarios. NO uses prefijos genéricos como "¿Cuál es el contexto de…?" — cada sub-pregunta debe ser **concreta para el tema**, mencionar entidades o conceptos clave, y ser ejecutable como búsqueda RAG. Cubre estos ángulos cuando apliquen:
   - **Contexto histórico** específico al período/lugar.
   - **Actores e instituciones** concretos involucrados.
   - **Causas estructurales** (políticas, económicas, sociales, culturales).
   - **Eventos y cronología** detallada.
   - **Consecuencias** inmediatas y de largo plazo.
   - **Debate historiográfico**: cómo interpretan distintos autores el fenómeno.
   - **Contraevidencia o disensos**: matices, voces minoritarias.
   - **Comparaciones** con otros casos si la pregunta lo invita.

Formato EXACTO de respuesta (JSON puro, sin markdown):

{
  "thinking": "Breve descripción de tu razonamiento (2-3 frases) sobre por qué elegiste estos ángulos.",
  "scope": "Delimitación clara de qué se va a investigar.",
  "entities": {
    "personas": ["nombre completo"],
    "instituciones": ["nombre"],
    "lugares": ["lugar"],
    "conceptos": ["concepto"],
    "temporalidad": "ej. 1850-1900 / siglo XIX tardío / período de la Regeneración"
  },
  "subqueries": [
    "Sub-pregunta 1 específica con nombres/fechas/conceptos",
    "Sub-pregunta 2",
    "..."
  ]
}

NO incluyas texto antes o después del JSON. NO uses bloques de código markdown.`;

export async function planResearch(question: string): Promise<ResearchPlan> {
  const userPrompt = `PREGUNTA DE INVESTIGACIÓN:
${question}

JSON:`;

  // Para Opus 4.7 omitimos temperature (thinking model).
  const isThinking = /claude-(opus|sonnet)-(4-7|4-8|5)/.test(PLANNER_MODEL);
  const inferenceConfig: { maxTokens: number; temperature?: number } = {
    maxTokens: 4000,
  };
  if (!isThinking) inferenceConfig.temperature = 0.3;

  const response = await withBedrockSemaphore(async () => {
    const cmd = new ConverseCommand({
      modelId: PLANNER_MODEL,
      system: [{ text: PLANNER_SYSTEM }],
      messages: [{ role: "user", content: [{ text: userPrompt }] }],
      inferenceConfig,
    });
    return await bedrock.send(cmd);
  });

  const text = response.output?.message?.content?.[0]?.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Planner devolvió texto sin JSON: ${text.slice(0, 200)}`);
  }

  let parsed: ResearchPlan;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`JSON del planner inválido: ${(e as Error).message}`);
  }

  // Validación defensiva: al menos 4 subqueries.
  if (!Array.isArray(parsed.subqueries) || parsed.subqueries.length < 4) {
    throw new Error(
      `Planner generó solo ${parsed.subqueries?.length ?? 0} sub-preguntas; mínimo 4 requeridas`
    );
  }
  // Truncar a 8 max para no explotar costo.
  parsed.subqueries = parsed.subqueries.slice(0, 8);

  // Defaults seguros si el modelo omite campos.
  parsed.thinking = parsed.thinking ?? "";
  parsed.scope = parsed.scope ?? "";
  parsed.entities = parsed.entities ?? {
    personas: [],
    instituciones: [],
    lugares: [],
    conceptos: [],
    temporalidad: "",
  };

  return parsed;
}
