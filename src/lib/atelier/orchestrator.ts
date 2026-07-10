/**
 * Orquestador del Taller: encadena las 6 fases, reporta progreso por fase y
 * degrada con elegancia. Devuelve un entregable limpio + aparato crítico.
 * Lo invoca el endpoint /api/atelier dentro de after().
 */
import type { SearchResult } from "../vector-search";
import { targetWords } from "../atelier-formats";
import { buildBrief } from "./phase1-encuadre";
import { acopiar } from "./phase2-acopio";
import { triangular } from "./phase3-triangulacion";
import { verificar } from "./phase4-verificacion";
import { formularHipotesis } from "./phase-hipotesis";
import { componer } from "./phase5-composicion";
import { pulirYControlar } from "./phase6-edicion";
import { deriveConfidenceIndex, buildCriticalApparatus, stripScaffolding } from "./aparato";
import { assessRelevance } from "./relevancia";
import { classifyDeliverable } from "../deliverable-classifier";
import { extractTypology } from "./typology-extractor";
import { composeTypology, missingFields } from "./typology-composer";
import { composeSeo } from "./seo-composer";
import { fichaKindForFormat, VIDEO_FORMAT_ID } from "../atelier-formats";
import { runDirector } from "../video/director";
import { resolveScoreImagesToUrls } from "../video/scene-images";
import { getStyle, imageCapFor } from "../video/styles";
import type { DeliverableTaxonomy } from "../taxonomy";
import type { DeliverableSeo } from "../seo";
import type { StructuredData } from "../typology-schemas";
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

