/**
 * Produce, revisa, publica y verifica un lote editorial versionado.
 *
 * Uso:
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --plan
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --campaign=2026-07-28 --plan
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --produce
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --produce --resume
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --produce --resume --bucket=master --offset=38
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --qa
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --covers
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --openai-covers
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --replace-rejected
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --publish
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --publish-ready
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --verify-ready
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --verify
 */
import { config as dotenv } from "dotenv";
dotenv({ path: process.env.ENV_FILE || `${process.cwd()}/.env` });
dotenv({ path: `${process.cwd()}/../../../.env` });

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { prisma } from "../src/lib/prisma";
import { signSession, adminEmail, SESSION_COOKIE } from "../src/lib/auth";
import { evaluateSeriesPoll } from "../src/lib/atelier/series";
import { generateAndStoreImage } from "../src/lib/atelier/image";
import { missingFields } from "../src/lib/atelier/typology-composer";
import { validateEntitySourceContract } from "../src/lib/entity-source-contract";
import {
  typologyPath,
  type StructuredData,
} from "../src/lib/typology-schemas";
import {
  CAMPAIGN_ENTITIES as CAMPAIGN_2026_07_25_ENTITIES,
  CAMPAIGN_MASTER_IDS as CAMPAIGN_2026_07_25_MASTER_IDS,
  type CampaignEntity,
} from "./campaign-2026-07-25-manifest";
import {
  CAMPAIGN_ENTITIES as CAMPAIGN_2026_07_28_ENTITIES,
  CAMPAIGN_MASTER_IDS as CAMPAIGN_2026_07_28_MASTER_IDS,
} from "./campaign-2026-07-28-manifest";
import {
  CAMPAIGN_ENTITIES as CAMPAIGN_2026_08_02_ENTITIES,
  CAMPAIGN_MASTER_IDS as CAMPAIGN_2026_08_02_MASTER_IDS,
} from "./campaign-2026-08-02-manifest";
import {
  CAMPAIGN_ENTITIES as CAMPAIGN_2026_08_04_ENTITIES,
  CAMPAIGN_MASTER_IDS as CAMPAIGN_2026_08_04_MASTER_IDS,
  EXPECTED_PERIOD_COUNTS as CAMPAIGN_2026_08_04_PERIOD_COUNTS,
} from "./campaign-2026-08-04-manifest";

const CAMPAIGN_ID =
  process.env.CAMPAIGN_ID ||
  process.argv.find((value) => value.startsWith("--campaign="))?.slice(11) ||
  "2026-07-25";
const CAMPAIGNS = {
  "2026-07-25": {
    entities: CAMPAIGN_2026_07_25_ENTITIES,
    masterIds: CAMPAIGN_2026_07_25_MASTER_IDS,
    expectedCounts: { person: 30, place: 30, concept: 30, master: 30 },
    requireOpenAIImages: false,
    expectedPeriodCounts: null,
  },
  "2026-07-28": {
    entities: CAMPAIGN_2026_07_28_ENTITIES,
    masterIds: CAMPAIGN_2026_07_28_MASTER_IDS,
    expectedCounts: { person: 30, place: 30, concept: 30, master: 30 },
    requireOpenAIImages: true,
    expectedPeriodCounts: null,
  },
  "2026-08-02": {
    entities: CAMPAIGN_2026_08_02_ENTITIES,
    masterIds: CAMPAIGN_2026_08_02_MASTER_IDS,
    expectedCounts: { person: 40, place: 0, concept: 40, master: 50 },
    requireOpenAIImages: true,
    expectedPeriodCounts: null,
  },
  "2026-08-04": {
    entities: CAMPAIGN_2026_08_04_ENTITIES,
    masterIds: CAMPAIGN_2026_08_04_MASTER_IDS,
    expectedCounts: { person: 37, place: 0, concept: 0, master: 0 },
    requireOpenAIImages: true,
    expectedPeriodCounts: CAMPAIGN_2026_08_04_PERIOD_COUNTS,
  },
} as const;
const selectedCampaign = CAMPAIGNS[CAMPAIGN_ID as keyof typeof CAMPAIGNS];
if (!selectedCampaign) {
  throw new Error(
    `Campaña desconocida: ${CAMPAIGN_ID}. Usa ${Object.keys(CAMPAIGNS).join(" o ")}.`,
  );
}
const CAMPAIGN_ENTITIES: readonly CampaignEntity[] = selectedCampaign.entities;
const CAMPAIGN_MASTER_IDS: readonly string[] = selectedCampaign.masterIds;
const EXPECTED_COUNTS = selectedCampaign.expectedCounts;
const BASE = process.env.SITE_URL || "https://historiacolombiana.com";
const CONC = Math.max(1, Number(process.env.CONC ?? "3"));
const IMAGE_CONC = Math.max(1, Number(process.env.IMAGE_CONC ?? "2"));
const POLL_MS = Number(process.env.POLL_MS ?? "8000");
// El endpoint del Taller puede seguir progresando aunque un tramo de red/RDS
// impida observarlo durante varios minutos. El margen amplio evita declarar un
// falso timeout local y abrir trabajo nuevo mientras el after() remoto continúa.
const MAX_ITEM_MS = Number(process.env.MAX_ITEM_MS ?? String(120 * 60 * 1000));
const DB_RETRY_ATTEMPTS = Math.max(
  1,
  Number(process.env.DB_RETRY_ATTEMPTS ?? "80"),
);
const DB_RETRY_MAX_MS = Number(process.env.DB_RETRY_MAX_MS ?? "30000");
const STATE_FILE =
  process.env.STATE_FILE || join(tmpdir(), `rag-master-campaign-${CAMPAIGN_ID}.json`);
