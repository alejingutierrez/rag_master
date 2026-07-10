/**
 * El "borrador" que produce el LLM y su conversión a partitura renderizable.
 *
 * El LLM escribe strings naturales y marca el acento con *asteriscos* y la
 * itálica con _guiones bajos_ — mucho más fácil (y menos frágil) que pedirle
 * arrays de spans anidados. Aquí eso se parsea a Spans exactos y se reparten los
 * frames para cuadrar la duración objetivo.
 */
import type {
  PeriodCode, Personality, SceneBg, Scale, Span, Line, Scene, TypographicScore, LayoutKind, DistributiveOmit, Pan, Scrim,
} from "./score";
import { periodLabel } from "./periods";

/** Escena tal como la emite el LLM (campos string con marcadores). */
export type DraftScene =
  | { kind: "portada"; kicker: string; titulo: string[]; rule?: boolean; weight?: number; bg?: SceneBg }
  | { kind: "enunciado"; label?: string; titulo: string[]; sub?: string; scale?: Scale; weight?: number; bg?: SceneBg }
  | { kind: "nombre"; pre?: string; nombre: string; underline?: boolean; weight?: number; bg?: SceneBg }
  | { kind: "cifra"; pre?: string; prefix?: string; valor: number; suffix?: string; sub?: string; weight?: number; bg?: SceneBg }
  | { kind: "corte"; linea1: string; linea2: string; tags?: string[]; weight?: number; bg?: SceneBg }
  | { kind: "cierre"; mark?: string; titulo: string; meta?: string; ribbon?: PeriodCode[]; weight?: number; bg?: SceneBg }
  | { kind: "pregunta"; kicker?: string; pregunta: string[]; weight?: number; bg?: SceneBg }
  | { kind: "cita"; cita: string; autor?: string; fuente?: string; weight?: number; bg?: SceneBg }
  | { kind: "anio"; label?: string; anio: string | number; sub?: string; weight?: number; bg?: SceneBg }
  | { kind: "lista"; titulo?: string; items: string[]; weight?: number; bg?: SceneBg }
  | { kind: "contraste"; eje?: string; a: string; b: string; weight?: number; bg?: SceneBg }
  | { kind: "imagen"; image: string; kicker?: string; titulo?: string[]; pie?: string; weight?: number; bg?: SceneBg };

/** Campos de imagen que cualquier escena puede llevar (fondo / relleno de texto). */
type DraftMedia = { image?: string; imageFill?: string; pan?: Pan; scrim?: Scrim };

export interface ScoreDraft {
  periodCode: PeriodCode;
  title: string;
  scenes: DraftScene[];
}

type SceneContent = DistributiveOmit<Scene, "from" | "durationInFrames"> & { weight?: number };

// ---------- parseo de marcadores ----------

const clean = (s: unknown): string =>
  (Array.isArray(s) ? s.join(" ") : String(s ?? "")).replace(/[*_]/g, "").trim();

/** Coacciona a arreglo de líneas (los agentes a veces mandan string donde va string[]). */
const arr = (x: unknown): string[] => (Array.isArray(x) ? (x as string[]) : x == null ? [] : [String(x)]);

function splitMarker(text: string, marker: "*" | "_", flag: "accent" | "italic", base: Partial<Span>): Span[] {
  const parts: Span[] = [];
  const re = new RegExp(`\\${marker}([^\\${marker}]+)\\${marker}`, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ ...base, text: text.slice(last, m.index) });
    parts.push({ ...base, [flag]: true, text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ ...base, text: text.slice(last) });
  return parts.length ? parts : [{ ...base, text }];
}

/** "en *dos*." -> [{text:"en "},{text:"dos",accent},{text:"."}] ; soporta *_x_* */
export function parseInline(input: string): Span[] {
  input = (Array.isArray(input) ? input.join(" ") : String(input ?? "")) as string;
  const out: Span[] = [];
  for (const p of splitMarker(input, "*", "accent", {})) {
    for (const q of splitMarker(p.text, "_", "italic", { accent: p.accent })) {
      if (!q.text) continue;
      out.push({ text: q.text, ...(q.accent ? { accent: true } : {}), ...(q.italic ? { italic: true } : {}) });
    }
  }
  return out.length ? out : [{ text: clean(input) }];
}

// ---------- validación del borrador ----------

const isStr = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0;
const isStrArr = (x: unknown): x is string[] => Array.isArray(x) && x.length > 0 && x.every(isStr);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