// Sobre 3600s de maxDuration: si a los ~50 min aún no llegamos a la edición,
// se saltan las revisiones opcionales y se entrega la mejor versión disponible,
// dejando ~10 min de colchón para pulido final + clasificación + persistencia.
const TIME_GUARD_MS = 3_000_000;

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
    "hipotesis",
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
  const extensionTarget = targetWords(input.formatId, input.longitud);
  // Modo FICHA: el formato fuerza la tipología y orienta toda la cadena
  // (ejes del encuadre → artículo de referencia → composición de la ficha).
  const fichaKind = fichaKindForFormat(input.formatId);
  const brief = await buildBrief({
    intent: input.intent,
    formatId: input.formatId,
    extensionTarget,
    questionMeta: input.questionMeta,
    fichaKind: fichaKind ?? undefined,
  });
  set("encuadre", "done", undefined, `${brief.ejes.length} ejes`);
  await emit("encuadre", "Encargo encuadrado.", { brief });

  // ── 2. Acopio ──
  set("acopio", "running", "Cruzando fuentes en el corpus…");
  await emit("acopio", "Cruzando fuentes en el corpus…");
  const { result: acopio, chunkMap } = await acopiar({
    brief,
    formatId: input.formatId,
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

  // Guard de relevancia: evita el drift temático cuando el corpus es pobre en el
  // tema pedido (el retrieval traería material adyacente y el Taller derivaría).
  await emit("acopio", "Evaluando la relevancia de la evidencia…");
  const relevancia = await assessRelevance(brief, acopio.chunks);
  if (relevancia.cobertura === "nula") {
    throw new Error(
      `El corpus no contiene material suficiente sobre «${brief.scope || input.intent}». ` +
        `La evidencia disponible ${relevancia.razon || "trata sobre otros temas"}. ` +
        `Prueba con un tema mejor cubierto por el archivo, o parte de una pregunta del corpus.`
    );
  }
  if (relevancia.cobertura === "parcial") {
    degraded.push(
      `Cobertura parcial del corpus${relevancia.razon ? `: ${relevancia.razon}` : ""}.`
    );
  }

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
  let verified: VerifiedDossier = await verificar(dossier.claims, chunkMap, input.formatId);
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

  // ── 5. Hipótesis ──
  // Fija la espina argumental (tesis/antítesis/síntesis) sobre la evidencia ya
  // verificada, antes de redactar. Absorbe la vieja superficie /hypothesis.
  set("hipotesis", "running", "Fijando la hipótesis de la pieza…");
  await emit("hipotesis", "Fijando la hipótesis de la pieza…");
  try {
    brief.hipotesis = await formularHipotesis({ brief, verified });
    set("hipotesis", "done", undefined, "tesis · antítesis · síntesis");
  } catch (e) {
    set("hipotesis", "done", undefined, "omitida");
    degraded.push("No se pudo formular la hipótesis; se compone sin espina explícita.");
    console.warn(`[atelier] hipótesis falló: ${(e as Error).message}`);
  }
  await emit("hipotesis", "Hipótesis fijada.", { brief });

  // ── Rama VIDEO ──
  // En vez de redactar prosa, el video compone una PARTITURA tipográfica con el
  // Director, alimentándolo con el dossier YA verificado (mismo rigor de
  // investigación que un ensayo, sin re-hacer el RAG). Reusa "composicion" y
  // "edicion" del stepper como "guion" y "montaje".
  if (input.formatId === VIDEO_FORMAT_ID) {
    const style = getStyle(input.videoStyleId ?? "");
    const durationSec = input.durationSec && input.durationSec > 0 ? input.durationSec : 30;

    // Evidencia = afirmaciones verificadas (texto cotejado + su primera fuente).
    const evidence = verified.claims.map((c) => ({
      content: c.texto,
      source: c.fuentes[0]?.documentFilename,
      page: c.fuentes[0]?.pageNumber,
    }));

    set("composicion", "running", "Escribiendo el guion del video…");
    await emit("composicion", `Escribiendo el guion (${style.label})…`);
    const director = await runDirector({
      topic: input.intent,
      styleBrief: style.brief, // carácter del tipo elegido
      durationSec,
      evidence, // dossier verificado inyectado: hereda el rigor del Taller
      verify: false, // el Taller ya verificó cada afirmación
    });
    const score = director.score;
    score.meta.personality = style.id as never; // registra el tipo elegido en la partitura
    set("composicion", "done", undefined, `${score.scenes.length} escenas`);
    await emit("composicion", "Guion del video compuesto.");

    // ── Montaje: imágenes de archivo por URL (reusa el buscador del Taller). ──
    set("edicion", "running", "Buscando imágenes de archivo y montando…");
    await emit("edicion", "Buscando imágenes de archivo y montando…");
    let imagesUsed = 0;
    const cap = imageCapFor(style.imageUsage);
    if (cap > 0) {
      imagesUsed = await resolveScoreImagesToUrls(score, cap, (m) =>
        onProgress({ stage: "edicion", phases: snapshot(), message: `archivo: ${m}` })
      );
    } else {
      // Tipo sin imágenes: limpia cualquier consulta que el compositor dejara.
      for (const s of score.scenes as unknown as Array<Record<string, unknown>>) {
        delete s.image;
        delete s.imageFill;
      }
    }
    set("edicion", "done", undefined, `${score.scenes.length} escenas · ${imagesUsed} imágenes`);

    const confidenceIndex = deriveConfidenceIndex(verified.claims);
    const criticalApparatus = buildCriticalApparatus(verified.claims);
    const chunksUsed = collectChunks(verified.claims, chunkMap, acopio.chunks);
    const durSec = (score.meta.durationInFrames / score.meta.fps).toFixed(0);
    // Cuerpo mínimo (para la lista de Producciones): el video se ve en el preview.
    const answer = `# ${score.meta.title}\n\n${score.meta.periodLabel} · ${score.scenes.length} escenas · ${durSec}s`;

    await emit("edicion", "Video listo.", {
      videoScore: score,
      imagesUsed,
      confidenceIndex,
      criticalApparatus,
      docCount: confidenceIndex.documentosUnicos,
      degraded,
    });

    return {
      answer,
      chunksUsed,
      confidenceIndex,
      criticalApparatus,
      taxonomy: undefined,
      structuredData: null,
      seo: undefined,
      qualityScore: undefined,
      degraded,
      brief,
      phases,
      videoScore: score,
      imagesUsed,
    };
  }

  // ── 6. Composición ──
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

  // ── 7. Edición + control de calidad ──
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

  // ── Ficha estructurada para la página pública ──
  // En modo FICHA la composición es OBLIGATORIA y completa (compositor dedicado
  // con ronda de reparación); en los formatos narrativos sigue siendo la
  // extracción best-effort de siempre (si falla, la pieza queda como ensayo).
  let structuredData: StructuredData | null = null;
  if (fichaKind) {
    await emit("edicion", `Componiendo la ficha de ${fichaKind}…`);
    try {
      structuredData = await composeTypology({
        kind: fichaKind,
        intent: input.intent,
        answer,
        brief,
        verified,
        taxonomy,
      });
      const faltantes = missingFields(structuredData);
      if (faltantes.length > 0) {
        degraded.push(`Ficha con campos delgados pese a la reparación: ${faltantes.join(", ")}.`);
      }
    } catch (e) {
      console.warn(`[atelier] compositor de ficha falló: ${(e as Error).message}`);
      degraded.push("El compositor de ficha falló; se intentó la extracción best-effort.");
      try {
        structuredData = await extractTypology({ answer, intent: input.intent, taxonomy, brief });
      } catch {
        structuredData = null;
      }
    }
  } else {
    await emit("edicion", "Extrayendo la ficha de tipología…");
    try {
      structuredData = await extractTypology({
        answer,
        intent: input.intent,
        taxonomy,
        brief,
      });
    } catch (e) {
      console.warn(`[atelier] extracción de tipología falló: ${(e as Error).message}`);
    }
  }

  // ── SEO (meta title/description + keywords) ──
  // Barato (una llamada Sonnet) y con respaldo determinista: nunca falla ni frena
  // la pieza. Se persiste en metadata.seo; la capa pública también sabe derivarlo.
  await emit("edicion", "Optimizando SEO…");
  const seo: DeliverableSeo = await composeSeo({
    titulo: structuredData?.titulo ?? input.questionMeta?.pregunta ?? input.intent,
    resumen: structuredData?.resumen,
    answer,
    typology: structuredData?.typology ?? null,
    taxonomy,
  });

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
    structuredData,
    seo,
    qualityScore,
    degraded,
    brief,
    phases,
  };
}