const argv = new Set(process.argv.slice(2));
const onlyDeliverableId = process.argv
  .find((value) => value.startsWith("--only="))
  ?.slice("--only=".length);
const requestedLimit = Math.max(
  0,
  Number(
    process.argv.find((value) => value.startsWith("--limit="))?.slice("--limit=".length) ??
      "0",
  ),
);
const requestedOffset = Math.max(
  0,
  Number(
    process.argv.find((value) => value.startsWith("--offset="))?.slice("--offset=".length) ??
      "0",
  ),
);
const requestedBucket = process.argv
  .find((value) => value.startsWith("--bucket="))
  ?.slice("--bucket=".length);

type Bucket = CampaignEntity["type"] | "master";
type SourceKind = "entidad" | "pregunta-madre";

interface Job {
  bucket: Bucket;
  key: string;
  label: string;
  intent?: string;
  expectedPeriodCode?: string;
  allowHistoricalNonLikeness?: boolean;
  masterId?: string;
  sourceKind: SourceKind;
}

interface DeliverableRow {
  id: string;
  status: string;
  answer: string;
  metadata: unknown;
  structuredData: unknown;
  imageUrl: string | null;
  imageKey: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
}

interface QaResult {
  job: Job;
  deliverableId: string | null;
  ok: boolean;
  errors: string[];
  warnings: string[];
  path: string | null;
  words: number;
  quality: number | null;
  confidence: number | null;
  documents: number | null;
}

type JsonObject = Record<string, unknown>;

interface PollDeliverable {
  status?: string | null;
  metadata?: unknown;
  imageUrl?: string | null;
  imageKey?: string | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = () => new Date().toISOString().slice(11, 19);
let cookie = "";

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function apiError(json: JsonObject, fallback: string): string {
  return typeof json.error === "string" ? json.error : fallback;
}

function jobs(): Job[] {
  return [
    ...CAMPAIGN_ENTITIES.map((e) => ({
      bucket: e.type,
      key: e.key,
      label: e.label,
      intent: e.intent,
      expectedPeriodCode: e.periodCode,
      allowHistoricalNonLikeness: e.allowHistoricalNonLikeness,
      sourceKind: "entidad" as const,
    })),
    ...CAMPAIGN_MASTER_IDS.map((id) => ({
      bucket: "master" as const,
      key: id,
      label: id,
      masterId: id,
      sourceKind: "pregunta-madre" as const,
    })),
  ];
}

function assertManifest(all: Job[]) {
  const counts = all.reduce<Record<string, number>>((out, job) => {
    out[job.bucket] = (out[job.bucket] ?? 0) + 1;
    return out;
  }, {});
  for (const bucket of ["person", "place", "concept", "master"]) {
    const expected = EXPECTED_COUNTS[bucket as keyof typeof EXPECTED_COUNTS];
    if ((counts[bucket] ?? 0) !== expected) {
      throw new Error(
        `Manifest inválido: ${bucket}=${counts[bucket] ?? 0}, se esperaban ${expected}.`,
      );
    }
  }
  const keys = new Set(all.map((job) => `${job.sourceKind}:${job.key}`));
  if (keys.size !== all.length) {
    throw new Error(`Manifest inválido: ${all.length - keys.size} llaves duplicadas.`);
  }
  if (selectedCampaign.expectedPeriodCounts) {
    const actual = all.reduce<Record<string, number>>((out, job) => {
      if (job.expectedPeriodCode) {
        out[job.expectedPeriodCode] = (out[job.expectedPeriodCode] ?? 0) + 1;
      }
      return out;
    }, {});
    for (const [periodCode, expected] of Object.entries(
      selectedCampaign.expectedPeriodCounts,
    )) {
      if ((actual[periodCode] ?? 0) !== expected) {
        throw new Error(
          `Manifest inválido: ${periodCode}=${actual[periodCode] ?? 0}, se esperaban ${expected}.`,
        );
      }
    }
  }
}

async function initAuth() {
  const token = await signSession({ sub: adminEmail(), role: "admin" });
  cookie = `${SESSION_COOKIE}=${token}`;
  const probe = await fetch(`${BASE}/api/production-state?kind=entidad`, {
    headers: { Cookie: cookie },
  });
  if (!probe.ok) {
    throw new Error(
      `Auth contra ${BASE} falló (${probe.status}). Revisa AUTH_SECRET/ADMIN_EMAIL.`,
    );
  }
}

async function apiGet(path: string): Promise<JsonObject> {
  const response = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
  if (!response.ok) throw new Error(`GET ${path} -> ${response.status}`);
  return response.json();
}

async function apiWrite(
  path: string,
  method: "POST" | "PATCH",
  body?: unknown,
): Promise<{ status: number; json: JsonObject }> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    json: asObject(await response.json().catch(() => ({}))),
  };
}

async function withDbRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === 1 || attempt % 10 === 0) {
        console.log(`[RDS] ${stamp()} reintento ${attempt}/${DB_RETRY_ATTEMPTS} · ${label}`);
      }
      if (attempt < DB_RETRY_ATTEMPTS) {
        await sleep(Math.min(DB_RETRY_MAX_MS, attempt * 2_000));
      }
    }
  }
  throw lastError;
}

