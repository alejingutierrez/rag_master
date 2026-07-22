/**
 * Datos estructurados por TIPOLOGÍA de página pública.
 *
 * El Taller escribe prosa (markdown) + aparato crítico. Pero las páginas públicas
 * de hecho / época / entidad / pregunta necesitan CAMPOS: fecha, protagonistas,
 * causas, hitos, roles, etc. Este módulo define esos campos y un normalizador
 * puro (tolerante, sin red) que valida el JSON crudo del extractor.
 *
 * Se persiste en `Deliverable.structuredData` (JSONB). Editable en Producciones.
 * Discriminado por `typology`. Si el normalizador no puede construir algo usable,
 * devuelve null → la pieza sigue siendo un ensayo normal, sin ficha de tipología.
 */

export type TypologyKind = "hecho" | "epoca" | "entidad" | "pregunta";
export const TYPOLOGY_KINDS: readonly TypologyKind[] = ["hecho", "epoca", "entidad", "pregunta"];

export type EntidadTipo = "Persona" | "Lugar" | "Concepto" | "Institución";
export const ENTIDAD_TIPOS: readonly EntidadTipo[] = ["Persona", "Lugar", "Concepto", "Institución"];

export interface Hito {
  year: number | null;
  titulo: string;
  detalle?: string;
}

interface BaseStructured {
  typology: TypologyKind;
  /** Slug URL (kebab, sin acentos). Único por tipología al publicar. */
  slug: string;
  /** Título de la ficha (o nombre de la entidad). */
  titulo: string;
  /** Bajante de 1–2 frases; el gancho de la página. */
  resumen: string;
  /** Código de período canónico (taxonomy). Puede ser null. */
  periodoCode: string | null;
  /**
   * Anclaje geográfico principal de la pieza — el punto donde ocurre el hecho,
   * donde está el lugar, donde transcurre la vida, o donde se gesta la idea.
   * Alimenta el mapa navegable. Toda tipología lo lleva: una idea sin geografía
   * es rara, y cuando de verdad no aplica queda en null y no se pinta.
   */
  lugarPrincipal: string | null;
  /** Latitud decimal (WGS84). Rango útil de Colombia: -4.3 … 13.5. */
  lat: number | null;
  /** Longitud decimal (WGS84). Rango útil de Colombia: -82 … -66.8. */
  lng: number | null;
}

export interface HechoStructured extends BaseStructured {
  typology: "hecho";
  /** Etiqueta legible: "9 de abril de 1948" o "1899–1902". */
  fecha: string | null;
  /** Año de inicio (para orden cronológico). */
  anioInicio: number | null;
  /** Año de fin (si es un proceso/rango). */
  anioFin: number | null;
  lugares: string[];
  protagonistas: string[];
  causas: string[];
  consecuencias: string[];
  /** Por qué importa (1–3 frases). */
  porQueImporta: string;
}

export interface EpocaStructured extends BaseStructured {
  typology: "epoca";
  /** Rango de años legible: "1863–1885". */
  rango: string | null;
  /** Panorama del período (2–4 frases). */
  panorama: string;
  hitos: Hito[];
  actores: string[];
  transformaciones: string[];
  /** Qué dejó el período (1–3 frases). */
  legado: string;
}

export interface EntidadStructured extends BaseStructured {
  typology: "entidad";
  tipo: EntidadTipo;
  /** Solo Persona. Etiqueta legible o null. */
  nacimiento: string | null;
  muerte: string | null;
  /** Roles / cargos / oficios (Persona) o naturaleza (Lugar/Concepto). */
  roles: string[];
  hitos: Hito[];
  /** Personas/lugares/conceptos relacionados. */
  relaciones: string[];
  /** Semblanza (3–5 frases), distinta del resumen corto. */
  semblanza: string;
}

export interface PreguntaStructured extends BaseStructured {
  typology: "pregunta";
  /** La pregunta en sí. */
  pregunta: string;
  /** Tesis / respuesta breve (2–4 frases). */
  tesis: string;
  /** La tensión o debate que la pregunta abre. */
  debate: string;
  temasRelacionados: string[];
}

