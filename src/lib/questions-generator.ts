import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";
import { withBedrockSemaphore } from "./bedrock-semaphore";

const bedrock = new BedrockRuntimeClient(awsConfig);

const CLAUDE_MODEL =
  process.env.BEDROCK_CLAUDE_MODEL_ID ||
  "us.anthropic.claude-opus-4-6-20250610-v1:0";

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
  justificacion: string;
}

interface ChunkForGeneration {
  content: string;
  pageNumber: number;
  chunkIndex: number;
}

// ─── Prompt del sistema (taxonomía completa) ──────────────────────────────────

const QUESTIONS_SYSTEM_PROMPT = `Eres un historiador experto en Colombia con formación interdisciplinaria (historia, ciencia política, economía, sociología, antropología). Tu tarea es analizar el documento proporcionado y generar exactamente 20 preguntas de investigación profundas sobre la historia de Colombia.

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
    "justificacion": "Breve explicación (1-2 oraciones) de por qué esta pregunta es relevante para la investigación histórica sobre Colombia"
  }
]

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

// ─── Selección representativa de chunks ───────────────────────────────────────

const MAX_CHARS_PER_CHUNK = 1500;
const MAX_TOTAL_CHARS = 50_000;

export function selectRepresentativeChunks(
  chunks: ChunkForGeneration[],
  targetCount = 30
): ChunkForGeneration[] {
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const total = sorted.length;

  if (total <= targetCount) return sorted;

  // Distribuir uniformemente: inicio + medio + fin
  const selected: ChunkForGeneration[] = [];
  const step = Math.floor(total / targetCount);

  for (let i = 0; i < targetCount; i++) {
    const idx = Math.min(i * step, total - 1);
    selected.push(sorted[idx]);
  }

  // Garantizar primeros y últimos 3 chunks (contexto de apertura y cierre)
  const firstThree = sorted.slice(0, 3);
  const lastThree = sorted.slice(-3);
  const combined = [
    ...firstThree,
    ...selected,
    ...lastThree,
  ];

  // Deduplicar por chunkIndex
  const seen = new Set<number>();
  const deduped = combined.filter((c) => {
    if (seen.has(c.chunkIndex)) return false;
    seen.add(c.chunkIndex);
    return true;
  });

  return deduped.sort((a, b) => a.chunkIndex - b.chunkIndex);
}

// ─── Tool use schema (garantiza JSON válido siempre) ─────────────────────────

const GENERATE_TOOL_NAME = "generate_research_questions";

const GENERATE_TOOL_SPEC = {
  name: GENERATE_TOOL_NAME,
  description:
    "Genera exactamente 20 preguntas de investigación histórica sobre Colombia en formato estructurado, clasificadas con la taxonomía de períodos y categorías.",
  inputSchema: {
    json: {
      type: "object",
      properties: {
        preguntas: {
          type: "array",
          minItems: 1,
          maxItems: 20,
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
              "justificacion",
            ],
            properties: {
              id: { type: "integer", minimum: 1, maximum: 20 },
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
              justificacion: { type: "string", minLength: 10 },
            },
          },
        },
      },
      required: ["preguntas"],
    },
  },
};

function normalizeQuestions(raw: unknown[]): QuestionData[] {
  return raw.map((q: unknown, i: number) => {
    const item = q as Record<string, unknown>;
    const periodo = (item.periodo_historico as Record<string, string>) ?? {};
    const categoria = (item.categoria as Record<string, string>) ?? {};
    const subcategoria = (item.subcategoria as Record<string, string>) ?? {};

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
      justificacion: (item.justificacion as string) ?? "",
    };
  });
}

// ─── Función principal ─────────────────────────────────────────────────────────

export async function generateQuestionsForDocument(
  chunks: ChunkForGeneration[],
  filename: string
): Promise<QuestionData[]> {
  const selected = selectRepresentativeChunks(chunks);

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

  const userMessage = `Analiza los siguientes fragmentos del libro "${filename}" y genera exactamente 20 preguntas de investigación histórica sobre Colombia siguiendo todas las reglas y la taxonomía del sistema.

${context}`;

  const command = new ConverseCommand({
    modelId: CLAUDE_MODEL,
    system: [{ text: QUESTIONS_SYSTEM_PROMPT }],
    messages: [
      {
        role: "user",
        content: [{ text: userMessage }],
      },
    ],
    toolConfig: {
      tools: [{ toolSpec: GENERATE_TOOL_SPEC }],
      toolChoice: { tool: { name: GENERATE_TOOL_NAME } },
    },
    inferenceConfig: {
      maxTokens: 16000,
      temperature: 0.7,
    },
  });

  // Serializar acceso a Bedrock + retry con backoff exponencial
  const response = await withBedrockSemaphore(async () => {
    const MAX_BEDROCK_RETRIES = 3;
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
        const delay = Math.min(5000 * Math.pow(2, attempt), 30000);
        console.warn(`Bedrock throttled (attempt ${attempt + 1}/${MAX_BEDROCK_RETRIES}), retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error("No response from Bedrock after retries");
  });

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
