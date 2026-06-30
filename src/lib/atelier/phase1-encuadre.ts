/**
 * Fase 1 — Encuadre. Convierte la intención del autor + el formato elegido en un
 * brief de encargo: tesis tentativa (interna), ejes de indagación, scope,
 * entidades y la voz afinada. Opus. Adapta planResearch (deep-research-planner.ts).
 */
import { callClaudeJson, OPUS_MODEL } from "./bedrock-json";
import type { AtelierBrief, AtelierEntities, AtelierQuestionMeta } from "./types";
import type { AtelierFormatId } from "../atelier-formats";
import { getAtelierFormat } from "../atelier-formats";
import { getFormatConfig } from "./format-config";

const uniq = (xs: string[]): string[] => Array.from(new Set(xs.map((s) => s.trim()).filter(Boolean)));

/** Renderiza la metadata curada de la pregunta como pistas para el encuadre. */
function buildQuestionHints(m: AtelierQuestionMeta): string {
  const lines: string[] = [];
  const periodo = `${m.periodoNombre ?? ""}${m.periodoRango ? ` (${m.periodoRango})` : ""}`.trim();
  if (periodo) lines.push(`- Período: ${periodo}`);
  if (m.categoriaNombre) lines.push(`- Categoría: ${m.categoriaNombre}`);
  if (m.yearPrincipal) lines.push(`- Año principal: ${m.yearPrincipal}`);
  if (m.escalaGeografica) lines.push(`- Escala geográfica: ${m.escalaGeografica}`);
  const ents = [
    m.entidadesPersonas?.length ? `Personas: ${m.entidadesPersonas.join(", ")}` : "",
    m.entidadesLugares?.length ? `Lugares: ${m.entidadesLugares.join(", ")}` : "",
    m.entidadesConceptos?.length ? `Conceptos: ${m.entidadesConceptos.join(", ")}` : "",
  ].filter(Boolean);
  if (ents.length) lines.push(`- Entidades ya identificadas en el corpus: ${ents.join(" · ")}`);
  if (m.clusterTematico) lines.push(`- Eje narrativo del corpus: "${m.clusterTematico}"`);
  if (m.hipotesisImplicita) lines.push(`- Hipótesis implícita de la pregunta: ${m.hipotesisImplicita}`);
  if (m.problemaSubyacente) lines.push(`- Problema histórico de fondo: ${m.problemaSubyacente}`);
  if (m.tesisEnTension?.length) {
    lines.push(
      `- Tesis en tensión a sostener y confrontar:\n${m.tesisEnTension.map((t, i) => `    ${i + 1}) ${t}`).join("\n")}`
    );
  }
  if (lines.length === 0) return "";
  return `PISTAS CURADAS DEL CORPUS (esta pregunta ya fue analizada; úsalas como punto de partida para afinar los ejes, las entidades y la temporalidad — no las ignores ni re-derives todo desde cero):\n${lines.join("\n")}`;
}

const ENCUADRE_SYSTEM = `Eres el director editorial de un taller de escritura histórica sobre Colombia y América Latina: el que huele un buen tema, sabe dónde está enterrado en el archivo y manda al investigador a desenterrarlo por los flancos correctos. Recibes la INTENCIÓN de un autor y el FORMATO elegido, y produces un brief de encargo que guiará (1) una investigación sobre un corpus documental y (2) la redacción posterior de una pieza pulida.

Tu tarea:

1. Identifica la temporalidad, las entidades nombradas (personas, instituciones, lugares), los conceptos clave y la geografía implícitos o explícitos en la intención. Sé generoso: nombra a todos los actores y lugares que el tema arrastra, no solo los obvios — cada entidad es una puerta de entrada al corpus.
2. Formula una TESIS TENTATIVA: la intuición o el ángulo que vertebrará la pieza. Es una guía INTERNA para enfocar la indagación — NO una conclusión a defender, NO algo que el lector verá enunciado.
3. Delimita el SCOPE en 1-2 frases (qué entra y qué no).
4. Genera de {MIN_EJES} a {MAX_EJES} EJES de indagación: sub-preguntas concretas, con nombres/fechas/conceptos, ejecutables como búsqueda en un corpus histórico. Cada eje debe MORDER UN ÁNGULO DISTINTO para que la investigación cruce fuentes de verdad y no traiga cinco veces el mismo fragmento. Reparte la cobertura entre: contexto y antecedentes, actores e instituciones, causas estructurales, detonantes coyunturales, eventos y cronología, consecuencias de corto y largo plazo, voces y tesis en disputa, dimensión geográfica/territorial, y vida material/cotidiana. Cada eje SIEMPRE específico al tema — nunca genérico como "¿cuál es el contexto?". Más ejes y más diversos = más documentos distintos en la mesa de triangulación; exprímelos.
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
  questionMeta?: AtelierQuestionMeta;
}): Promise<AtelierBrief> {
  const meta = getAtelierFormat(args.formatId);
  const cfg = getFormatConfig(args.formatId);
  const system = ENCUADRE_SYSTEM.replace("{FORMAT_NAME}", meta?.name ?? args.formatId)
    .replace("{FORMAT_DESC}", meta?.description ?? "")
    .replace("{MIN_EJES}", String(cfg.minEjes))
    .replace("{MAX_EJES}", String(cfg.maxEjes));

  const hints = args.questionMeta ? buildQuestionHints(args.questionMeta) : "";
  const user = `INTENCIÓN DEL AUTOR:\n${args.intent}${hints ? `\n\n${hints}` : ""}\n\nJSON:`;

  const raw = await callClaudeJson<EncuadreRaw>({
    model: OPUS_MODEL,
    system,
    user,
    maxTokens: 6000,
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
  ejes = ejes.slice(0, cfg.maxEjes);

  // Funde las entidades curadas de la pregunta con las que derivó el modelo:
  // no se pierde lo que el corpus ya sabía.
  const entities = normEntities(raw.entities);
  const qm = args.questionMeta;
  if (qm) {
    entities.personas = uniq([...entities.personas, ...(qm.entidadesPersonas ?? [])]);
    entities.lugares = uniq([...entities.lugares, ...(qm.entidadesLugares ?? [])]);
    entities.conceptos = uniq([...entities.conceptos, ...(qm.entidadesConceptos ?? [])]);
    if (!entities.temporalidad && qm.periodoRango) entities.temporalidad = qm.periodoRango;
  }

  return {
    thinking: raw.thinking ?? "",
    tesisTentativa: raw.tesisTentativa?.trim() || qm?.hipotesisImplicita || "",
    scope: raw.scope ?? "",
    entities,
    ejes,
    ficha: {
      formato: args.formatId,
      voz: raw.voz ?? meta?.description ?? "",
      extensionTarget: args.extensionTarget,
    },
  };
}