async function latestRows(job: Job): Promise<DeliverableRow[]> {
  return withDbRetry(`${job.bucket}:${job.label.slice(0, 48)}`, () =>
    prisma.deliverable.findMany({
        where: {
          templateId: job.bucket === "master" ? "ficha-pregunta" : "ficha-entidad",
          metadata: {
            path: ["sourceRef", "kind"],
            equals: job.sourceKind,
          },
          AND: [
            {
              metadata: {
                path: ["sourceRef", "key"],
                equals: job.key,
              },
            },
          ],
        },
        select: {
          id: true,
          status: true,
          answer: true,
          metadata: true,
          structuredData: true,
          imageUrl: true,
          imageKey: true,
          publishedAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
  );
}

async function pollUntilReady(
  deliverableId: string,
  deadlineAt = Date.now() + MAX_ITEM_MS,
): Promise<void> {
  let imageKickoffStarted = false;
  let imageRetries = 0;
  for (;;) {
    if (Date.now() > deadlineAt) {
      throw new Error(`timeout tras ${Math.round(MAX_ITEM_MS / 60000)} min`);
    }
    await sleep(POLL_MS);
    let row: PollDeliverable;
    try {
      row = await apiGet(`/api/deliverables/${deliverableId}`);
    } catch {
      continue;
    }
    const action = evaluateSeriesPoll(row, {
      requireImage: true,
      imageRetries,
      imageKickoffStarted,
    });
    if (action.kind === "done") return;
    if (action.kind === "error") throw new Error(action.reason);
    if (
      action.kind === "trigger-image" &&
      (!imageKickoffStarted || action.reason === "image-error")
    ) {
      const image = await apiWrite(
        `/api/deliverables/${deliverableId}/generate-image`,
        "POST",
      );
      const accepted =
        (image.status >= 200 && image.status < 300) || image.status === 409;
      if (!accepted) {
        throw new Error(apiError(image.json, `generate-image ${image.status}`));
      }
      imageKickoffStarted = true;
      if (action.reason === "image-error") imageRetries++;
    }
  }
}

async function enforceExpectedPeriod(
  deliverableId: string,
  job: Job,
): Promise<boolean> {
  if (!job.expectedPeriodCode) return false;
  const row = await withDbRetry(`period:${job.key}`, () =>
    prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: { structuredData: true },
    }),
  );
  const structured = row?.structuredData as StructuredData | null;
  if (!structured || structured.periodoCode === job.expectedPeriodCode) return false;
  await withDbRetry(`period-fix:${job.key}`, () =>
    prisma.deliverable.update({
      where: { id: deliverableId },
      data: {
        structuredData: {
          ...structured,
          periodoCode: job.expectedPeriodCode,
        } as unknown as object,
      },
    }),
  );
  console.log(
    `[PERÍODO] ${job.label} · ${structured.periodoCode ?? "ausente"} → ${job.expectedPeriodCode}`,
  );
  return true;
}

async function regenerateCampaignImageRemote(
  deliverableId: string,
  job: Job,
): Promise<void> {
  const response = await apiWrite(
    `/api/deliverables/${deliverableId}/generate-image`,
    "POST",
    {
      openAIOnly: true,
      requireArtDirection: true,
      allowHistoricalNonLikeness:
        job.expectedPeriodCode === "PRE" || job.allowHistoricalNonLikeness,
    },
  );
  const accepted =
    (response.status >= 200 && response.status < 300) || response.status === 409;
  if (!accepted) {
    throw new Error(apiError(response.json, `generate-image ${response.status}`));
  }

  const deadlineAt = Date.now() + MAX_ITEM_MS;
  for (;;) {
    if (Date.now() > deadlineAt) {
      throw new Error(`timeout de portada tras ${Math.round(MAX_ITEM_MS / 60000)} min`);
    }
    await sleep(POLL_MS);
    let row: JsonObject;
    try {
      row = await apiGet(`/api/deliverables/${deliverableId}`);
    } catch {
      continue;
    }
    const image = asObject(asObject(row.metadata).image);
    const status = typeof image.status === "string" ? image.status : "";
    if (status === "generando" || !status) continue;
    if (status === "ok") {
      const model = typeof image.modelo === "string" ? image.modelo : "";
      if (!isOpenAIImageModel(model)) {
        throw new Error(`la portada remota no acredita OpenAI (${model || "sin modelo"})`);
      }
      if (
        (job.expectedPeriodCode === "PRE" || job.allowHistoricalNonLikeness) &&
        image.personaModo !== "escena-documental-sin-semejanza"
      ) {
        throw new Error("la portada remota no acredita no-semejanza histórica");
      }
      return;
    }
    const detail = typeof image.error === "string" ? `: ${image.error}` : "";
    throw new Error(`portada remota ${status}${detail}`);
  }
}

async function finishCampaignItem(
  deliverableId: string,
  job: Job,
  deadlineAt?: number,
): Promise<void> {
  try {
    await pollUntilReady(deliverableId, deadlineAt);
  } catch (error) {
    if (
      (error as Error).message === "image-without-identity-reference"
    ) {
      await enforceExpectedPeriod(deliverableId, job);
      await regenerateCampaignImageRemote(deliverableId, job);
      return;
    }
    throw error;
  }
  const periodChanged = await enforceExpectedPeriod(deliverableId, job);
  if (periodChanged) {
    await regenerateCampaignImageRemote(deliverableId, job);
  }
}

async function produceOne(job: Job): Promise<{ id: string; reused: boolean }> {
  const existing = await latestRows(job);
  const startedAt = (row: DeliverableRow): number => {
    const atelier = asObject(asObject(row.metadata).atelier);
    const raw =
      typeof atelier.startedAt === "string" ? Date.parse(atelier.startedAt) : NaN;
    return Number.isFinite(raw) ? raw : row.updatedAt.getTime();
  };
  const stale = existing.find(
    (row) =>
      row.status === "GENERATING" &&
      Date.now() - startedAt(row) >= MAX_ITEM_MS,
  );
  if (stale) {
    const metadata = asObject(stale.metadata);
    const atelier = asObject(metadata.atelier);
    await withDbRetry(`expire-stale:${job.bucket}:${job.key}`, () =>
      prisma.deliverable.update({
        where: { id: stale.id },
        data: {
          status: "ERROR",
          metadata: {
            ...metadata,
            atelier: {
              ...atelier,
              stage: "error",
              message: `Intento GENERATING vencido tras ${Math.round(MAX_ITEM_MS / 60000)} min; se habilita regeneración idempotente.`,
              finishedAt: new Date().toISOString(),
            },
          } as unknown as object,
        },
      }),
    );
    console.log(
      `[RECOVERY] ${stamp()} ${job.bucket} · ${job.label.slice(0, 64)} · ${stale.id}`,
    );
  }
  const usable = existing.find(
    (row) =>
      row.status === "COMPLETE" ||
      (row.status === "GENERATING" &&
        row.id !== stale?.id &&
        Date.now() - startedAt(row) < MAX_ITEM_MS),
  );
  if (usable) {
    const deadlineAt =
      usable.status === "GENERATING"
        ? startedAt(usable) + MAX_ITEM_MS
        : Date.now() + MAX_ITEM_MS;
    await finishCampaignItem(usable.id, job, deadlineAt);
    return { id: usable.id, reused: true };
  }

  const response =
    job.bucket === "master"
      ? await apiWrite(`/api/preguntas-madre/${job.masterId}/produce`, "POST", {
          formatId: "ficha-pregunta",
          longitud: "extensa",
        })
      : await apiWrite("/api/atelier", "POST", {
          intent: job.intent,
          formatId: "ficha-entidad",
          longitud: "extensa",
          sourceRef: {
            kind: "entidad",
            key: job.key,
            label: job.label,
          },
        });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(apiError(response.json, `POST ${response.status}`));
  }
  const id =
    typeof response.json.deliverableId === "string"
      ? response.json.deliverableId
      : undefined;
  if (!id) throw new Error("La producción no devolvió deliverableId.");
  await finishCampaignItem(id, job);
  return { id, reused: false };
}

