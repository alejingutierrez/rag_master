import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";
import { withBedrockSemaphore } from "./bedrock-semaphore";

const bedrock = new BedrockRuntimeClient(awsConfig);

// Modelo para generación de preguntas.
// Siempre Opus 4.7 — el usuario quiere máxima calidad para esta tarea crítica.
// Override con BEDROCK_QUESTIONS_MODEL_ID solo para experimentación.
const QUESTIONS_MODEL =
  process.env.BEDROCK_QUESTIONS_MODEL_ID || "us.anthropic.claude-opus-4-7";

// Si compartimos modelo con el chat (mismo Opus 4.7 por default), serializa
// con el semáforo para no chocar con /api/chat.
const USES_SHARED_MODEL =
  QUESTIONS_MODEL === (process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-7");

// Constantes y curva del N adaptativo viven en módulo isomorfo
// (usable por el cliente sin arrastrar AWS SDK).
export {
  MIN_QUESTIONS_COUNT,
  MAX_QUESTIONS_COUNT,
  computeTargetCount,
} from "./questions-config";

import {
  MIN_QUESTIONS_COUNT,
  MAX_QUESTIONS_COUNT,
  computeTargetCount,
} from "./questions-config";

// Heurística para maxTokens según N: ~400 tokens/pregunta + overhead.
// 20 → 16k, 50 → 28k, 80 → 40k, 100 → 48k.
function maxTokensFor(count: number): number {
  return Math.min(60_000, 8_000 + count * 400);
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface QuestionData {
  questionNumber: number;
  pregunta: string;
  periodoCode: string;
  periodoNombre: string;
  periodoRango: string;
  categoriaCode: string;
  categoriaNombre: string;
  subcategoriaCode: string;
  subcategoriaNombre: string;
  periodosRelacionados: string[];
  categoriasRelacionadas: string[];
  // Anclaje temporal preciso
  yearPrincipal: number | null;
  yearsSecondary: number[];
  // Entidades extraídas con conteo estricto
  entidadesPersonas: string[]; // 5
  entidadesLugares: string[];  // 3
  entidadesConceptos: string[]; // 4
  justificacion: string;
}

interface ChunkForGeneration {
  content: string;
  pageNumber: number;
  chunkIndex: number;
}

// ─── Prompt del sistema (taxonomía completa) ──────────────────────────────────

function buildSystemPrompt(targetCount: number): string {
  return `Eres un historiador experto en Colombia con formación interdisciplinaria (historia, ciencia política, economía, sociología, antropología). Tu tarea es analizar el documento proporcionado y generar exactamente ${targetCount} preguntas de investigación profundas sobre la historia de Colombia.

## REGLAS DE GENERACIÓN

1. Las preguntas deben ser PROFUNDAS e INTELIGENTES: no preguntas factuales simples, sino preguntas que revelen tensiones, contradicciones, causalidades no obvias o conexiones entre procesos.
2. Las preguntas deben TRASCENDER el documento: usa el contenido como punto de partida pero conecta con procesos históricos más amplios de Colombia.
3. Cada pregunta debe ser AUTOCONTENIDA: comprensible sin haber leído el documento original.
4. DIVERSIFICA las preguntas: distribúyelas en al menos 7 categorías diferentes y al menos 5 períodos históricos distintos.
5. Cada pregunta debe incluir CONTEXTO SUFICIENTE para que un lector entienda por qué es relevante.
6. Prioriza preguntas que CRUZEN períodos o categorías: las mejores preguntas conectan épocas o dimensiones distintas.

## FORMATO DE SALIDA

Responde EXCLUSIVAMENTE con un bloque JSON válido. Sin texto antes ni después. Sin markdown wrapping. El JSON debe seguir esta estructura exacta:

[
  {
    "id": 1,
    "pregunta": "Texto completo de la pregunta de investigación",
    "periodo_historico": {
      "codigo": "código del período (ver taxonomía)",
      "nombre": "nombre del período",
      "rango_temporal": "rango de años"
    },
    "categoria": {
      "codigo": "código de categoría (ver taxonomía)",
      "nombre": "nombre de la categoría"
    },
    "subcategoria": {
      "codigo": "código de subcategoría (ver taxonomía)",
      "nombre": "nombre de la subcategoría"
    },
    "periodos_relacionados": ["códigos de otros períodos que la pregunta toca tangencialmente"],
    "categorias_relacionadas": ["códigos de otras categorías que la pregunta toca tangencialmente"],
    "anio_principal": 1810,
    "anios_secundarios": [1808, 1819, 1821],
    "entidades": {
      "personas": ["Persona 1", "Persona 2", "Persona 3", "Persona 4", "Persona 5"],
      "lugares": ["Lugar 1", "Lugar 2", "Lugar 3"],
      "conceptos": ["Concepto 1", "Concepto 2", "Concepto 3", "Concepto 4"]
    },
    "justificacion": "Breve explicación (1-2 oraciones) de por qué esta pregunta es relevante para la investigación histórica sobre Colombia"
  }
]

## REGLAS PARA AÑOS Y ENTIDADES

### Años
- **anio_principal**: el año único más representativo del foco temporal de la pregunta (entero, ej. 1810, 1948, 1991). Si la pregunta abarca un proceso largo, elige el año pivote (ej. inicio del proceso, hito central, fin de etapa). Si es genuinamente transversal (siglos), usa el punto medio del período principal.
- **anios_secundarios**: 2 a 4 años adicionales que la pregunta toca de forma significativa (antecedentes, consecuencias, hitos paralelos). En orden cronológico ascendente. NO repitas anio_principal. Si la pregunta es muy puntual y no hay años secundarios claros, usa [].

### Entidades (conteo ESTRICTO)
Cada pregunta debe incluir exactamente:
- **5 personas**: actores históricos individuales (Bolívar, Gaitán, Uribe, etc.). Si la pregunta no tiene 5 personas obvias, incluye actores institucionales personificables (un presidente, un líder gremial, un caudillo regional) o actores colectivos con nombre propio (FARC, M-19, ANUC). Nombres completos cuando sea posible.
- **3 lugares**: territorios, regiones, ciudades, países o accidentes geográficos relevantes (Bogotá, Antioquia, Panamá, Magdalena Medio). Si la pregunta es nacional, mezcla escalas (nacional + regional + local o internacional).
- **4 conceptos**: nociones analíticas, procesos, ideologías o instituciones (liberalismo, federalismo, hacienda cafetera, narcotráfico, paz negociada, soberanía popular). Evita repetir el título del período histórico.

REGLA CRÍTICA: los conteos son ESTRICTOS — exactamente 5/3/4. No menos, no más. Si tienes dudas, fuerza la inclusión con entidades plausibles del contexto histórico (no inventes nombres falsos, pero sí puedes nombrar entidades estructurales del período).

## TAXONOMÍA DE PERÍODOS HISTÓRICOS

### PRE — Período Prehispánico (antes de 1499)
### CON — Conquista y Colonia Temprana (1499–1599)
### COL — Colonia Madura (1600–1780)
### PRE_IND — Crisis Colonial y Pre-Independencia (1780–1809)
### IND — Independencia y Gran Colombia (1810–1831)
### NGR — Nueva Granada y Reformas Liberales (1831–1862)
### EUC — Estados Unidos de Colombia y Radicalismo (1863–1885)
### REG — Regeneración y Hegemonía Conservadora (1886–1929)
### REP_LIB — República Liberal (1930–1946)
### VIO — La Violencia y Dictadura (1946–1957)
### FN — Frente Nacional (1958–1974)
### CNA — Crisis, Narcotráfico y Apertura (1974–1990)
### C91 — Constitución del 91 y Escalamiento del Conflicto (1991–2002)
### SDE — Seguridad Democrática y Proceso de Paz (2002–2016)
### POS — Posconflicto y Colombia Contemporánea (2016–presente)
### TRANS — Transversal / Larga Duración (abarca 3+ períodos)

## TAXONOMÍA DE CATEGORÍAS Y SUBCATEGORÍAS

### POL — Política y Estado
POL.FOR, POL.REG, POL.PAR, POL.ELE, POL.CON, POL.DES, POL.COR, POL.MIL, POL.REF, POL.OPO

### ECO — Economía y Desarrollo
ECO.AGR, ECO.EXT, ECO.EXP, ECO.IND, ECO.FIS, ECO.MON, ECO.LAB, ECO.INF, ECO.APE, ECO.DES

### CON — Conflicto Armado y Violencia
CON.GCI, CON.VIO, CON.GUE, CON.PAR, CON.NAR, CON.DES, CON.PAZ, CON.JTR, CON.MEM, CON.DDH, CON.GEO

### SOC — Sociedad y Estructura Social
SOC.CLA, SOC.RAZ, SOC.IND, SOC.AFR, SOC.GEN, SOC.URB, SOC.RUR, SOC.MIG, SOC.DEM, SOC.EDU, SOC.FAM

### CUL — Cultura, Ideología y Producción Intelectual
CUL.IDE, CUL.REL, CUL.LIT, CUL.ART, CUL.PER, CUL.INT, CUL.POP, CUL.CIE, CUL.LEN

### REL — Relaciones Internacionales y Geopolítica
REL.ESP, REL.USA, REL.LAT, REL.EUR, REL.GFR, REL.PAN, REL.FRO, REL.COM, REL.ORI, REL.MUL

### TER — Territorio, Región y Medio Ambiente
TER.REG, TER.FRO, TER.GEO, TER.AMB, TER.TIE, TER.COC, TER.RES, TER.CIU

### MOV — Movimientos Sociales y Acción Colectiva
MOV.OBR, MOV.CAM, MOV.EST, MOV.CIV, MOV.ETN, MOV.MUJ, MOV.PAZ, MOV.AMB, MOV.DIG, MOV.PLE

### INS — Instituciones, Derecho y Justicia
INS.JUD, INS.MIL, INS.POL, INS.IGE, INS.UNI, INS.BUR, INS.TIE, INS.BAN, INS.MED

### HIS — Historiografía y Metodología Histórica
HIS.MAR, HIS.ACA, HIS.OFI, HIS.NUE, HIS.ORA, HIS.REG, HIS.COM, HIS.MEM, HIS.FUE

## REGLAS DE CALIDAD

1. NO hagas preguntas que se respondan con un dato factual.
2. PRIORIZA preguntas causales, contrafactuales, comparativas y de consecuencias no obvias.
3. Cada pregunta debe tener entre 30 y 120 palabras.
4. Al menos 3 preguntas deben conectar con procesos más amplios de América Latina o del mundo.
5. Al menos 2 preguntas deben cuestionar narrativas establecidas o supuestos historiográficos.
6. Ninguna pregunta debe requerir haber leído el documento para ser comprendida.`;
}

// ─── Selección de chunks para la generación ──────────────────────────────────
//
// Estrategia: pasar el LIBRO COMPLETO a Opus 4.7 por defecto. La sampling solo
// activa cuando el corpus supera el techo seguro de contexto del modelo.
//
// Opus 4.7 en Bedrock tiene 200K tokens de contexto. Presupuesto:
//   - system prompt (~2.5K) + tool spec (~1K) + user prefix (~0.2K) = ~4K tokens
//   - output reservado (maxTokens): hasta 48K (caso N=100)
//   - headroom defensivo: 20K tokens (errores de estimación, latencias, retries)
//   = 72K tokens reservados. Resto del contexto: 128K tokens ≈ 512K chars.
// Dejamos un poco extra de margen: 480K chars.

const MAX_CHARS_PER_CHUNK = 4000; // Permitimos chunks completos (los chunks reales rara vez pasan de 2K).
const MAX_TOTAL_CHARS = 480_000;  // ~120K tokens — libro completo cabe holgado con headroom.

/**
 * Selecciona los chunks que se le pasarán a Opus para generar las preguntas.
 *
 * - Caso común (libro chico/mediano, ≤600K chars): TODOS los chunks ordenados.
 * - Caso extremo (libro gigante): preserva inicio + fin + sampling uniforme
 *   del medio, hasta llenar MAX_TOTAL_CHARS. Esto mantiene la cobertura de
 *   apertura/cierre + transversal del cuerpo, sin truncar arbitrariamente.
 */
export function selectChunksForGeneration(
  chunks: ChunkForGeneration[]
): ChunkForGeneration[] {
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  if (sorted.length === 0) return [];

  const chunkCost = (c: ChunkForGeneration) =>
    Math.min(c.content.length, MAX_CHARS_PER_CHUNK);

  // Path rápido: si el libro entero cabe, no recortamos nada.
  const fullSize = sorted.reduce((acc, c) => acc + chunkCost(c), 0);
  if (fullSize <= MAX_TOTAL_CHARS) return sorted;

  // Libro mayor al techo: sampling defensivo conservando bordes y middle pass.
  // Garantizamos los primeros y últimos N chunks (apertura y cierre del libro)
  // y luego rellenamos el centro con pasos uniformes hasta el techo.
  const EDGE = 8;
  const head = sorted.slice(0, Math.min(EDGE, sorted.length));
  const tail = sorted.slice(Math.max(0, sorted.length - EDGE));
  const middle = sorted.slice(EDGE, Math.max(EDGE, sorted.length - EDGE));

  const picked = new Map<number, ChunkForGeneration>();
  let usedChars = 0;
  for (const c of [...head, ...tail]) {
    if (picked.has(c.chunkIndex)) continue;
    picked.set(c.chunkIndex, c);
    usedChars += chunkCost(c);
  }

  // Recorrer el medio con paso uniforme hasta agotar el presupuesto.
  if (middle.length > 0 && usedChars < MAX_TOTAL_CHARS) {
    const remainingBudget = MAX_TOTAL_CHARS - usedChars;
    const avgCost = Math.max(1, Math.round(fullSize / sorted.length));
    const targetMiddle = Math.max(1, Math.floor(remainingBudget / avgCost));
    const step = Math.max(1, Math.floor(middle.length / targetMiddle));

    for (let i = 0; i < middle.length; i += step) {
      const c = middle[i];
      if (picked.has(c.chunkIndex)) continue;
      const cost = chunkCost(c);
      if (usedChars + cost > MAX_TOTAL_CHARS) break;
      picked.set(c.chunkIndex, c);
      usedChars += cost;
    }
  }

  return [...picked.values()].sort((a, b) => a.chunkIndex - b.chunkIndex);
}

// Alias retrocompatible — algunos imports externos pueden usar el nombre viejo.
export const selectRepresentativeChunks = selectChunksForGeneration;

// ─── Tool use schema (garantiza JSON válido siempre) ─────────────────────────

const GENERATE_TOOL_NAME = "generate_research_questions";

function buildGenerateToolSpec(targetCount: number) {
  return {
    name: GENERATE_TOOL_NAME,
    description: `Genera exactamente ${targetCount} preguntas de investigación histórica sobre Colombia en formato estructurado, clasificadas con la taxonomía de períodos y categorías.`,
    inputSchema: {
      json: {
        type: "object",
        properties: {
          preguntas: {
            type: "array",
            minItems: Math.max(1, Math.floor(targetCount * 0.9)),
            maxItems: targetCount,
            items: {
              type: "object",
              required: [
                "id",
                "pregunta",
                "periodo_historico",
                "categoria",
                "subcategoria",
                "periodos_relacionados",
                "categorias_relacionadas",
                "anio_principal",
                "anios_secundarios",
                "entidades",
                "justificacion",
              ],
              properties: {
                id: { type: "integer", minimum: 1, maximum: targetCount },
                pregunta: { type: "string", minLength: 20 },
                periodo_historico: {
                  type: "object",
                  required: ["codigo", "nombre", "rango_temporal"],
                  properties: {
                    codigo: { type: "string" },
                    nombre: { type: "string" },
                    rango_temporal: { type: "string" },
                  },
                },
                categoria: {
                  type: "object",
                  required: ["codigo", "nombre"],
                  properties: {
                    codigo: { type: "string" },
                    nombre: { type: "string" },
                  },
                },
                subcategoria: {
                  type: "object",
                  required: ["codigo", "nombre"],
                  properties: {
                    codigo: { type: "string" },
                    nombre: { type: "string" },
                  },
                },
                periodos_relacionados: {
                  type: "array",
                  items: { type: "string" },
                },
                categorias_relacionadas: {
                  type: "array",
                  items: { type: "string" },
                },
                anio_principal: {
                  type: "integer",
                  minimum: 1000,
                  maximum: 2100,
                },
                anios_secundarios: {
                  type: "array",
                  items: { type: "integer", minimum: 1000, maximum: 2100 },
                  minItems: 0,
                  maxItems: 4,
                },
                entidades: {
                  type: "object",
                  required: ["personas", "lugares", "conceptos"],
                  properties: {
                    personas: {
                      type: "array",
                      items: { type: "string", minLength: 2 },
                      minItems: 5,
                      maxItems: 5,
                    },
                    lugares: {
                      type: "array",
                      items: { type: "string", minLength: 2 },
                      minItems: 3,
                      maxItems: 3,
                    },
                    conceptos: {
                      type: "array",
                      items: { type: "string", minLength: 2 },
                      minItems: 4,
                      maxItems: 4,
                    },
                  },
                },
                justificacion: { type: "string", minLength: 10 },
              },
            },
          },
        },
        required: ["preguntas"],
      },
    },
  };
}

function normalizeQuestions(raw: unknown[]): QuestionData[] {
  return raw.map((q: unknown, i: number) => {
    const item = q as Record<string, unknown>;
    const periodo = (item.periodo_historico as Record<string, string>) ?? {};
    const categoria = (item.categoria as Record<string, string>) ?? {};
    const subcategoria = (item.subcategoria as Record<string, string>) ?? {};
    const entidades = (item.entidades as Record<string, unknown>) ?? {};

    const yearPrincipal =
      typeof item.anio_principal === "number" && Number.isFinite(item.anio_principal)
        ? Math.trunc(item.anio_principal as number)
        : null;

    const yearsSecondary = ((item.anios_secundarios as unknown[]) ?? [])
      .filter((y) => typeof y === "number" && Number.isFinite(y))
      .map((y) => Math.trunc(y as number));

    const cleanList = (arr: unknown): string[] =>
      ((arr as unknown[]) ?? [])
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter((s) => s.length > 0);

    return {
      questionNumber: (item.id as number) ?? i + 1,
      pregunta: (item.pregunta as string) ?? "",
      periodoCode: periodo.codigo ?? "TRANS",
      periodoNombre: periodo.nombre ?? "Transversal",
      periodoRango: periodo.rango_temporal ?? "",
      categoriaCode: categoria.codigo ?? "HIS",
      categoriaNombre: categoria.nombre ?? "Historiografía",
      subcategoriaCode: subcategoria.codigo ?? "HIS.ACA",
      subcategoriaNombre: subcategoria.nombre ?? "Historia académica",
      periodosRelacionados: ((item.periodos_relacionados as string[]) ?? []).filter(Boolean),
      categoriasRelacionadas: ((item.categorias_relacionadas as string[]) ?? []).filter(Boolean),
      yearPrincipal,
      yearsSecondary,
      entidadesPersonas: cleanList(entidades.personas),
      entidadesLugares: cleanList(entidades.lugares),
      entidadesConceptos: cleanList(entidades.conceptos),
      justificacion: (item.justificacion as string) ?? "",
    };
  });
}

// ─── Función principal ─────────────────────────────────────────────────────────

export interface GenerateOptions {
  /**
   * Cantidad de preguntas a generar (MIN_QUESTIONS_COUNT–MAX_QUESTIONS_COUNT).
   * Si no se pasa, se calcula automáticamente con computeTargetCount(chunks.length).
   */
  targetCount?: number;
}

export async function generateQuestionsForDocument(
  chunks: ChunkForGeneration[],
  filename: string,
  opts: GenerateOptions = {}
): Promise<QuestionData[]> {
  const requestedCount = opts.targetCount ?? computeTargetCount(chunks.length);
  const targetCount = Math.min(
    MAX_QUESTIONS_COUNT,
    Math.max(MIN_QUESTIONS_COUNT, requestedCount)
  );

  // Pasamos el libro completo. Si no cabe en el techo de contexto (~150K tokens
  // para Opus 4.7 200K), aplicamos sampling defensivo conservando bordes.
  const selected = selectChunksForGeneration(chunks);

  // Construir contexto con límite de chars
  let totalChars = 0;
  const parts: string[] = [];

  for (const chunk of selected) {
    const content =
      chunk.content.length > MAX_CHARS_PER_CHUNK
        ? chunk.content.slice(0, MAX_CHARS_PER_CHUNK) + "..."
        : chunk.content;
    const part = `--- Fragmento (pág. ${chunk.pageNumber}) ---\n${content}`;

    if (totalChars + part.length > MAX_TOTAL_CHARS) break;
    parts.push(part);
    totalChars += part.length;
  }

  const context = parts.join("\n\n");

  const userMessage = `Analiza los siguientes fragmentos del libro "${filename}" y genera exactamente ${targetCount} preguntas de investigación histórica sobre Colombia siguiendo todas las reglas y la taxonomía del sistema.

${context}`;

  const command = new ConverseCommand({
    modelId: QUESTIONS_MODEL,
    system: [{ text: buildSystemPrompt(targetCount) }],
    messages: [
      {
        role: "user",
        content: [{ text: userMessage }],
      },
    ],
    toolConfig: {
      tools: [{ toolSpec: buildGenerateToolSpec(targetCount) }],
      toolChoice: { tool: { name: GENERATE_TOOL_NAME } },
    },
    inferenceConfig: {
      maxTokens: maxTokensFor(targetCount),
      temperature: 0.7,
    },
  });

  // Retry con backoff exponencial.
  // Si usa el mismo modelo que el chat (Opus), usa el semáforo para serializar.
  // Si usa un modelo distinto (Sonnet), no necesita semáforo.
  const MAX_BEDROCK_RETRIES = 5;

  const sendWithRetry = async () => {
    for (let attempt = 0; attempt <= MAX_BEDROCK_RETRIES; attempt++) {
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
        if (!isRetryable || attempt === MAX_BEDROCK_RETRIES) throw err;
        const delay = Math.min(5000 * Math.pow(2, attempt), 60000);
        console.warn(`Bedrock questions model throttled (attempt ${attempt + 1}/${MAX_BEDROCK_RETRIES}), retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error("No response from Bedrock after retries");
  };

  const response = USES_SHARED_MODEL
    ? await withBedrockSemaphore(sendWithRetry)
    : await sendWithRetry();

  // Con tool use, Bedrock garantiza JSON válido conforme al schema
  const toolUseBlock = response.output?.message?.content?.find(
    (block) => block.toolUse?.name === GENERATE_TOOL_NAME
  );

  if (!toolUseBlock?.toolUse?.input) {
    throw new Error("Claude no retornó el tool use con las preguntas");
  }

  const input = toolUseBlock.toolUse.input as Record<string, unknown>;
  const preguntas = input.preguntas as unknown[];

  if (!Array.isArray(preguntas) || preguntas.length === 0) {
    throw new Error("El tool use no contiene preguntas válidas");
  }

  return normalizeQuestions(preguntas);
}
