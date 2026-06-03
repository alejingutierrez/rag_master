/**
 * Orquestador del Taller: encadena las 6 fases, reporta progreso por fase y
 * degrada con elegancia. Devuelve un entregable limpio + aparato crítico.
 * Lo invoca el endpoint /api/atelier dentro de after().
 */
import type { SearchResult } from "../vector-search";
import { getAtelierFormat, longitudFactor } from "../atelier-formats";
import { buildBrief } from "./phase1-encuadre";
import { acopiar } from "./phase2-acopio";
import { triangular } from "./phase3-triangulacion";
import { verificar } from "./phase4-verificacion";
import { componer } from "./phase5-composicion";
import { pulirYControlar } from "./phase6-edicion";
import { deriveConfidenceIndex, buildCriticalApparatus, stripScaffolding } from "./aparato";
import { classifyDeliverable } from "../deliverable-classifier";
import type { DeliverableTaxonomy } from "../taxonomy";
import type {
  AtelierInput,
  AtelierMetadata,
  AtelierPhase,
  AtelierResult,
  AtelierStage,
  PersistedChunk,
  VerifiedClaim,
  VerifiedDossier,
} from "./types";

export type AtelierProgress = (patch: Partial<AtelierMetadata>) => void | Promise<void>;

const TIME_GUARD_MS = 700_000; // sobre 900s de maxDuration: salta la revisión opcional

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function toPersisted(c: SearchResult): PersistedChunk {
  return {
    id: c.id,
    documentId: c.documentId,
    documentFilename: c.documentFilename,
    pageNumber: c.pageNumber,
    chunkIndex: c.chunkIndex,
    similarity: c.similarity,
    content: c.content.slice(0, 400) + (c.content.length > 400 ? "…" : ""),
  };
}

function collectChunks(
  claims: VerifiedClaim[],
  chunkMap: Map<string, SearchResult>,
  fallback: SearchResult[]
): PersistedChunk[] {
  const ids = new Set<string>();
  for (const c of claims) for (const f of c.fuentes) ids.add(f.chunkId);
  let used = Array.from(ids)
    .map((id) => chunkMap.get(id))
    .filter((c): c is SearchResult => Boolean(c));
  if (used.length === 0) used = fallback.slice(0, 20);
  return used.map(toPersisted);
}

