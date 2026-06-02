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

/** Escala de longitud → multiplicador sobre defaultWords. */
export type LongitudId = "breve" | "media" | "extensa";
export function longitudFactor(l: LongitudId | undefined): number {
  if (l === "breve") return 0.6;
  if (l === "extensa") return 1.4;
  return 1;
}
