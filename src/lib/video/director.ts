/**
 * El Director. Convierte un tema en una partitura de video, con la misma forma
 * agéntica del Taller: recuperar evidencia (RAG) → componer guion (Opus) →
 * verificar hechos (escéptico) → montar tiempos. La partitura resultante la
 * renderiza el Escenario (Remotion) a MP4.
 *
 * `runRagPipeline` se importa de forma perezosa dentro de retrieveEvidence para
 * que el modo fixture (evidencia inyectada, sin BD) no cargue Prisma.
 */
import { callClaudeJson, OPUS_MODEL } from "../atelier/bedrock-json";
import { parseDraft, assembleScore, type ScoreDraft } from "./draft";
import {
  buildComposeSystem, buildComposeUser, buildVerifySystem, buildVerifyUser, personalityBrief,
} from "./director-prompts";
import type { Personality, TypographicScore } from "./score";

export interface EvidenceItem { content: string; source?: string; page?: number; }

export interface DirectorInput {
  topic: string;
  personality?: Personality;      // default "ruptura"
  styleBrief?: string;            // carácter del tipo (styles.ts); si va, manda sobre personality
  durationSec?: number;           // default 30
  evidence?: EvidenceItem[];      // inyectable (tests / sin RAG)
  finalTopK?: number;
  tableName?: "chunks" | "chunks_v2";
  useParentExpansion?: boolean;
  verify?: boolean;               // default true
  onStage?: (stage: string, detail?: string) => void;
}

export interface DirectorOutput {
  score: TypographicScore;
  draft: ScoreDraft;
  evidenceCount: number;
  verified: boolean;
}

const COMPOSE_MODEL = process.env.VIDEO_COMPOSE_MODEL || OPUS_MODEL;
const VERIFY_MODEL = process.env.VIDEO_VERIFY_MODEL || OPUS_MODEL;

/** Empaqueta la evidencia como texto numerado con su fuente (nunca va a pantalla). */
export function packEvidence(items: EvidenceItem[], max = 24, cap = 520): string {
  return items
    .slice(0, max)
    .map((e, i) => {
      const src = e.source ? ` [${e.source}${e.page ? `, p.${e.page}` : ""}]` : "";
      const body = e.content.replace(/\s+/g, " ").trim().slice(0, cap);
      return `(${i + 1})${src} ${body}`;
    })
    .join("\n\n");
}

export async function retrieveEvidence(
  topic: string,
  opts: { finalTopK?: number; tableName?: "chunks" | "chunks_v2"; useParentExpansion?: boolean } = {}
): Promise<EvidenceItem[]> {
  const { runRagPipeline } = await import("../rag-pipeline");
  const r = await runRagPipeline(topic, {
    finalTopK: opts.finalTopK ?? 24,
    // chunks_v2 vacío en prod → chunks v1, parent expansion OFF (ver memoria del proyecto).
    tableName: opts.tableName ?? "chunks",
    useParentExpansion: opts.useParentExpansion ?? false,
  });
  return r.chunks.map((c) => ({ content: c.content, source: c.documentFilename, page: c.pageNumber }));
}

async function composeDraft(args: {
  topic: string; evidenceText: string; personality: Personality; durationSec: number; styleBrief?: string;
}): Promise<ScoreDraft> {
  return callClaudeJson<ScoreDraft>({
    model: COMPOSE_MODEL,
    system: buildComposeSystem(args.styleBrief ?? personalityBrief(args.personality)),
    user: buildComposeUser({ topic: args.topic, evidenceText: args.evidenceText, durationSec: args.durationSec }),
    maxTokens: 8000,
    validate: parseDraft,
  });
}

async function verifyDraft(args: { draft: ScoreDraft; evidenceText: string }): Promise<{ draft: ScoreDraft; ok: boolean }> {
  try {
    const corrected = await callClaudeJson<ScoreDraft>({
      model: VERIFY_MODEL,
      system: buildVerifySystem(),
      user: buildVerifyUser({
        draftJson: JSON.stringify({ periodCode: args.draft.periodCode, title: args.draft.title, scenes: args.draft.scenes }),
        evidenceText: args.evidenceText,
      }),
      maxTokens: 8000,
      validate: parseDraft,
    });
    return { draft: corrected, ok: true };
  } catch (e) {
    console.warn(`[director] verificación falló, uso el borrador sin verificar: ${(e as Error).message}`);
    return { draft: args.draft, ok: false };
  }
}

export async function runDirector(input: DirectorInput): Promise<DirectorOutput> {
  const personality = input.personality ?? "ruptura";
  const durationSec = input.durationSec ?? 30;
  const stage = input.onStage ?? (() => {});

  stage("acopio", "recuperando evidencia");
  const evidence =
    input.evidence ??
    (await retrieveEvidence(input.topic, {
      finalTopK: input.finalTopK,
      tableName: input.tableName,
      useParentExpansion: input.useParentExpansion,
    }));
  if (evidence.length === 0) throw new Error("sin evidencia: el corpus no devolvió nada para ese tema");
  const evidenceText = packEvidence(evidence);

  stage("composicion", `escribiendo guion (${personality}, ${durationSec}s)`);
  const draft0 = await composeDraft({ topic: input.topic, evidenceText, personality, durationSec, styleBrief: input.styleBrief });

  let draft = draft0;
  let verified = false;
  if (input.verify !== false) {
    stage("verificacion", "cotejando hechos contra la evidencia");
    const v = await verifyDraft({ draft: draft0, evidenceText });
    draft = v.draft;
    verified = v.ok;
  }

  stage("montaje", "repartiendo tiempos");
  const score = assembleScore(draft, { topic: input.topic, personality, durationSec });
  return { score, draft, evidenceCount: evidence.length, verified };
}