async function hydrateMasterLabels(all: Job[]) {
  const masters = await withDbRetry("hydrate-master-labels", () =>
    prisma.masterQuestion.findMany({
      where: { id: { in: [...CAMPAIGN_MASTER_IDS] } },
      select: {
        id: true,
        pregunta: true,
        gateScore: true,
        childCount: true,
        periodoCode: true,
        categoriaCode: true,
      },
    }),
  );
  const byId = new Map(masters.map((master) => [master.id, master]));
  for (const job of all) {
    if (job.bucket !== "master") continue;
    const master = byId.get(job.key);
    if (!master) throw new Error(`Pregunta madre inexistente: ${job.key}`);
    if (master.gateScore < 5) {
      throw new Error(`Pregunta madre bajo gate 5/5: ${job.key}`);
    }
    job.label = master.pregunta;
  }
}

async function assertNewPublicKeys(all: Job[]) {
  const problems: string[] = [];
  for (const job of all) {
    const rows = await latestRows(job);
    if (rows.some((row) => row.publishedAt)) {
      problems.push(`${job.bucket}:${job.label}`);
    }
  }
  if (problems.length) {
    throw new Error(
      `El manifest no representa ${all.length} páginas nuevas; ya publicadas: ${problems.join(", ")}`,
    );
  }
}

function writeState(value: unknown) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(value, null, 2));
}

async function runProduction(all: Job[]) {
  const state = {
    total: all.length,
    done: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
    inflight: [] as string[],
    completed: [] as Array<{ bucket: Bucket; key: string; id: string; reused: boolean }>,
    failures: [] as Array<{ bucket: Bucket; key: string; label: string; error: string }>,
  };
  writeState(state);
  let index = 0;
  const worker = async () => {
    while (index < all.length) {
      const job = all[index++];
      const tag = `${job.bucket}:${job.label}`;
      state.inflight.push(tag);
      writeState(state);
      const startedAt = Date.now();
      try {
        const result = await produceOne(job);
        state.done++;
        state.completed.push({ bucket: job.bucket, key: job.key, ...result });
        console.log(
          `[DONE] ${stamp()} ${job.bucket} · ${job.label.slice(0, 72)} · ${Math.round(
            (Date.now() - startedAt) / 1000,
          )}s${result.reused ? " · reusada" : ""}`,
        );
      } catch (error) {
        state.failed++;
        const message = (error as Error).message;
        state.failures.push({
          bucket: job.bucket,
          key: job.key,
          label: job.label,
          error: message,
        });
        console.log(
          `[ERROR] ${stamp()} ${job.bucket} · ${job.label.slice(0, 72)} · ${message}`,
        );
      } finally {
        const position = state.inflight.indexOf(tag);
        if (position >= 0) state.inflight.splice(position, 1);
        writeState(state);
      }
    }
  };
  const reporter = setInterval(() => {
    console.log(
      `[PROGRESO] ${stamp()} ${state.done}/${state.total} listas · ${state.failed} fallidas · en curso: ${state.inflight
        .slice(0, CONC)
        .map((value) => value.slice(0, 32))
        .join(" | ")}`,
    );
  }, 60_000);
  await Promise.all(
    Array.from({ length: Math.min(CONC, all.length) }, () => worker()),
  );
  clearInterval(reporter);
  writeState({ ...state, finishedAt: new Date().toISOString() });
  if (state.failed) {
    throw new Error(`Producción terminó con ${state.failed} fallas.`);
  }
}

