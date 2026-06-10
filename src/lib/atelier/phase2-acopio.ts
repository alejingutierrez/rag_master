/**
 * Fase 2 — Acopio multi-ángulo. Recupera evidencia por cada eje con el pipeline
 * RAG canónico (runRagPipeline), fusiona por RRF entre ejes y luego REBALANCEA
 * por diversidad de documentos (la pieza que hace que "cruzar fuentes" funcione).
 */
import { runRagPipeline } from "../rag-pipeline";
import type { SearchResult } from "../vector-search";
import type { AtelierFormatId } from "../atelier-formats";
import { rebalanceByDiversity, countUniqueDocuments } from "./diversity";
import type { AtelierBrief, AcopioResult } from "./types";

const RRF_K = 60;
const SUBQUERY_CONCURRENCY = 2;

// Tamaño del pool de evidencia. El capítulo es el único formato autorizado a
// cruzar hasta 200 fuentes (el más profundo y caro); el resto, 100.
const POOL_TARGET = Number(process.env.ATELIER_POOL_TARGET ?? "100");
const POOL_TARGET_CAPITULO = Number(process.env.ATELIER_POOL_TARGET_CAPITULO ?? "200");
const CAP_PER_DOC = Number(process.env.ATELIER_CAP_PER_DOC ?? "6");
// Con 200 fuentes hace falta más techo por documento para poder llenar el pool.
const CAP_PER_DOC_CAPITULO = Number(process.env.ATELIER_CAP_PER_DOC_CAPITULO ?? "10");

export interface EjeProgress {
  eje: string;
  status: "pending" | "running" | "done" | "error";
  found?: number;
  error?: string;
}

export async function acopiar(args: {
  brief: AtelierBrief;
  formatId: AtelierFormatId;
  tableName: "chunks" | "chunks_v2";
  useParentExpansion: boolean;
  report?: (perEje: EjeProgress[]) => void | Promise<void>;
}): Promise<{ result: AcopioResult; progress: EjeProgress[]; chunkMap: Map<string, SearchResult> }> {
  const ejes = args.brief.ejes;
  const progress: EjeProgress[] = ejes.map((eje) => ({ eje, status: "pending" }));
  const perEjeChunks: SearchResult[][] = ejes.map(() => []);

  // El capítulo cruza más fuentes y trae más por eje para poder llenar su pool.
  const isCapitulo = args.formatId === "capitulo";
  const poolTarget = isCapitulo ? POOL_TARGET_CAPITULO : POOL_TARGET;
  const capPerDoc = isCapitulo ? CAP_PER_DOC_CAPITULO : CAP_PER_DOC;
  const perEjeCandidates = isCapitulo ? 150 : 100;
  const perEjeTopK = isCapitulo ? 60 : 40;

  for (let i = 0; i < ejes.length; i += SUBQUERY_CONCURRENCY) {
    const batchIdx: number[] = [];
    for (let j = i; j < Math.min(i + SUBQUERY_CONCURRENCY, ejes.length); j++) batchIdx.push(j);
    for (const idx of batchIdx) progress[idx].status = "running";
    if (args.report) await args.report(progress);

    await Promise.all(
      batchIdx.map(async (idx) => {
        try {
          const r = await runRagPipeline(ejes[idx], {
            tableName: args.tableName,
            useParentExpansion: args.useParentExpansion,
            retrievalCandidates: perEjeCandidates,
            finalTopK: perEjeTopK,
          });
          perEjeChunks[idx] = r.chunks;
          progress[idx].status = "done";
          progress[idx].found = r.chunks.length;
        } catch (err) {
          progress[idx].status = "error";
          progress[idx].error = err instanceof Error ? err.message : String(err);
          perEjeChunks[idx] = [];
        }
      })
    );
    if (args.report) await args.report(progress);
  }

  // Fusión RRF entre ejes (patrón deep-research/route.ts:172-186).
  const fusedMap = new Map<string, { chunk: SearchResult; score: number }>();
  for (const chunks of perEjeChunks) {
    for (let rank = 0; rank < chunks.length; rank++) {
      const c = chunks[rank];
      const score = 1 / (RRF_K + rank + 1);
      const ex = fusedMap.get(c.id);
      if (ex) ex.score += score;
      else fusedMap.set(c.id, { chunk: c, score });
    }
  }
  const fused = Array.from(fusedMap.values())
    .sort((a, b) => b.score - a.score)
    .map((x) => x.chunk);

  // Rebalanceo por diversidad: maximiza nº de documentos distintos.
  const chunks = rebalanceByDiversity(fused, {
    targetSize: poolTarget,
    capPerDoc,
  });
  const uniqueDocuments = countUniqueDocuments(chunks);
  const chunkMap = new Map(chunks.map((c) => [c.id, c]));

  const result: AcopioResult = {
    chunks,
    uniqueDocuments,
    perEje: ejes.map((eje, i) => ({ eje, found: perEjeChunks[i].length })),
    thin: uniqueDocuments < 3 || chunks.length < 12,
  };

  return { result, progress, chunkMap };
}
