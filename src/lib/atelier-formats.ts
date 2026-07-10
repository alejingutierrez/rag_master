/**
 * Set cerrado de formatos del Taller. Fuente única de verdad ligera (sin
 * dependencias de servidor): la consumen el endpoint (validación), la página
 * (selector) y el detalle de producción (etiqueta). Los prompts pesados de
 * cada formato viven en `src/lib/atelier/formats.ts` (server-side).
 */

export type AtelierFormatId =
  | "cronica"
  | "ensayo-autor"
  | "reportaje"
  | "capitulo"
  | "podcast"
  | "video"
  | "ficha-hecho"
  | "ficha-epoca"
  | "ficha-entidad"
  | "ficha-pregunta";

/** El formato que produce una partitura de video en vez de prosa. */
export const VIDEO_FORMAT_ID: AtelierFormatId = "video";
export function isVideoFormat(id: string): boolean {
  return id === VIDEO_FORMAT_ID;
}

/** Tipología que produce un formato de ficha, o null si es un formato narrativo. */
export function fichaKindForFormat(id: AtelierFormatId): "hecho" | "epoca" | "entidad" | "pregunta" | null {
  switch (id) {
    case "ficha-hecho":
      return "hecho";
    case "ficha-epoca":
      return "epoca";
    case "ficha-entidad":
      return "entidad";
    case "ficha-pregunta":
      return "pregunta";
    default:
      return null;
  }
}

export interface AtelierFormatMeta {
  id: AtelierFormatId;
  name: string;
  description: string;
  /** Palabras objetivo por defecto (la longitud elegida las escala). */
  defaultWords: number;
}

export const ATELIER_FORMATS: Record<AtelierFormatId, AtelierFormatMeta> = {
  cronica: {
    id: "cronica",
    name: "Crónica histórica",
    description: "Narración escénica con voz literaria, a ras de suelo.",
    defaultWords: 1800,
  },
  "ensayo-autor": {
    id: "ensayo-autor",
    name: "Ensayo de autor",
    description: "Tesis y argumentación con voz propia y mirada panorámica.",
    defaultWords: 1800,
  },
  reportaje: {
    id: "reportaje",
    name: "Reportaje long-form",
    description: "Investigación periodística extensa, con gancho y ritmo.",
    defaultWords: 2500,
  },
  capitulo: {
    id: "capitulo",
    name: "Capítulo",
    description: "Pieza extensa de libro: profundidad y arco sostenido.",
    defaultWords: 5000,
  },
  podcast: {
    id: "podcast",
    name: "Podcast monólogo",
    description: "Guion hablado para una sola voz: íntimo, escénico, dicho al oído.",
    defaultWords: 2400,
  },
  video: {
    id: "video",
    name: "Video tipográfico",
    description: "Pieza vertical 9:16 con ritmo: la misma investigación verificada, destilada en una partitura tipográfica animada con imágenes de archivo.",
    // El video se mide en segundos, no en palabras; este valor solo orienta la
    // amplitud de la indagación (más material para escoger los golpes).
    defaultWords: 2200,
  },
  "ficha-hecho": {
    id: "ficha-hecho",
    name: "Hecho",
    description: "Ficha completa de un acontecimiento: qué pasó, causas, consecuencias y su artículo de referencia.",
    defaultWords: 2200,
  },
  "ficha-epoca": {
    id: "ficha-epoca",
    name: "Época",
    description: "Ficha completa de un período: panorama, hitos, actores, transformaciones y legado.",
    defaultWords: 2600,
  },
  "ficha-entidad": {
    id: "ficha-entidad",
    name: "Entidad",
    description: "Ficha completa de una persona, lugar, concepto o institución: semblanza, hitos y relaciones.",
    defaultWords: 2200,
  },
  "ficha-pregunta": {
    id: "ficha-pregunta",
    name: "Pregunta",
    description: "Ficha completa de una pregunta histórica: tesis, debate y el artículo que la responde.",
    defaultWords: 2000,
  },
};

export const ATELIER_FORMAT_LIST: AtelierFormatMeta[] = Object.values(ATELIER_FORMATS);

export function isValidFormatId(s: unknown): s is AtelierFormatId {
  return typeof s === "string" && s in ATELIER_FORMATS;
}

export function getAtelierFormat(id: string): AtelierFormatMeta | undefined {
  return ATELIER_FORMATS[id as AtelierFormatId];
}

/** Modo de longitud del Taller. */
export type LongitudId = "compacta" | "normal" | "extensa";

/**
 * Palabras objetivo ABSOLUTAS por formato × modo (no un multiplicador).
 *
 * - Los tres modos son sustanciosos: incluso "compacta" supera al viejo "breve".
 * - En modo "extensa", los formatos generales llegan a ~5000 palabras.
 * - El CAPÍTULO es el más largo de todos (hasta ~10.000): pieza de libro.
 *
 * Override fino por env no aplica aquí (es contenido editorial, no infra).
 */
const WORD_TARGETS: Record<AtelierFormatId, Record<LongitudId, number>> = {
  cronica: { compacta: 1600, normal: 3200, extensa: 6000 },
  "ensayo-autor": { compacta: 1900, normal: 3600, extensa: 6000 },
  reportaje: { compacta: 2200, normal: 4000, extensa: 6500 },
  capitulo: { compacta: 4500, normal: 8000, extensa: 12000 },
  // Monólogo hablado: medido en minutos al oído (≈150 palabras/min ⇒ ~12/20/32 min).
  podcast: { compacta: 1700, normal: 3000, extensa: 4800 },
  // Video: medido en SEGUNDOS (la duración se elige aparte). Estas cifras solo
  // dan una base ancha de investigación para destilar los golpes de la partitura.
  video: { compacta: 1800, normal: 2600, extensa: 3600 },
  // Fichas: artículo de referencia — denso y completo sin inflarse; la ficha
  // estructurada (campos) se compone aparte sobre la misma evidencia.
  "ficha-hecho": { compacta: 1400, normal: 2200, extensa: 3600 },
  "ficha-epoca": { compacta: 1700, normal: 2600, extensa: 4200 },
  "ficha-entidad": { compacta: 1400, normal: 2200, extensa: 3600 },
  "ficha-pregunta": { compacta: 1300, normal: 2000, extensa: 3200 },
};

/** Palabras objetivo para un formato y modo dados (modo por defecto: "normal"). */
export function targetWords(formatId: AtelierFormatId, longitud: LongitudId | undefined): number {
  // Normaliza valores desconocidos o legacy ("breve"/"media") a "normal".
  const key: LongitudId = longitud === "compacta" || longitud === "extensa" ? longitud : "normal";
  return (WORD_TARGETS[formatId] ?? WORD_TARGETS.cronica)[key];
}