export type StructuredData =
  | HechoStructured
  | EpocaStructured
  | EntidadStructured
  | PreguntaStructured;

// ── Helpers puros ────────────────────────────────────────────────────

/** Slug kebab sin acentos. "El Bogotázo, 1948" → "el-bogotazo-1948". */
export function slugify(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita diacríticos combinantes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function strArr(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((s) => s.length > 0)
    .slice(0, max);
}
function intOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const m = v.match(/-?\d{1,4}/);
    if (m) return parseInt(m[0], 10);
  }
  return null;
}
function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s.length ? s : null;
}

/**
 * Coordenada decimal válida, o null. Acepta número o string ("4,71" / "4.71"),
 * porque el extractor a veces devuelve la coma decimal del español. Fuera de
 * rango → null: es preferible un punto ausente a un punto en el océano.
 */
function coordOrNull(v: unknown, max: number): number | null {
  let n: number | null = null;
  if (typeof v === "number") n = v;
  else if (typeof v === "string") {
    const parsed = parseFloat(v.trim().replace(",", "."));
    if (Number.isFinite(parsed)) n = parsed;
  }
  if (n == null || !Number.isFinite(n) || Math.abs(n) > max) return null;
  // 0,0 es la Isla Nula en el Atlántico: el extractor la emite cuando no sabe.
  return n === 0 ? null : Math.round(n * 1e6) / 1e6;
}
function normHitos(v: unknown, max = 12): Hito[] {
  if (!Array.isArray(v)) return [];
  const out: Hito[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const titulo = str(o.titulo ?? o.title ?? o.evento ?? o.hecho);
    if (!titulo) continue;
    out.push({
      year: intOrNull(o.year ?? o.anio ?? o.año ?? o.fecha),
      titulo,
      detalle: strOrNull(o.detalle ?? o.detail ?? o.descripcion) ?? undefined,
    });
    if (out.length >= max) break;
  }
  return out.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
}

function normTypology(v: unknown): TypologyKind | null {
  const s = str(v).toLowerCase();
  if (s === "hecho" || s === "evento" || s === "acontecimiento") return "hecho";
  if (s === "epoca" || s === "época" || s === "periodo" || s === "período") return "epoca";
  if (s === "entidad" || s === "persona" || s === "lugar" || s === "concepto" || s === "institucion" || s === "institución")
    return "entidad";
  if (s === "pregunta" || s === "question") return "pregunta";
  return null;
}

function normEntidadTipo(v: unknown, fallbackTypologyRaw: unknown): EntidadTipo {
  const s = str(v).toLowerCase();
  if (s.startsWith("persona")) return "Persona";
  if (s.startsWith("lugar")) return "Lugar";
  if (s.startsWith("concepto")) return "Concepto";
  if (s.startsWith("instituc")) return "Institución";
  // A veces el typology crudo trae el tipo (p. ej. "lugar").
  const f = str(fallbackTypologyRaw).toLowerCase();
  if (f.startsWith("lugar")) return "Lugar";
  if (f.startsWith("concepto")) return "Concepto";
  if (f.startsWith("instituc")) return "Institución";
  return "Persona";
}

/**
 * Normaliza el JSON crudo del extractor a una StructuredData válida, o null.
 * `periodoCode` y `slug` pueden inyectarse desde afuera (taxonomía / título de
 * la pieza) para no depender de que el LLM los acierte.
 */