function qaRow(job: Job, row: DeliverableRow | null): QaResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!row) {
    return {
      job,
      deliverableId: null,
      ok: false,
      errors: ["sin entregable COMPLETE"],
      warnings,
      path: null,
      words: 0,
      quality: null,
      confidence: null,
      documents: null,
    };
  }
  const metadata = asObject(row.metadata);
  const atelier = asObject(metadata.atelier);
  const confidenceIndex = asObject(atelier.confidenceIndex);
  const image = asObject(metadata.image);
  const seo = asObject(metadata.seo);
  const structured = row.structuredData as StructuredData | null;
  const words = row.answer.trim().split(/\s+/).filter(Boolean).length;
  const quality =
    typeof atelier.qualityScore === "number" ? atelier.qualityScore : null;
  const confidence =
    typeof confidenceIndex.score === "number"
      ? confidenceIndex.score
      : null;
  const documents =
    typeof confidenceIndex.documentosUnicos === "number"
      ? confidenceIndex.documentosUnicos
      : null;

  if (row.status !== "COMPLETE") errors.push(`estado ${row.status}`);
  if (!row.imageKey && !row.imageUrl) errors.push("sin portada persistida");
  if (typeof image.status === "string" && image.status !== "ok") {
    errors.push(`imagen ${image.status}`);
  }
  if (
    selectedCampaign.requireOpenAIImages &&
    (row.imageKey || row.imageUrl) &&
    !hasFullOpenAIImageMethodology(row.metadata)
  ) {
    errors.push(
      `portada sin metodología OpenAI completa (${
        typeof image.modelo === "string" ? image.modelo : "modelo ausente"
      })`,
    );
  }
  if (
    (job.expectedPeriodCode === "PRE" || job.allowHistoricalNonLikeness) &&
    image.personaModo !== "escena-documental-sin-semejanza"
  ) {
    errors.push("portada histórica sin declaración de no-semejanza");
  }
  if (!seo.metaTitle || !seo.metaDescription) {
    errors.push("SEO incompleto");
  }
  if (!structured) {
    errors.push("sin structuredData");
  } else {
    const thin = missingFields(structured);
    if (thin.length) errors.push(`campos estructurados delgados: ${thin.join(", ")}`);
    if (!structured.slug) errors.push("sin slug");
    if (job.bucket === "master") {
      if (structured.typology !== "pregunta") {
        errors.push(`tipología ${structured.typology}, se esperaba pregunta`);
      } else if (structured.pregunta.trim().length < 40) {
        errors.push("pregunta estructurada demasiado corta");
      }
    } else {
      const sourceCheck = validateEntitySourceContract(
        { kind: "entidad", key: job.key, label: job.label },
        structured,
      );
      if (!sourceCheck.ok) errors.push(sourceCheck.error ?? "identidad incompatible");
      if (
        job.expectedPeriodCode &&
        structured.periodoCode !== job.expectedPeriodCode
      ) {
        errors.push(
          `período ${structured.periodoCode ?? "ausente"}, se esperaba ${job.expectedPeriodCode}`,
        );
      }
    }
  }
  if (words < 2300) errors.push(`solo ${words} palabras`);
  const minQuality = job.bucket === "master" ? 7 : 8;
  if (quality == null || quality < minQuality) {
    errors.push(`calidad ${quality ?? "ausente"}/${minQuality}`);
  }
  if (confidence == null || confidence < 70) {
    errors.push(`confianza ${confidence ?? "ausente"}/70`);
  }
  const minDocs = job.bucket === "master" ? 20 : 15;
  if (documents == null || documents < minDocs) {
    errors.push(`documentos ${documents ?? "ausente"}/${minDocs}`);
  }
  const degraded = Array.isArray(atelier.degraded)
    ? atelier.degraded.filter((value: unknown) => typeof value === "string")
    : [];
  const severe = degraded.filter((value: string) =>
    /material insuficiente|verificación no confirmó|campos delgados|compositor de ficha falló/i.test(
      value,
    ),
  );
  if (severe.length) errors.push(`degradación severa: ${severe.join(" | ")}`);
  for (const value of degraded) {
    if (!severe.includes(value)) warnings.push(value);
  }

  return {
    job,
    deliverableId: row.id,
    ok: errors.length === 0,
    errors,
    warnings,
    path: structured ? typologyPath(structured) : null,
    words,
    quality,
    confidence,
    documents,
  };
}

