import type { StructuredData } from "../typology-schemas";
import type { DownloadedReference, ReferenceContext } from "./reference-search";

export type ReferenceRole =
  | "people-scene"
  | "portrait"
  | "place"
  | "artifact"
  | "document"
  | "atmosphere";

export type SceneMode =
  | "public-scene"
  | "portrait"
  | "real-place"
  | "artifact-detail"
  | "conceptual-documentary"
  | "atmosphere";

export interface ReferenceBrief {
  /** 1-based index: matches the order passed to images/edits and shown in prompts. */
  index: number;
  title: string;
  provider: string;
  score: number;
  page?: string;
  role: ReferenceRole;
  reason: string;
}

export interface DocumentaryScenePlan {
  mode: SceneMode;
  primaryReferenceIndex: number;
  primaryReferenceTitle: string;
  anchorEs: string;
  anchorEn: string;
  creativeMove: string;
  constraints: string[];
  warnings: string[];
}

export interface DirectionWithSceneFields {
  accentColor: string;
  accentTarget: string;
  accentTargetEs: string;
  encuadre: string;
  razon: string;
  escena?: string;
  sceneMode?: SceneMode;
  primaryReferenceIndex?: number;
  sceneAnchor?: string;
  sceneAnchorEs?: string;
  creativeMove?: string;
  historicalConstraints?: string[];
  warnings?: string[];
}

const GROUP_SCENE_RE =
  /\b(parlament|president|presidente|congreso|senado|ministro|gabinete|reunion|reunión|meeting|assembly|recepci[oó]n|junto al|junto a|comitiva|delegaci[oó]n)\b/i;
const PLACE_RE =
  /\b(bogot[aá]|plaza|parque|avenida|calle|hotel|iglesia|catedral|palacio|capitolio|puente|r[ií]o|valle|ciudad|town|street|square|market|building)\b/i;
const DOCUMENT_RE =
  /\b(constituci[oó]n|carta|mapa|documento|folio|manuscrito|pasqu[ií]n|prensa|pergamino|book|libro|map|document|letter|newspaper|gazette)\b/i;
const ARTIFACT_RE =
  /\b(cer[aá]mica|jar|ornament|nariguera|batea|textil|tela|uniforme|sello|moneda|billete|vasija|fragment|object|artifact|pieza|herramienta)\b/i;
const STILL_LIFE_RE =
  /\b(tintero|inkwell|escritorio|desk|folders?|carpetas?|mesa|table|documentos?|documents?|folios?|libretas?|books?|mapa|map|sello|seal|vela|candle|billetes?|banknotes?|fajo|batea|jar|ceramic|pergamino)\b/i;

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesName(title: string, name: string): boolean {
  const cleanName = norm(name).replace(/\([^)]*\)/g, "").trim();
  if (!cleanName || cleanName.length < 4) return false;
  return norm(title).includes(cleanName);
}

function matchingAnchor(title: string, ctx: ReferenceContext): string | null {
  const placeKeys = new Set((ctx.lugares ?? []).map((l) => norm(l)));
  for (const anchor of ctx.visualAnchors ?? []) {
    const clean = anchor.trim();
    if (!clean || placeKeys.has(norm(clean))) continue;
    if (includesName(title, clean)) return clean;
  }
  for (const entity of ctx.entidades ?? []) {
    const clean = entity.split(":")[0]?.trim() ?? "";
    if (clean && includesName(title, clean)) return clean;
  }
  return null;
}

function matchingPlace(title: string, ctx: ReferenceContext): string | null {
  for (const place of ctx.lugares ?? []) {
    if (includesName(title, place)) return place;
  }
  return null;
}

function classifyReference(title: string, ctx: ReferenceContext): Pick<ReferenceBrief, "role" | "reason"> {
  if (GROUP_SCENE_RE.test(title)) {
    return {
      role: "people-scene",
      reason: "muestra una escena pública o política con figuras humanas",
    };
  }
  if (DOCUMENT_RE.test(title)) {
    return {
      role: "document",
      reason: "sirve como documento u objeto gráfico de apoyo histórico",
    };
  }
  if (ARTIFACT_RE.test(title)) {
    return {
      role: "artifact",
      reason: "sirve como objeto material o pieza de museo",
    };
  }
  const anchor = matchingAnchor(title, ctx);
  if (anchor) {
    return {
      role: "portrait",
      reason: `coincide con la persona o entidad visual "${anchor}"`,
    };
  }
  const place = matchingPlace(title, ctx);
  if (place || PLACE_RE.test(title)) {
    return {
      role: "place",
      reason: place ? `coincide con el lugar "${place}"` : "muestra arquitectura o lugar real",
    };
  }
  return {
    role: "atmosphere",
    reason: "aporta atmósfera visual, pero no gobierna la escena principal",
  };
}