function validScene(s: unknown): s is DraftScene {
  if (!s || typeof s !== "object") return false;
  const d = s as Record<string, unknown>;
  switch (d.kind) {
    case "portada": return isStr(d.kicker) && (isStrArr(d.titulo) || isStr(d.titulo));
    case "enunciado": return isStrArr(d.titulo) || isStr(d.titulo);
    case "nombre": return isStr(d.nombre);
    case "cifra": return isNum(d.valor);
    case "corte": return isStr(d.linea1) && isStr(d.linea2);
    case "cierre": return isStr(d.titulo);
    case "pregunta": return isStrArr(d.pregunta) || isStr(d.pregunta);
    case "cita": return isStr(d.cita);
    case "anio": return isStr(d.anio) || isNum(d.anio);
    case "lista": return Array.isArray(d.items) && d.items.length >= 2 && d.items.every(isStr);
    case "contraste": return isStr(d.a) && isStr(d.b);
    case "imagen": return isStr(d.image);
    default: return false;
  }
}

/** Valida/limpia el borrador del LLM. Lanza si no hay al menos 3 escenas válidas. */
export function parseDraft(parsed: unknown): ScoreDraft {
  const p = parsed as Record<string, unknown>;
  const periodCode = p?.periodCode as PeriodCode;
  const title = isStr(p?.title) ? clean(p.title as string) : "Historia Colombiana";
  const rawScenes = Array.isArray(p?.scenes) ? p.scenes : [];
  const scenes = rawScenes.filter(validScene) as DraftScene[];
  if (scenes.length < 3) {
    throw new Error(`borrador inválido: solo ${scenes.length} escenas válidas de ${rawScenes.length}`);
  }
  return { periodCode, title, scenes };
}

// ---------- borrador -> contenido de escena ----------

function toContent(d: DraftScene): SceneContent {
  const dm = d as DraftMedia;
  const media: DraftMedia = { image: dm.image, imageFill: dm.imageFill, pan: dm.pan, scrim: dm.scrim };
  const base: SceneContent = ((): SceneContent => {
  switch (d.kind) {
    case "portada":
      return { kind: "portada", kicker: clean(d.kicker), titulo: arr(d.titulo).map(parseInline), rule: d.rule ?? true, bg: d.bg, weight: d.weight };
    case "enunciado":
      return { kind: "enunciado", label: d.label ? clean(d.label) : undefined, titulo: arr(d.titulo).map(parseInline), sub: d.sub ? clean(d.sub) : undefined, scale: d.scale, bg: d.bg, weight: d.weight };
    case "nombre":
      return { kind: "nombre", pre: d.pre ? clean(d.pre) : undefined, nombre: clean(d.nombre), underline: d.underline ?? true, bg: d.bg, weight: d.weight };
    case "cifra": {
      const suf = d.suffix ? (/^[\s%.,]/.test(d.suffix) ? d.suffix : " " + d.suffix) : undefined;
      return { kind: "cifra", pre: d.pre ? clean(d.pre) : undefined, prefix: d.prefix, valor: d.valor, suffix: suf, sub: d.sub ? clean(d.sub) : undefined, bg: d.bg, weight: d.weight };
    }
    case "corte":
      return { kind: "corte", linea1: clean(d.linea1), linea2: { text: clean(d.linea2), accent: true }, tags: d.tags?.map(clean), bg: d.bg ?? "dark", weight: d.weight };
    case "cierre":
      return { kind: "cierre", mark: d.mark ? clean(d.mark) : "Historia Colombiana", titulo: clean(d.titulo), meta: d.meta ? clean(d.meta) : "", ribbon: d.ribbon, bg: d.bg, weight: d.weight };
    case "pregunta":
      return { kind: "pregunta", kicker: d.kicker ? clean(d.kicker) : undefined, pregunta: arr(d.pregunta).map(parseInline), bg: d.bg, weight: d.weight };
    case "cita":
      return { kind: "cita", cita: parseInline(d.cita), autor: d.autor ? clean(d.autor) : undefined, fuente: d.fuente ? clean(d.fuente) : undefined, bg: d.bg, weight: d.weight };
    case "anio":
      return { kind: "anio", label: d.label ? clean(d.label) : undefined, anio: String(d.anio), sub: d.sub ? clean(d.sub) : undefined, bg: d.bg, weight: d.weight };
    case "lista":
      return { kind: "lista", titulo: d.titulo ? clean(d.titulo) : undefined, items: d.items.map(clean), bg: d.bg, weight: d.weight };
    case "contraste":
      return { kind: "contraste", eje: d.eje ? clean(d.eje) : undefined, a: clean(d.a), b: clean(d.b), bg: d.bg, weight: d.weight };
    case "imagen":
      return { kind: "imagen", image: d.image, kicker: d.kicker ? clean(d.kicker) : undefined, titulo: d.titulo ? arr(d.titulo).map(parseInline) : undefined, pie: d.pie ? clean(d.pie) : undefined, bg: d.bg, weight: d.weight };
  }
  })();
  return { ...base, ...media };
}

// ---------- reparto de tiempo ----------

/** Base por tipo: cortas y punchy (corte, año) vs. densas de lectura (cita, lista). */
const KIND_BASE: Record<LayoutKind, number> = {
  corte: 0.7, anio: 0.85, nombre: 0.95, cifra: 1.05, contraste: 1.1, cierre: 1.0,
  enunciado: 1.15, portada: 1.25, pregunta: 1.25, lista: 1.4, cita: 1.55, imagen: 1.35,
};