async function runQa(all: Job[]): Promise<QaResult[]> {
  const results: QaResult[] = [];
  for (const job of all) {
    const rows = await latestRows(job);
    const complete = rows
      .filter((row) => row.status === "COMPLETE")
      .sort((a, b) => {
        const score = (row: DeliverableRow) => {
          const evaluation = qaRow(job, row);
          const nonImageErrors = evaluation.errors.filter(
            (error) =>
              !error.startsWith("sin portada persistida") &&
              !error.startsWith("imagen "),
          );
          const meta = asObject(row.metadata);
          const atelier = asObject(meta.atelier);
          const confidence = asObject(atelier.confidenceIndex);
          return (
            (nonImageErrors.length === 0 ? 100_000 : 0) -
            nonImageErrors.length * 10_000 -
            evaluation.errors.length * 1_000 +
            (row.imageKey || row.imageUrl ? 100 : 0) +
            Number(atelier.qualityScore ?? 0) * 10 +
            Number(confidence.score ?? 0)
          );
        };
        return score(b) - score(a) || b.updatedAt.getTime() - a.updatedAt.getTime();
      })[0] ?? null;
    results.push(qaRow(job, complete));
  }

  const slugOwners = new Map<string, QaResult[]>();
  for (const result of results) {
    if (!result.path) continue;
    const list = slugOwners.get(result.path) ?? [];
    list.push(result);
    slugOwners.set(result.path, list);
  }
  for (const [path, owners] of slugOwners) {
    if (owners.length < 2) continue;
    for (const owner of owners) {
      owner.ok = false;
      owner.errors.push(`ruta duplicada dentro del lote: ${path}`);
    }
  }

  const existing = await withDbRetry("qa-published-catalog", () =>
    prisma.deliverable.findMany({
      where: { status: "COMPLETE", publishedAt: { not: null } },
      select: { id: true, structuredData: true },
    }),
  );
  const existingPaths = new Map<string, string>();
  for (const row of existing) {
    const structured = row.structuredData as StructuredData | null;
    if (structured) existingPaths.set(typologyPath(structured), row.id);
  }
  for (const result of results) {
    const owner = result.path ? existingPaths.get(result.path) : null;
    if (owner && owner !== result.deliverableId) {
      result.ok = false;
      result.errors.push(`ruta ya publicada por ${owner}: ${result.path}`);
    }
  }

  const summary = results.reduce<Record<string, { ok: number; failed: number }>>(
    (out, result) => {
      const bucket = result.job.bucket;
      out[bucket] ??= { ok: 0, failed: 0 };
      out[bucket][result.ok ? "ok" : "failed"]++;
      return out;
    },
    {},
  );
  console.log("\nQA POR CATEGORÍA");
  for (const bucket of ["person", "place", "concept", "master"]) {
    console.log(
      `  ${bucket}: ${summary[bucket]?.ok ?? 0} aprobadas · ${
        summary[bucket]?.failed ?? 0
      } rechazadas`,
    );
  }
  for (const result of results.filter((value) => !value.ok)) {
    console.log(
      `  ✗ ${result.job.bucket} · ${result.job.label.slice(0, 72)} · ${result.errors.join(
        " | ",
      )}`,
    );
  }
  writeState({
    qaAt: new Date().toISOString(),
    results: results.map((result) => ({
      bucket: result.job.bucket,
      key: result.job.key,
      label: result.job.label,
      deliverableId: result.deliverableId,
      ok: result.ok,
      errors: result.errors,
      warnings: result.warnings,
      path: result.path,
      words: result.words,
      quality: result.quality,
      confidence: result.confidence,
      documents: result.documents,
    })),
  });
  return results;
}

async function generateMissingCovers(results: QaResult[]) {
  const targets = results.filter(
    (result) =>
      result.deliverableId &&
      result.errors.some((error) => error === "sin portada persistida"),
  );
  console.log(
    `\nPORTADAS: ${targets.length} faltantes · concurrencia ${IMAGE_CONC}`,
  );
  let index = 0;
  let failures = 0;
  const worker = async () => {
    while (index < targets.length) {
      const result = targets[index++];
      const id = result.deliverableId!;
      const startedAt = Date.now();
      try {
        await generateAndStoreImage(id);
        console.log(
          `  ✓ ${result.job.bucket} · ${result.job.label.slice(0, 64)} · ${Math.round(
            (Date.now() - startedAt) / 1000,
          )}s`,
        );
      } catch (error) {
        failures++;
        console.log(
          `  ✗ ${result.job.bucket} · ${result.job.label.slice(0, 64)} · ${
            (error as Error).message
          }`,
        );
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(IMAGE_CONC, targets.length) }, () => worker()),
  );
  if (failures) {
    throw new Error(`Fallaron ${failures}/${targets.length} portadas.`);
  }
}

function imageModel(metadata: unknown): string | null {
  const image = asObject(asObject(metadata).image);
  return typeof image.modelo === "string" ? image.modelo : null;
}

function isOpenAIImageModel(model: string | null): boolean {
  return Boolean(model && /^gpt-image-/i.test(model));
}

function hasFullOpenAIImageMethodology(metadata: unknown): boolean {
  const image = asObject(asObject(metadata).image);
  const reason = typeof asObject(image.acento).razon === "string"
    ? String(asObject(image.acento).razon)
    : "";
  return (
    image.status === "ok" &&
    isOpenAIImageModel(typeof image.modelo === "string" ? image.modelo : null) &&
    Array.isArray(image.queries) &&
    !/dirección de respaldo/i.test(reason)
  );
}

/**
 * Rehace portadas faltantes o producidas por otro proveedor usando el pipeline
 * completo (búsqueda de referencias, dirección de arte y GPT Image), sin
 * respaldo alternativo. En error preserva la portada previa para que una
 * prueba de billing/moderación no deje la ficha en peor estado.
 */
