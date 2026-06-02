/**
 * Fase 1 — Encuadre. Convierte la intención del autor + el formato elegido en un
 * brief de encargo: tesis tentativa (interna), ejes de indagación, scope,
 * entidades y la voz afinada. Opus. Adapta planResearch (deep-research-planner.ts).
 */
import { callClaudeJson, OPUS_MODEL } from "./bedrock-json";
import type { AtelierBrief, AtelierEntities } from "./types";
import type { AtelierFormatId } from "../atelier-formats";
import { getAtelierFormat } from "../atelier-formats";

const MAX_EJES = Number(process.env.ATELIER_MAX_EJES ?? "6");

const ENCUADRE_SYSTEM = `Eres el director editorial de un taller de escritura histórica sobre Colombia y América Latina. Recibes la INTENCIÓN de un autor y el FORMATO elegido, y produces un brief de encargo que guiará (1) una investigación sobre un corpus documental y (2) la redacción posterior de una pieza pulida.

Tu tarea:

1. Identifica la temporalidad, las entidades nombradas (personas, instituciones, lugares), los conceptos clave y la geografía implícitos o explícitos en la intención.
2. Formula una TESIS TENTATIVA: la intuición o el ángulo que vertebrará la pieza. Es una guía INTERNA para enfocar la indagación — NO una conclusión a defender, NO algo que el lector verá enunciado.
3. Delimita el SCOPE en 1-2 frases (qué entra y qué no).
4. Genera de 4 a 6 EJES de indagación: sub-preguntas concretas, con nombres/fechas/conceptos, ejecutables como búsqueda en un corpus histórico. Que cubran ángulos complementarios (contexto, actores e instituciones, causas, eventos y cronología, consecuencias, miradas en disputa) PERO siempre específicas al tema — nunca genéricas como "¿cuál es el contexto?".
5. Afina la VOZ para este encargo concreto, dentro del registro del formato.

Formato elegido: {FORMAT_NAME} — {FORMAT_DESC}

Devuelve JSON puro (sin markdown, sin texto alrededor):

{
  "thinking": "2-3 frases sobre por qué elegiste estos ejes",
  "tesisTentativa": "la intuición que vertebra la pieza (interna)",
  "scope": "delimitación clara",
  "entities": {
    "personas": ["nombre completo"],
    "instituciones": ["nombre"],
    "lugares": ["lugar"],
    "conceptos": ["concepto"],
    "temporalidad": "ej. 1948-1958 / La Violencia"
  },
  "ejes": ["eje 1 concreto", "eje 2", "..."],
  "voz": "1-2 frases afinando la voz para este encargo"
}

NO incluyas texto antes o después del JSON.`;

interface EncuadreRaw {
  thinking?: string;
  tesisTentativa?: string;
  scope?: string;
  entities?: Partial<AtelierEntities>;
  ejes?: unknown;
  voz?: string;
}

function normEntities(e?: Partial<AtelierEntities>): AtelierEntities {
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return {
    personas: arr(e?.personas),
    instituciones: arr(e?.instituciones),
    lugares: arr(e?.lugares),
    conceptos: arr(e?.conceptos),
    temporalidad: typeof e?.temporalidad === "string" ? e.temporalidad : "",
  };
}

export async function buildBrief(args: {
  intent: string;
  formatId: AtelierFormatId;
  extensionTarget: number;
}): Promise<AtelierBrief> {
  const meta = getAtelierFormat(args.formatId);
  const system = ENCUADRE_SYSTEM.replace("{FORMAT_NAME}", meta?.name ?? args.formatId).replace(
    "{FORMAT_DESC}",
    meta?.description ?? ""
  );

  const raw = await callClaudeJson<EncuadreRaw>({
    model: OPUS_MODEL,
    system,
    user: `INTENCIÓN DEL AUTOR:\n${args.intent}\n\nJSON:`,
    maxTokens: 4000,
    validate: (parsed) => {
      if (!parsed || typeof parsed !== "object") throw new Error("brief no es objeto");
      return parsed as EncuadreRaw;
    },
  });

  let ejes = Array.isArray(raw.ejes)
    ? raw.ejes.filter((e): e is string => typeof e === "string" && e.trim().length > 0)
    : [];
  // Degradación: si el modelo no produjo ejes, indagar la intención cruda.
  if (ejes.length === 0) ejes = [args.intent];
  ejes = ejes.slice(0, MAX_EJES);

  return {
    thinking: raw.thinking ?? "",
    tesisTentativa: raw.tesisTentativa ?? "",
    scope: raw.scope ?? "",
    entities: normEntities(raw.entities),
    ejes,
    ficha: {
      formato: args.formatId,
      voz: raw.voz ?? meta?.description ?? "",
      extensionTarget: args.extensionTarget,
    },
  };
}