/** Caracteres visibles aproximados de una escena (para dar tiempo de lectura). */
function textLen(c: SceneContent): number {
  const L = (line?: Line) => (line ? line.map((s) => s.text).join("").length : 0);
  const lines = (ls?: Line[]) => (ls ? ls.reduce((a, l) => a + L(l), 0) : 0);
  const g = (s?: string) => (s?.length ?? 0) * 0.4; // texto ojeable (labels, subs, pies) pesa menos que el titular
  switch (c.kind) {
    case "portada": return g(c.kicker) + lines(c.titulo);
    case "enunciado": return g(c.label) + lines(c.titulo) + g(c.sub);
    case "nombre": return g(c.pre) + c.nombre.length;
    case "cifra": return g(c.pre) + String(c.valor).length + g(c.sub);
    case "corte": return c.linea1.length + c.linea2.text.length + g(c.tags?.join(""));
    case "cierre": return c.titulo.length + g(c.meta);
    case "pregunta": return g(c.kicker) + lines(c.pregunta);
    case "cita": return L(c.cita) + g(c.autor);
    case "anio": return g(c.label) + c.anio.length + g(c.sub);
    case "lista": return g(c.titulo) + c.items.reduce((a, s) => a + s.length, 0);
    case "contraste": return g(c.eje) + c.a.length + c.b.length;
    case "imagen": return g(c.kicker) + lines(c.titulo) + g(c.pie);
  }
}

/**
 * Segundos de LECTURA que necesita una escena: base del tipo + palabras a ritmo
 * de lectura + tiempo de ver la imagen + overhead de entrada/salida. El video
 * dura la SUMA de estos tiempos — la duración la manda la lectura, no un total fijo.
 */
const KIND_BASE_SEC: Record<LayoutKind, number> = {
  corte: 0.8, anio: 0.7, nombre: 0.8, cifra: 1.2, contraste: 0.9, cierre: 1.0,
  enunciado: 0.7, portada: 0.9, pregunta: 1.0, lista: 0.9, cita: 1.1, imagen: 1.1,
};
function readingSeconds(c: SceneContent): number {
  const words = textLen(c) / 5.2;
  const m = c as { image?: string; imageFill?: string };
  const imgView = m.image || m.imageFill ? 0.8 : 0;
  const ENTER_EXIT = 0.6; // la entrada y la salida necesitan su propio tiempo
  const s = (KIND_BASE_SEC[c.kind] ?? 0.9) + words * 0.26 + imgView + ENTER_EXIT;
  return Math.min(6.0, Math.max(1.8, s));
}

export function assignTiming(
  contents: SceneContent[],
  opts: { durationSec?: number; fps?: number; overlap?: number; minReadSec?: number } = {}
): { scenes: Scene[]; totalFrames: number } {
  const fps = opts.fps ?? 30;
  const overlap = opts.overlap ?? 0; // cortes duros; el Escenario pone las transiciones
  // duración de cada escena = su tiempo de lectura (× weight si el guion pide énfasis)
  const cores = contents.map((c) => Math.round(readingSeconds(c) * (c.weight ?? 1) * fps));

  const scenes: Scene[] = [];
  let acc = 0;
  for (let i = 0; i < contents.length; i++) {
    const from = acc;
    acc += cores[i];
    const last = i === contents.length - 1;
    const durationInFrames = cores[i] + (last ? 0 : overlap);
    const { weight: _w, ...rest } = contents[i];
    scenes.push({ ...(rest as Omit<Scene, "from" | "durationInFrames">), from, durationInFrames } as Scene);
  }
  return { scenes, totalFrames: acc };
}

/** Borrador validado -> partitura lista para renderizar. */
export function assembleScore(
  draft: ScoreDraft,
  opts: { topic: string; personality: Personality; durationSec: number; fps?: number }
): TypographicScore {
  const contents = draft.scenes.map(toContent);
  // Garantiza cierre de marca al final.
  if (contents[contents.length - 1]?.kind !== "cierre") {
    contents.push({
      kind: "cierre",
      mark: "Historia Colombiana",
      titulo: draft.title,
      meta: periodLabel(draft.periodCode),
      ribbon: [draft.periodCode],
      weight: 0.9,
    } as SceneContent);
  }
  const fps = opts.fps ?? 30;
  const { scenes, totalFrames } = assignTiming(contents, { durationSec: opts.durationSec, fps });
  return {
    meta: {
      topic: opts.topic,
      title: draft.title,
      periodCode: draft.periodCode,
      periodLabel: periodLabel(draft.periodCode),
      personality: opts.personality,
      fps,
      width: 1080,
      height: 1920,
      durationInFrames: totalFrames,
    },
    scenes,
  };
}