export function buildReferenceBriefs(
  refs: Array<Pick<DownloadedReference, "meta">>,
  ctx: ReferenceContext
): ReferenceBrief[] {
  return refs.map((ref, i) => {
    const title = ref.meta.title || "referencia visual";
    const c = classifyReference(title, ctx);
    return {
      index: i + 1,
      title,
      provider: ref.meta.provider,
      score: ref.meta.score,
      page: ref.meta.page,
      ...c,
    };
  });
}

function rolePriority(kind: string | undefined, role: ReferenceRole): number {
  if (kind === "entidad") {
    return { portrait: 100, "people-scene": 85, place: 50, artifact: 40, document: 35, atmosphere: 10 }[role];
  }
  if (kind === "epoca") {
    return { "people-scene": 100, place: 85, portrait: 75, artifact: 65, document: 60, atmosphere: 20 }[role];
  }
  if (kind === "hecho") {
    return { "people-scene": 100, place: 90, document: 75, artifact: 70, portrait: 65, atmosphere: 20 }[role];
  }
  return { "people-scene": 85, place: 80, portrait: 70, document: 65, artifact: 60, atmosphere: 30 }[role];
}

function choosePrimaryReference(
  structured: StructuredData | null,
  briefs: ReferenceBrief[]
): ReferenceBrief | null {
  if (!briefs.length) return null;
  return [...briefs].sort((a, b) => {
    const pa = rolePriority(structured?.typology, a.role) + a.score;
    const pb = rolePriority(structured?.typology, b.role) + b.score;
    if (pb !== pa) return pb - pa;
    return a.index - b.index;
  })[0];
}

function modeFor(role: ReferenceRole, structured: StructuredData | null): SceneMode {
  if (structured?.typology === "entidad" && structured.tipo === "Persona") return "portrait";
  if (role === "people-scene") return "public-scene";
  if (role === "portrait") return "portrait";
  if (role === "place") return "real-place";
  if (role === "artifact" || role === "document") return "artifact-detail";
  return structured?.typology === "pregunta" ? "conceptual-documentary" : "atmosphere";
}