export async function runAtelier(
  input: AtelierInput,
  opts: { onProgress?: AtelierProgress } = {}
): Promise<AtelierResult> {
  const t0 = Date.now();
  const onProgress: AtelierProgress = opts.onProgress ?? (() => {});
  const degraded: string[] = [];

  const STAGES: AtelierStage[] = [
    "encuadre",
    "acopio",
    "triangulacion",
    "verificacion",
    "composicion",
    "edicion",
  ];
  const phases: AtelierPhase[] = STAGES.map((key) => ({ key, status: "pending" }));
  const byKey = new Map(phases.map((p) => [p.key, p]));

  const snapshot = () => phases.map((p) => ({ ...p }));
  const emit = (stage: AtelierStage, message: string, extra: Partial<AtelierMetadata> = {}) =>
    onProgress({ stage, message, phases: snapshot(), ...extra });
  const set = (
    key: AtelierStage,
    status: AtelierPhase["status"],
    detail?: string,
    metric?: string
  ) => {
    const p = byKey.get(key)!;
    p.status = status;
    if (detail !== undefined) p.detail = detail;
    if (metric !== undefined) p.metric = metric;
  };

  // ── 1. Encuadre ──
  set("encuadre", "running", "Encuadrando el encargo…");
  await emit("encuadre", "Encuadrando el encargo…");
  const meta = getAtelierFormat(input.formatId);
  const extensionTarget = Math.round((meta?.defaultWords ?? 1800) * longitudFactor(input.longitud));
  const brief = await buildBrief({
    intent: input.intent,
    formatId: input.formatId,
    extensionTarget,
  });
  set("encuadre", "done", undefined, `${brief.ejes.length} ejes`);
  await emit("encuadre", "Encargo encuadrado.", { brief });

  // ── 2. Acopio ──
  set("acopio", "running", "Cruzando fuentes en el corpus…");
  await emit("acopio", "Cruzando fuentes en el corpus…");
  const { result: acopio, chunkMap } = await acopiar({
    brief,
    tableName: input.tableName,
    useParentExpansion: input.useParentExpansion,
    report: async (perEje) => {
      const done = perEje.filter((e) => e.status === "done").length;
      const p = byKey.get("acopio")!;
      p.detail = `${done}/${perEje.length} ejes`;
      await onProgress({
        stage: "acopio",
        phases: snapshot(),
        message: `Recuperando evidencia (${done}/${perEje.length} ejes)…`,
      });
    },
  });
  if (acopio.chunks.length === 0) {
    throw new Error("No se encontró evidencia en el corpus para esta intención.");
  }
  if (acopio.thin) degraded.push("Corpus delgado: pocas fuentes o documentos para cruzar.");
  set(
    "acopio",
    "done",
    undefined,
    `${acopio.chunks.length} fragmentos · ${acopio.uniqueDocuments} documentos`
  );
  await emit("acopio", "Evidencia reunida.", { docCount: acopio.uniqueDocuments });

  // ── 3. Triangulación ──
  set("triangulacion", "running", "Triangulando evidencia entre fuentes…");
  await emit("triangulacion", "Triangulando evidencia entre fuentes…");
  const dossier = await triangular(acopio.chunks, chunkMap, brief);
  set(
    "triangulacion",
    "done",
    undefined,
    `${dossier.nucleos.length} núcleos · ${dossier.claims.length} afirmaciones`
  );
  await emit("triangulacion", "Evidencia triangulada.");

  // ── 4. Verificación ──
  set("verificacion", "running", "Contrastando cada afirmación con sus fuentes…");
  await emit("verificacion", "Contrastando cada afirmación con sus fuentes…");
  let verified: VerifiedDossier = await verificar(dossier.claims, chunkMap);
  if (verified.claims.length === 0 && dossier.claims.length > 0) {
    degraded.push("La verificación no confirmó afirmaciones; se usa el dossier sin verificar.");
    verified = {
      claims: dossier.claims.map((c) => ({ ...c, veredicto: "soportado" as const, confianza: 0.4 })),
      descartados: 0,
      atenuados: 0,
    };
  } else if (verified.claims.length === 0) {
    degraded.push("Material insuficiente; pieza breve a partir del encuadre.");
  }
  set(
    "verificacion",
    "done",
    undefined,
    `${verified.claims.length} verificadas · ${verified.descartados} descartadas`
  );
  await emit("verificacion", "Afirmaciones verificadas.");

  // ── 5. Composición ──
  set("composicion", "running", "Componiendo la pieza…");
  await emit("composicion", "Componiendo la pieza…");
  const { texto: composed, format } = await componer({
    intent: input.intent,
    brief,
    verified,
    onProgress: async (w) => {
      const p = byKey.get("composicion")!;
      p.metric = `${w} palabras`;
      await onProgress({ stage: "composicion", phases: snapshot(), wordCount: w });
    },
  });
  if (!composed.trim()) throw new Error("La composición devolvió texto vacío.");
  set("composicion", "done", undefined, `${countWords(composed)} palabras`);
  await emit("composicion", "Pieza compuesta.", { wordCount: countWords(composed) });

  // ── 6. Edición + control de calidad ──
  set("edicion", "running", "Puliendo y controlando calidad…");
  await emit("edicion", "Puliendo y controlando calidad…");
  const allowRevision = Date.now() - t0 < TIME_GUARD_MS;
  const { texto: edited, qualityScore } = await pulirYControlar({
    texto: composed,
    brief,
    format,
    allowRevision,
  });
  const answer = stripScaffolding(edited);
  set("edicion", "done", undefined, `calidad ${qualityScore.toFixed(1)}/10`);

  // ── Clasificación taxonómica (metadata analítica construida) ──
  await emit("edicion", "Clasificando metadata analítica…");
  let taxonomy: DeliverableTaxonomy | undefined;
  try {
    taxonomy = await classifyDeliverable({
      texto: answer,
      intent: input.intent,
      entitiesHint: brief.entities,
    });
  } catch (e) {
    console.warn(`[atelier] clasificación falló: ${(e as Error).message}`);
  }

  // ── Aparato crítico + persistencia ──
  const confidenceIndex = deriveConfidenceIndex(verified.claims);
  const criticalApparatus = buildCriticalApparatus(verified.claims);
  const chunksUsed = collectChunks(verified.claims, chunkMap, acopio.chunks);

  await emit("edicion", "Entregable listo.", {
    wordCount: countWords(answer),
    qualityScore,
    confidenceIndex,
    criticalApparatus,
    taxonomy,
    docCount: confidenceIndex.documentosUnicos,
    degraded,
  });

  return {
    answer,
    chunksUsed,
    confidenceIndex,
    criticalApparatus,
    taxonomy,
    qualityScore,
    degraded,
    brief,
    phases,
  };
}