async function generateOpenAICovers(results: QaResult[]) {
  const candidateIds = results
    .map((result) => result.deliverableId)
    .filter((id): id is string => Boolean(id));
  const rows = await withDbRetry("openai-cover-audit", () =>
    prisma.deliverable.findMany({
      where: { id: { in: candidateIds } },
      select: {
        id: true,
        metadata: true,
        imageKey: true,
        imageUrl: true,
      },
    }),
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  let targets = results.filter((result) => {
    if (!result.deliverableId) return false;
    if (onlyDeliverableId === result.deliverableId) return true;
    const row = byId.get(result.deliverableId);
    return (
      !row?.imageKey ||
      !row?.imageUrl ||
      !hasFullOpenAIImageMethodology(row.metadata)
    );
  });
  if (onlyDeliverableId) {
    targets = targets.filter(
      (result) => result.deliverableId === onlyDeliverableId,
    );
  }
  if (requestedLimit > 0) targets = targets.slice(0, requestedLimit);

  const counts = targets.reduce<Record<string, number>>((out, result) => {
    out[result.job.bucket] = (out[result.job.bucket] ?? 0) + 1;
    return out;
  }, {});
  console.log(
    `\nPORTADAS OPENAI-ONLY: ${targets.length} · concurrencia ${IMAGE_CONC} · ${JSON.stringify(
      counts,
    )}`,
  );
  let index = 0;
  let failures = 0;
  const worker = async () => {
    while (index < targets.length) {
      const result = targets[index++];
      const id = result.deliverableId!;
      const startedAt = Date.now();
      try {
        await enforceExpectedPeriod(id, result.job);
        if (CAMPAIGN_ID === "2026-08-04") {
          await regenerateCampaignImageRemote(id, result.job);
        } else {
          await generateAndStoreImage(id, {
            allowBedrockFallback: false,
            preserveExistingOnError: true,
            requireArtDirection: true,
            allowHistoricalNonLikeness:
              result.job.expectedPeriodCode === "PRE" ||
              result.job.allowHistoricalNonLikeness,
          });
        }
        const verified = await withDbRetry(`verify-openai-cover:${id}`, () =>
          prisma.deliverable.findUnique({
            where: { id },
            select: { metadata: true, imageKey: true, imageUrl: true },
          }),
        );
        const model = imageModel(verified?.metadata);
        if (
          !verified?.imageKey ||
          !verified.imageUrl ||
          !hasFullOpenAIImageMethodology(verified.metadata)
        ) {
          throw new Error(
            `la portada persistida no acredita OpenAI (${model ?? "sin modelo"})`,
          );
        }
        console.log(
          `  ✓ ${result.job.bucket} · ${result.job.label.slice(0, 64)} · ${model} · ${Math.round(
            (Date.now() - startedAt) / 1000,
          )}s`,
        );
      } catch (error) {
        failures++;
        console.log(
          `  ✗ ${result.job.bucket} · ${result.job.label.slice(0, 64)} · ${
            (error as Error).message
          }`,
        );
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(IMAGE_CONC, targets.length) }, () => worker()),
  );
  if (failures) {
    throw new Error(
      `Fallaron ${failures}/${targets.length} portadas OpenAI-only; las portadas previas se conservaron.`,
    );
  }
}

function isImageQaError(error: string): boolean {
  return (
    error === "sin portada persistida" ||
    error.startsWith("imagen ") ||
    error.startsWith("portada sin metodología OpenAI completa")
  );
}

/**
 * Sustituye fichas no publicadas que fallan el gate editorial por una nueva
 * producción canónica. Las versiones rechazadas se conservan como ERROR para
 * auditoría; nunca se toca una ficha ya publicada.
 */
async function replaceRejected(results: QaResult[]) {
  let targets = results.filter(
    (result) =>
      result.deliverableId &&
      !result.ok &&
      result.errors.some((error) => !isImageQaError(error)),
  );
  if (onlyDeliverableId) {
    targets = targets.filter(
      (result) => result.deliverableId === onlyDeliverableId,
    );
  }
  if (requestedLimit > 0) targets = targets.slice(0, requestedLimit);

  console.log(
    `\nREEMPLAZOS EDITORIALES: ${targets.length} · concurrencia ${CONC}`,
  );
  let index = 0;
  let failures = 0;
  const worker = async () => {
    while (index < targets.length) {
      const result = targets[index++];
      const rows = await latestRows(result.job);
      const published = rows.filter(
        (row) => row.status === "COMPLETE" && row.publishedAt,
      );
      if (published.length) {
        failures++;
        console.log(
          `  ✗ ${result.job.bucket} · ${result.job.label.slice(0, 64)} · ya publicada; requiere revisión manual`,
        );
        continue;
      }
      const rejectedIds = rows
        .filter((row) => row.status === "COMPLETE" && !row.publishedAt)
        .map((row) => row.id);
      if (!rejectedIds.length) continue;

      await withDbRetry(
        `retire-rejected:${result.job.bucket}:${result.job.key}`,
        () =>
          prisma.deliverable.updateMany({
            where: { id: { in: rejectedIds } },
            data: { status: "ERROR" },
          }),
      );
      const startedAt = Date.now();
      try {
        const replacement = await produceOne(result.job);
        console.log(
          `  ✓ ${result.job.bucket} · ${result.job.label.slice(0, 64)} · ${replacement.id} · ${Math.round(
            (Date.now() - startedAt) / 1000,
          )}s`,
        );
      } catch (error) {
        failures++;
        console.log(
          `  ✗ ${result.job.bucket} · ${result.job.label.slice(0, 64)} · ${
            (error as Error).message
          }`,
        );
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONC, targets.length) }, () => worker()),
  );
  if (failures) {
    throw new Error(`Fallaron ${failures}/${targets.length} reemplazos editoriales.`);
  }
}

