/**
 * Set cerrado de formatos del Taller. Fuente única de verdad ligera (sin
 * dependencias de servidor): la consumen el endpoint (validación), la página
 * (selector) y el detalle de producción (etiqueta). Los prompts pesados de
 * cada formato viven en `src/lib/atelier/formats.ts` (server-side).
 */

export type AtelierFormatId = "cronica" | "ensayo-autor" | "reportaje" | "capitulo";

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
  cronica: { compacta: 1500, normal: 3000, extensa: 5000 },
  "ensayo-autor": { compacta: 1800, normal: 3200, extensa: 5000 },
  reportaje: { compacta: 2000, normal: 3500, extensa: 5000 },
  capitulo: { compacta: 4000, normal: 7000, extensa: 10000 },
};

/** Palabras objetivo para un formato y modo dados (modo por defecto: "normal"). */
export function targetWords(formatId: AtelierFormatId, longitud: LongitudId | undefined): number {
  // Normaliza valores desconocidos o legacy ("breve"/"media") a "normal".
  const key: LongitudId = longitud === "compacta" || longitud === "extensa" ? longitud : "normal";
  return (WORD_TARGETS[formatId] ?? WORD_TARGETS.cronica)[key];
}
