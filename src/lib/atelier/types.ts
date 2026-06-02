/**
 * Tipos del motor agéntico "El Taller". El andamiaje (claims, contradicciones,
 * verificación) vive aquí y en metadata; NUNCA en el cuerpo del entregable.
 */
import type { SearchResult } from "../vector-search";
import type { AtelierFormatId, LongitudId } from "../atelier-formats";

// ── Entrada ──────────────────────────────────────────────────────────
export interface AtelierInput {
  intent: string;
  formatId: AtelierFormatId;
  longitud?: LongitudId;
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

export interface AtelierBrief {
  thinking: string;
  /** Intuición que vertebra la indagación. INTERNA: no se muestra al lector. */
  tesisTentativa: string;
  ejes: string[];
  scope: string;
  entities: AtelierEntities;
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
  qualityScore?: number;
  degraded: string[];
  brief: AtelierBrief;
  phases: AtelierPhase[];
}
