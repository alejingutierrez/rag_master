/**
 * Configuración de RIGOR por formato — la perilla única que afina, para cada
 * caso del Taller, CUÁNTAS fuentes cruza, CUÁNTO triangula, CUÁNTAS hipótesis
 * pondera y CUÁN exigente es la revisión. Antes esto vivía disperso en envs
 * globales y ramas `isCapitulo`; aquí se centraliza y se sube en todos los casos.
 *
 * Filosofía: cada formato pide su propia densidad de investigación. La crónica
 * cruza menos y más fino; el capítulo es el más caro y exhaustivo; el podcast,
 * un monólogo que necesita material vivo pero no enciclopédico. Todos, sin
 * embargo, parten de un suelo más alto que el de antes: más fuentes, más
 * triangulación, más hipótesis y dos pasadas de edición de serie.
 */
import type { AtelierFormatId } from "../atelier-formats";

export interface FormatConfig {
  /** ── Acopio (fase 2): tamaño y forma del pool de evidencia ── */
  /** Tamaño objetivo del pool tras rebalanceo por diversidad. */
  poolTarget: number;
  /** Candidatos recuperados por eje (antes del re-rank del pipeline RAG). */
  perEjeCandidates: number;
  /** topK final que cada eje aporta a la fusión RRF. */
  perEjeTopK: number;
  /** Techo de fragmentos por documento en el pool (evita que uno domine). */
  capPerDoc: number;

  /** ── Encuadre (fase 1): amplitud de la indagación ── */
  /** Máximo de ejes de indagación (más ejes = más ángulos = más cobertura). */
  maxEjes: number;
  /** Mínimo de ejes que se le pide al director editorial. */
  minEjes: number;

  /** ── Triangulación (fase 3): profundidad del cruce ── */
  minNucleos: number;
  maxNucleos: number;
  /** Afirmaciones atómicas por núcleo (densidad del dossier). */
  claimsMin: number;
  claimsMax: number;

  /** ── Verificación (fase 4): tamaño de lote del contraste adversarial ── */
  verifyBatch: number;

  /** ── Hipótesis: cuántas tesis candidatas se minan antes de elegir ── */
  hipotesisCandidatas: number;

  /** ── Edición (fase 6): exigencia del control de calidad ── */
  qualityThreshold: number;
  maxRevisions: number;
}

/**
 * Suelo común — cada formato parte de aquí y sube. Centraliza el "más" pedido:
 * todos cruzan MUCHAS más fuentes, triangulan más hondo, ponderan más hipótesis
 * y pasan hasta tres revisiones dirigidas. El costo (tokens, latencia) es un
 * trade-off aceptado a cambio de profundidad y calidad.
 */
const BASE: FormatConfig = {
  poolTarget: 180,
  perEjeCandidates: 160,
  perEjeTopK: 65,
  capPerDoc: 9,
  maxEjes: 11,
  minEjes: 8,
  minNucleos: 6,
  maxNucleos: 9,
  claimsMin: 6,
  claimsMax: 16,
  verifyBatch: 8,
  hipotesisCandidatas: 4,
  qualityThreshold: 8.3,
  maxRevisions: 3,
};

export const FORMAT_CONFIG: Record<AtelierFormatId, FormatConfig> = {
  // Crónica: cruce fino y a ras de suelo, pero ya sobre una base ancha de fuentes.
  cronica: { ...BASE },

  // Ensayo de autor: panorámica — más ejes para conectar procesos mayores y
  // una hipótesis más disputada (5 tesis candidatas en pugna).
  "ensayo-autor": {
    ...BASE,
    poolTarget: 200,
    perEjeCandidates: 170,
    perEjeTopK: 70,
    maxEjes: 12,
    minEjes: 9,
    maxNucleos: 10,
    hipotesisCandidatas: 5,
  },

  // Reportaje: investigación extensa — muchas más fuentes, más ejes, dossier
  // denso y verificación por lotes mayores.
  reportaje: {
    ...BASE,
    poolTarget: 240,
    perEjeCandidates: 200,
    perEjeTopK: 80,
    capPerDoc: 10,
    maxEjes: 13,
    minEjes: 10,
    minNucleos: 7,
    maxNucleos: 11,
    claimsMin: 7,
    claimsMax: 18,
    verifyBatch: 10,
    hipotesisCandidatas: 5,
  },

  // Capítulo: la pieza más cara y exhaustiva — cruza más fuentes que ninguna
  // (el pool más grande del taller), tritura hasta 14 núcleos y pondera 6 tesis
  // candidatas antes de fijar la espina. La revisión es la más exigente.
  capitulo: {
    ...BASE,
    poolTarget: 340,
    perEjeCandidates: 260,
    perEjeTopK: 95,
    capPerDoc: 14,
    maxEjes: 16,
    minEjes: 12,
    minNucleos: 9,
    maxNucleos: 14,
    claimsMin: 8,
    claimsMax: 20,
    verifyBatch: 12,
    hipotesisCandidatas: 6,
    qualityThreshold: 8.5,
  },

  // Podcast monólogo: material vivo y escénico, no enciclopédico. Base ancha,
  // afinada un punto hacia lo concreto-narrable (topK y claims algo menores).
  podcast: {
    ...BASE,
    poolTarget: 180,
    perEjeTopK: 60,
    claimsMax: 14,
  },
};

export function getFormatConfig(id: AtelierFormatId): FormatConfig {
  return FORMAT_CONFIG[id] ?? BASE;
}