export function inferDocumentaryScenePlan(
  structured: StructuredData | null,
  ctx: ReferenceContext,
  briefs: ReferenceBrief[]
): DocumentaryScenePlan | null {
  const primary = choosePrimaryReference(structured, briefs);
  if (!primary) return null;

  const mode = modeFor(primary.role, structured);
  const title = primary.title;
  const period = ctx.periodoLabel || (structured?.typology === "epoca" ? structured.rango ?? "" : "");
  const periodEs = period ? ` del periodo ${period}` : "";
  const periodEn = period ? ` from the period ${period}` : "";

  const baseConstraint = `La escena principal debe venir de la referencia #${primary.index}; no reemplazarla por una metáfora u objeto aislado.`;
  const accentConstraint = "El acento de color debe ser secundario: vive dentro de la escena anclada, no como sujeto sustituto.";

  if (mode === "public-scene") {
    return {
      mode,
      primaryReferenceIndex: primary.index,
      primaryReferenceTitle: title,
      anchorEs: `Escena pública o política de época anclada en la referencia #${primary.index} ("${title}")${periodEs}, con personas, vestuario y espacio institucional o social coherentes con el momento histórico.`,
      anchorEn: `A period public or political scene anchored in reference #${primary.index} ("${title}")${periodEn}, with people, clothing and institutional or social setting faithful to the historical moment.`,
      creativeMove: "A composed documentary medium shot, strong period body language, layered faces and architecture, archival light, not a still-life.",
      constraints: [baseConstraint, "Debe haber figuras humanas de época; no bodegón sin personas.", accentConstraint],
      warnings: [],
    };
  }

  if (mode === "portrait") {
    return {
      mode,
      primaryReferenceIndex: primary.index,
      primaryReferenceTitle: title,
      anchorEs: `Retrato o figura pública anclada en la referencia #${primary.index} ("${title}")${periodEs}.`,
      anchorEn: `A portrait or public figure scene anchored in reference #${primary.index} ("${title}")${periodEn}.`,
      creativeMove: "A dignified documentary portrait with period clothing, restrained expression and archival side light.",
      constraints: [baseConstraint, "El rostro, vestuario y postura deben tomar su ancla de la referencia principal.", accentConstraint],
      warnings: [],
    };
  }

  if (mode === "real-place") {
    return {
      mode,
      primaryReferenceIndex: primary.index,
      primaryReferenceTitle: title,
      anchorEs: `Lugar real o arquitectura anclada en la referencia #${primary.index} ("${title}")${periodEs}.`,
      anchorEn: `A real place or architectural scene anchored in reference #${primary.index} ("${title}")${periodEn}.`,
      creativeMove: "A documentary establishing composition with period atmosphere, people or traces of use at human scale.",
      constraints: [baseConstraint, "La arquitectura o geografía real debe gobernar la escena.", accentConstraint],
      warnings: [],
    };
  }

  return {
    mode,
    primaryReferenceIndex: primary.index,
    primaryReferenceTitle: title,
    anchorEs: `Detalle material anclado en la referencia #${primary.index} ("${title}")${periodEs}.`,
    anchorEn: `A material documentary detail anchored in reference #${primary.index} ("${title}")${periodEn}.`,
    creativeMove: "A close documentary composition that treats the object as evidence, with surrounding period context.",
    constraints: [
      baseConstraint,
      "El objeto puede ser protagonista solo porque la referencia principal es material o documental.",
      accentConstraint,
    ],
    warnings: [],
  };
}

function accentReplacement(color: string): { en: string; es: string } {
  const c = color === "rojo" ? "red" : color === "amarillo" ? "ochre-yellow" : "blue";
  const es = color === "rojo" ? "rojo" : color === "amarillo" ? "amarillo ocre" : "azul";
  return {
    en: `one small ${c} period-accurate detail worn or held by a figure inside the anchored public scene, never the main subject`,
    es: `un pequeño detalle ${es} de época portado o sostenido por una figura dentro de la escena pública anclada, nunca el sujeto principal`,
  };
}

export function applyDocumentaryScenePlan<T extends DirectionWithSceneFields>(
  direction: T,
  plan: DocumentaryScenePlan | null,
  typology?: string
): T {
  if (!plan) return direction;
  const out: T = {
    ...direction,
    sceneMode: direction.sceneMode ?? plan.mode,
    primaryReferenceIndex: direction.primaryReferenceIndex ?? plan.primaryReferenceIndex,
    sceneAnchor: direction.sceneAnchor ?? plan.anchorEn,
    sceneAnchorEs: direction.sceneAnchorEs ?? plan.anchorEs,
    creativeMove: direction.creativeMove ?? plan.creativeMove,
    historicalConstraints:
      direction.historicalConstraints && direction.historicalConstraints.length
        ? direction.historicalConstraints
        : plan.constraints,
    warnings: [...(direction.warnings ?? []), ...plan.warnings],
  };

  const warnings = new Set(out.warnings ?? []);
  if (typology === "epoca" && plan.mode === "public-scene") {
    if (out.encuadre === "detalle" || out.encuadre === "interior") {
      out.encuadre = "plano-medio";
      warnings.add("encuadre-replaced-by-documentary-scene-guard");
    }
    if (STILL_LIFE_RE.test(`${out.accentTarget} ${out.accentTargetEs}`)) {
      const replacement = accentReplacement(out.accentColor);
      out.accentTarget = replacement.en;
      out.accentTargetEs = replacement.es;
      warnings.add("accent-target-replaced-by-documentary-scene-guard");
    }
  }

  const sceneParts = [plan.anchorEn, out.creativeMove ?? plan.creativeMove, out.escena]
    .filter((part): part is string => Boolean(part && part.trim()));
  out.escena = sceneParts.join(" ");
  out.warnings = Array.from(warnings);
  return out;
}