export function normalizeStructured(
  raw: unknown,
  opts: { fallbackPeriodoCode?: string | null; fallbackTitulo?: string } = {},
): StructuredData | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const typology = normTypology(o.typology ?? o.tipologia ?? o.tipo);
  if (!typology) return null;

  const titulo = str(o.titulo ?? o.title ?? o.nombre) || str(opts.fallbackTitulo);
  if (!titulo) return null;

  const resumen = str(o.resumen ?? o.dek ?? o.summary);
  const periodoCode = strOrNull(o.periodoCode ?? o.periodo) ?? opts.fallbackPeriodoCode ?? null;
  const slug = slugify(str(o.slug) || titulo);
  if (!slug) return null;

  // Geo: el extractor puede anidarlo (geo/coordenadas) o aplanarlo (lat/lng).
  const geo = (o.geo ?? o.coordenadas ?? o.coords ?? {}) as Record<string, unknown>;
  const geoObj = geo && typeof geo === "object" ? geo : {};
  const base = {
    typology,
    slug,
    titulo,
    resumen,
    periodoCode,
    lugarPrincipal: strOrNull(
      o.lugarPrincipal ?? o.lugar_principal ?? geoObj.lugar ?? geoObj.nombre,
    ),
    lat: coordOrNull(o.lat ?? o.latitud ?? geoObj.lat ?? geoObj.latitud, 90),
    lng: coordOrNull(o.lng ?? o.lon ?? o.longitud ?? geoObj.lng ?? geoObj.longitud, 180),
  };

  switch (typology) {
    case "hecho":
      return {
        ...base,
        typology: "hecho",
        fecha: strOrNull(o.fecha),
        anioInicio: intOrNull(o.anioInicio ?? o.anio ?? o.año ?? o.fecha),
        anioFin: intOrNull(o.anioFin),
        lugares: strArr(o.lugares),
        protagonistas: strArr(o.protagonistas ?? o.personas),
        causas: strArr(o.causas),
        consecuencias: strArr(o.consecuencias),
        porQueImporta: str(o.porQueImporta ?? o.importancia ?? o.porque),
      };
    case "epoca":
      return {
        ...base,
        typology: "epoca",
        rango: strOrNull(o.rango),
        panorama: str(o.panorama ?? o.overview),
        hitos: normHitos(o.hitos ?? o.eventos),
        actores: strArr(o.actores ?? o.personas),
        transformaciones: strArr(o.transformaciones ?? o.cambios),
        legado: str(o.legado),
      };
    case "entidad":
      return {
        ...base,
        typology: "entidad",
        tipo: normEntidadTipo(o.tipo, o.typology),
        nacimiento: strOrNull(o.nacimiento),
        muerte: strOrNull(o.muerte),
        roles: strArr(o.roles ?? o.cargos),
        hitos: normHitos(o.hitos ?? o.eventos),
        relaciones: strArr(o.relaciones ?? o.relacionados),
        semblanza: str(o.semblanza ?? o.biografia ?? o.bio),
      };
    case "pregunta":
      return {
        ...base,
        typology: "pregunta",
        pregunta: str(o.pregunta) || titulo,
        tesis: str(o.tesis ?? o.respuesta),
        debate: str(o.debate ?? o.tension),
        temasRelacionados: strArr(o.temasRelacionados ?? o.temas),
      };
  }
}

/** Segmento de ruta para una ficha de entidad, según su tipo. */
export function entidadSegment(tipo: EntidadTipo | null | undefined): "personas" | "lugares" | "ideas" {
  if (tipo === "Lugar") return "lugares";
  if (tipo === "Concepto" || tipo === "Institución") return "ideas";
  return "personas";
}

/**
 * Ruta pública de la ficha según tipología. Las entidades ya NO viven bajo
 * /entidades: se enrutan por tipo (personas / lugares / ideas), coherente con la
 * taxonomía del sitio (una persona no es una "entidad" genérica).
 */
export function typologyPath(s: Pick<StructuredData, "typology" | "slug"> & { tipo?: EntidadTipo }): string {
  if (s.typology === "entidad") {
    return `/${entidadSegment(s.tipo)}/${s.slug}`;
  }
  const seg = s.typology === "hecho" ? "hechos" : s.typology === "epoca" ? "epocas" : "preguntas";
  return `/${seg}/${s.slug}`;
}

/** Etiqueta legible de la tipología. */
export function typologyLabel(t: TypologyKind): string {
  return t === "hecho"
    ? "Hecho"
    : t === "epoca"
      ? "Época"
      : t === "entidad"
        ? "Entidad"
        : "Ensayo";
}
