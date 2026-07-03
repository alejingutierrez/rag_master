/**
 * Tipos del motor agéntico "El Taller". El andamiaje (claims, contradicciones,
 * verificación) vive aquí y en metadata; NUNCA en el cuerpo del entregable.
 */
import type { SearchResult } from "../vector-search";
import type { AtelierFormatId, LongitudId } from "../atelier-formats";
import type { DeliverableTaxonomy } from "../taxonomy";
import type { StructuredData } from "../typology-schemas";

// ── Entrada ──────────────────────────────────────────────────────────

/**
 * Metadata curada de una pregunta (normal o madre) que alimenta el encuadre.
 * Todos los campos son opcionales: el Taller los usa como pistas de arranque
 * (entidades, anclaje temporal, hipótesis implícita) en vez de re-derivarlo todo.
 */
export interface AtelierQuestionMeta {
  pregunta?: string;
  hipotesisImplicita?: string;
  /** Tesis en tensión (de una pregunta-madre): debate cross-libro a sostener. */
  tesisEnTension?: string[];
  problemaSubyacente?: string;
  entidadesPersonas?: string[];
  entidadesLugares?: string[];
  entidadesConceptos?: string[];
  periodoNombre?: string;
  periodoRango?: string;
  categoriaNombre?: string;
  yearPrincipal?: number | null;
  clusterTematico?: string;
  escalaGeografica?: string;
}

export interface AtelierInput {
  intent: string;
  formatId: AtelierFormatId;
  longitud?: LongitudId;
  /** Pistas curadas de la pregunta de origen (si el encargo viene de una). */
  questionMeta?: AtelierQuestionMeta;
  /** Tabla efectiva resuelta por el endpoint (chunks_v2 vacío ⇒ "chunks"). */
  tableName: "chunks" | "chunks_v2";
  useParentExpansion: boolean;
}

// ── Fase 1: Encuadre ─────────────────────────────────────────────────
export interface AtelierEntities {
  personas: string[];
  instituciones: string[];
  lugares: string[];
  conceptos: string[];
  temporalidad: string;
}

/**
 * Hipótesis dialéctica del encargo, fundada en la evidencia verificada.
 * Absorbe la lógica de la vieja superficie /hypothesis: da espina argumental a
 * la pieza. INTERNA: no se muestra verbatim al lector.
 */
export interface AtelierHipotesis {
  /** La tesis central que la evidencia mejor sostiene. */
  tesis: string;
  /** El contraargumento o la tensión más fuerte que el material revela. */
  antitesis: string;
  /** La posición matizada a sostener en la pieza. */
  sintesis: string;
  /**
   * Otras tesis candidatas que la evidencia también sostiene (minadas y
   * descartadas como columna principal, pero útiles como tensiones a tejer).
   * INTERNA: alimenta la riqueza argumental, no se enuncia como esquema.
   */
  tesisAlternas?: string[];
}

export interface AtelierBrief {
  thinking: string;
  /** Intuición que vertebra la indagación. INTERNA: no se muestra al lector. */
  tesisTentativa: string;
  ejes: string[];
  scope: string;
  entities: AtelierEntities;
  /** Hipótesis dialéctica (fase de hipótesis, tras la verificación). */
  hipotesis?: AtelierHipotesis;
  ficha: {
    formato: AtelierFormatId;
    voz: string;
    extensionTarget: number;
  };
}

// ── Fase 2: Acopio ───────────────────────────────────────────────────
export interface AcopioResult {
  chunks: SearchResult[];
  uniqueDocuments: number;
  perEje: Array<{ eje: string; found: number }>;
  /** Corpus insuficiente para cruzar con solidez → degradación. */
  thin: boolean;
}

// ── Fase 3: Triangulación ────────────────────────────────────────────
export type Concordancia = "fuerte" | "parcial" | "unica" | "contradicha";

export interface EvidenceSource {
  chunkId: string;
  documentId: string;
  documentFilename?: string;
  pageNumber: number;
}

export interface Contradiction {
  conflicto: string;
  versionElegida: string;
  razon: string;
}

export interface Claim {
  id: string;
  nucleo: string;
  texto: string;
  fuentes: EvidenceSource[];
  concordancia: Concordancia;
  contradiccion?: Contradiction;
}

export interface ThematicCore {
  id: string;
  titulo: string;
  resumen: string;
  chunkIds: string[];
}

export interface EvidenceDossier {
  nucleos: ThematicCore[];
  claims: Claim[];
}

// ── Fase 4: Verificación ─────────────────────────────────────────────
export type Veredicto = "soportado" | "atenuar" | "descartar";

export interface VerifiedClaim extends Claim {
  veredicto: Veredicto;
  /** 0..1. */
  confianza: number;
  notaAdversarial?: string;
}

export interface VerifiedDossier {
  /** soportado + atenuar (texto ya atenuado aplicado); descartados fuera. */
  claims: VerifiedClaim[];
  descartados: number;
  atenuados: number;
}

// ── Aparato crítico (lateral) ────────────────────────────────────────
export interface ConfidenceFactor {
  name: string;
  value: number; // 0..1
}

export interface ConfidenceIndex {
  score: number; // 0..100
  label: "alta" | "media" | "baja";
  rationale: string;
  factors: ConfidenceFactor[];
  claimsTotales: number;
  claimsBienSoportados: number; // ≥2 fuentes
  pctClaimsBienSoportados: number;
  contradiccionesResueltas: number;
  documentosUnicos: number;
  confianzaPromedio: number;
}

export interface SourceRef {
  chunkId: string;
  documentFilename?: string;
  pageNumber?: number;
}

export interface SeccionFuentes {
  seccion: string;
  sourceRefs: SourceRef[];
  claimIds: string[];
}

export interface CriticalApparatus {
  fuentesPorSeccion: SeccionFuentes[];
  bibliografia: string;
}

// ── Progreso / metadata persistida (Deliverable.metadata.atelier) ────
export type AtelierStage =
  | "encuadre"
  | "acopio"
  | "triangulacion"
  | "verificacion"
  | "hipotesis"
  | "composicion"
  | "edicion"
  | "complete"
  | "error";

export interface AtelierPhase {
  key: AtelierStage;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
  metric?: string;
  error?: string;
}

export interface AtelierMetadata {
  stage: AtelierStage;
  message?: string;
  formatId: AtelierFormatId;
  phases?: AtelierPhase[];
  brief?: AtelierBrief;
  confidenceIndex?: ConfidenceIndex;
  criticalApparatus?: CriticalApparatus;
  taxonomy?: DeliverableTaxonomy;
  docCount?: number;
  wordCount?: number;
  qualityScore?: number;
  degraded?: string[];
  startedAt: string;
  finishedAt?: string;
}

// ── Persistencia ─────────────────────────────────────────────────────
/** Forma de cada item en Deliverable.chunksUsed (compatible con el detalle). */
export interface PersistedChunk {
  id: string;
  documentId: string;
  documentFilename?: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
  content: string;
}

/** Resultado del orquestador. */
export interface AtelierResult {
  answer: string; // markdown limpio, sin citas inline ni andamiaje
  chunksUsed: PersistedChunk[];
  confidenceIndex: ConfidenceIndex;
  criticalApparatus: CriticalApparatus;
  taxonomy?: DeliverableTaxonomy;
  /** Ficha estructurada por tipología (hecho/época/entidad/pregunta), o null. */
  structuredData?: StructuredData | null;
  qualityScore?: number;
  degraded: string[];
  brief: AtelierBrief;
  phases: AtelierPhase[];
}