async function publish(results: QaResult[], readyOnly = false) {
  const rejected = results.filter((result) => !result.ok);
  if (!readyOnly && rejected.length) {
    throw new Error(`Publicación bloqueada por ${rejected.length} piezas rechazadas en QA.`);
  }
  const unpublished = results.filter(
    (result) => result.deliverableId && (!readyOnly || result.ok),
  );
  if (readyOnly) {
    console.log(
      `\nPUBLICACIÓN PARCIAL: ${unpublished.length} aprobadas · ${rejected.length} rechazadas excluidas`,
    );
  }
  let index = 0;
  let failures = 0;
  const worker = async () => {
    while (index < unpublished.length) {
      const result = unpublished[index++];
      const response = await apiWrite(
        `/api/deliverables/${result.deliverableId}`,
        "PATCH",
        { published: true },
      );
      if (response.status >= 200 && response.status < 300) {
        console.log(`  ✓ ${result.job.bucket} · ${result.path}`);
      } else {
        failures++;
        console.log(
          `  ✗ ${result.job.bucket} · ${result.job.label.slice(0, 60)} · HTTP ${
            response.status
          }`,
        );
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  if (failures) throw new Error(`Fallaron ${failures} publicaciones.`);
}

async function verify(results: QaResult[], readyOnly = false) {
  let targets = readyOnly ? results.filter((result) => result.ok) : results;
  if (readyOnly) {
    const candidateIds = targets
      .map((result) => result.deliverableId)
      .filter((id): id is string => Boolean(id));
    const published = await withDbRetry("verify-ready-published", () =>
      prisma.deliverable.findMany({
        where: {
          id: { in: candidateIds },
          publishedAt: { not: null },
        },
        select: { id: true },
      }),
    );
    const publishedIds = new Set(published.map((row) => row.id));
    targets = targets.filter(
      (result) =>
        Boolean(result.deliverableId) &&
        publishedIds.has(result.deliverableId as string),
    );
  }
  const failures: string[] = [];
  let index = 0;
  const worker = async () => {
    while (index < targets.length) {
      const result = targets[index++];
      if (!result.deliverableId || !result.path) {
        failures.push(`${result.job.bucket}:${result.job.key}:sin ruta/id`);
        continue;
      }
      const row = await prisma.deliverable.findUnique({
        where: { id: result.deliverableId },
        select: { publishedAt: true, imageKey: true, imageUrl: true },
      });
      if (!row?.publishedAt) {
        failures.push(`${result.path}:sin publishedAt`);
        continue;
      }
      const [page, image] = await Promise.all([
        fetch(`${BASE}${result.path}`, { redirect: "follow" }),
        fetch(`${BASE}/api/public-image/${result.deliverableId}`, {
          redirect: "follow",
        }),
      ]);
      if (page.status !== 200) failures.push(`${result.path}:HTTP ${page.status}`);
      const contentType = image.headers.get("content-type") ?? "";
      if (image.status !== 200 || !contentType.startsWith("image/")) {
        failures.push(
          `/api/public-image/${result.deliverableId}:HTTP ${image.status} ${contentType}`,
        );
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, () => worker()));
  if (failures.length) {
    console.log("\nFALLAS DE VERIFICACIÓN");
    for (const failure of failures) console.log(`  ✗ ${failure}`);
    throw new Error(`Verificación pública falló en ${failures.length} comprobaciones.`);
  }
  console.log(
    `\nVERIFICACIÓN PÚBLICA: ${targets.length}/${
      targets.length
    } páginas 200 + ${targets.length}/${targets.length} portadas image/*`,
  );
}

async function printPlan(all: Job[]) {
  const counts = all.reduce<Record<string, number>>((out, job) => {
    out[job.bucket] = (out[job.bucket] ?? 0) + 1;
    return out;
  }, {});
  console.log(`Campaña ${CAMPAIGN_ID} · lote ${all.length} · ${BASE}`);
  console.log(JSON.stringify(counts));
  for (const bucket of ["person", "place", "concept", "master"]) {
    console.log(`\n${bucket.toUpperCase()}`);
    for (const job of all.filter((value) => value.bucket === bucket)) {
      console.log(
        `  - ${job.key} · ${job.label}${
          job.expectedPeriodCode ? ` · ${job.expectedPeriodCode}` : ""
        }`,
      );
    }
  }
}

async function main() {
  const all = jobs();
  assertManifest(all);
  await hydrateMasterLabels(all);
  if (argv.has("--plan")) {
    await printPlan(all);
    await assertNewPublicKeys(all);
    console.log(`\nPLAN VÁLIDO: ${all.length} llaves inéditas.`);
    return;
  }

  await initAuth();
  if (argv.has("--produce")) {
    if (!argv.has("--resume")) {
      await assertNewPublicKeys(all);
    }
    const bucketJobs = requestedBucket
      ? all.filter((job) => job.bucket === requestedBucket)
      : all;
    if (requestedBucket && bucketJobs.length === 0) {
      throw new Error(`Bucket inválido o vacío: ${requestedBucket}`);
    }
    const selected = bucketJobs.slice(
      requestedOffset,
      requestedLimit > 0 ? requestedOffset + requestedLimit : undefined,
    );
    if (selected.length === 0) {
      throw new Error(`Rango de producción vacío: offset=${requestedOffset}`);
    }
    await runProduction(selected);
    return;
  }

  const qa = await runQa(all);
  if (argv.has("--qa")) return;
  if (argv.has("--covers")) {
    await generateMissingCovers(qa);
    return;
  }
  if (argv.has("--openai-covers")) {
    await generateOpenAICovers(qa);
    return;
  }
  if (argv.has("--replace-rejected")) {
    await replaceRejected(qa);
    return;
  }
  if (argv.has("--publish")) {
    await publish(qa);
    return;
  }
  if (argv.has("--publish-ready")) {
    await publish(qa, true);
    return;
  }
  if (argv.has("--verify")) {
    await verify(qa);
    return;
  }
  if (argv.has("--verify-ready")) {
    await verify(qa, true);
    return;
  }
  throw new Error(
    "Usa --plan, --produce [--resume] [--bucket=person|place|concept|master] [--offset=N] [--limit=N], --qa, --covers, --openai-covers, --replace-rejected, --publish, --publish-ready, --verify o --verify-ready.",
  );
}

main()
  .catch((error) => {
    console.error(`\nFATAL: ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
