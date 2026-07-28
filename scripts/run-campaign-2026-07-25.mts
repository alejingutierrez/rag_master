/**
 * Produce, revisa, publica y verifica el lote editorial 2026-07-25.
 *
 * Uso:
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --plan
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --produce
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --qa
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --covers
 *   node --import tsx scripts/run-campaign-2026-07-25.mts --publish
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
  CAMPAIGN_ENTITIES,
  CAMPAIGN_MASTER_IDS,
  type CampaignEntity,
} from "./campaign-2026-07-25-manifest";

const BASE = process.env.SITE_URL || "https://historiacolombiana.com";
const CONC = Math.max(1, Number(process.env.CONC ?? "3"));
const IMAGE_CONC = Math.max(1, Number(process.env.IMAGE_CONC ?? "2"));
const POLL_MS = Number(process.env.POLL_MS ?? "8000");
const MAX_ITEM_MS = Number(process.env.MAX_ITEM_MS ?? String(40 * 60 * 1000));
const STALE_GENERATING_MS = Number(
  process.env.STALE_GENERATING_MS ?? String(20 * 60 * 1000),
);
const DB_RETRY_ATTEMPTS = Math.max(
  1,
  Number(process.env.DB_RETRY_ATTEMPTS ?? "80"),
);
const DB_RETRY_MAX_MS = Number(process.env.DB_RETRY_MAX_MS ?? "30000");
const STATE_FILE =
  process.env.STATE_FILE || join(tmpdir(), "rag-master-campaign-2026-07-25.json");
const argv = new Set(process.argv.slice(2));

type Bucket = CampaignEntity["type"] | "master";
type SourceKind = "entidad" | "pregunta-madre";

interface Job {
  bucket: Bucket;
  key: string;
  label: string;
  intent?: string;
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
let imageBillingBlocked = false;

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
    if (counts[bucket] !== 30) {
      throw new Error(`Manifest inválido: ${bucket}=${counts[bucket] ?? 0}, se esperaban 30.`);
    }
  }
  const keys = new Set(all.map((job) => `${job.sourceKind}:${job.key}`));
  if (keys.size !== all.length) {
    throw new Error(`Manifest inválido: ${all.length - keys.size} llaves duplicadas.`);
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

async function pollUntilReady(deliverableId: string): Promise<void> {
  let imageKickoffStarted = false;
  let imageRetries = 0;
  const startedAt = Date.now();
  for (;;) {
    if (Date.now() - startedAt > MAX_ITEM_MS) {
      throw new Error(`timeout tras ${Math.round(MAX_ITEM_MS / 60000)} min`);
    }
    await sleep(POLL_MS);
    let row: PollDeliverable;
    try {
      row = await apiGet(`/api/deliverables/${deliverableId}`);
    } catch {
      continue;
    }
    const imageState = asObject(asObject(row.metadata).image);
    const imageError =
      typeof imageState.error === "string" ? imageState.error : "";
    if (/billing hard limit|billing_hard_limit_reached/i.test(imageError)) {
      imageBillingBlocked = true;
      throw new Error("image-billing-hard-limit");
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
      if (imageBillingBlocked) throw new Error("image-billing-hard-limit");
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

async function produceOne(job: Job): Promise<{ id: string; reused: boolean }> {
  const existing = await latestRows(job);
  const usable = existing.find(
    (row) =>
      row.status === "COMPLETE" ||
      (row.status === "GENERATING" &&
        Date.now() - row.updatedAt.getTime() < STALE_GENERATING_MS),
  );
  if (usable) {
    await pollUntilReady(usable.id);
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
  await pollUntilReady(id);
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
      `El manifest no representa 120 páginas nuevas; ya publicadas: ${problems.join(", ")}`,
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

async function publish(results: QaResult[]) {
  const rejected = results.filter((result) => !result.ok);
  if (rejected.length) {
    throw new Error(`Publicación bloqueada por ${rejected.length} piezas rechazadas en QA.`);
  }
  const unpublished = results.filter((result) => result.deliverableId);
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

async function verify(results: QaResult[]) {
  const failures: string[] = [];
  let index = 0;
  const worker = async () => {
    while (index < results.length) {
      const result = results[index++];
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
    `\nVERIFICACIÓN PÚBLICA: ${results.length}/${
      results.length
    } páginas 200 + ${results.length}/${results.length} portadas image/*`,
  );
}

async function printPlan(all: Job[]) {
  const counts = all.reduce<Record<string, number>>((out, job) => {
    out[job.bucket] = (out[job.bucket] ?? 0) + 1;
    return out;
  }, {});
  console.log(`Lote ${all.length} · ${BASE}`);
  console.log(JSON.stringify(counts));
  for (const bucket of ["person", "place", "concept", "master"]) {
    console.log(`\n${bucket.toUpperCase()}`);
    for (const job of all.filter((value) => value.bucket === bucket)) {
      console.log(`  - ${job.key} · ${job.label}`);
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
    console.log("\nPLAN VÁLIDO: 120 llaves inéditas.");
    return;
  }

  await initAuth();
  if (argv.has("--produce")) {
    await assertNewPublicKeys(all);
    await runProduction(all);
    return;
  }

  const qa = await runQa(all);
  if (argv.has("--qa")) return;
  if (argv.has("--covers")) {
    await generateMissingCovers(qa);
    return;
  }
  if (argv.has("--publish")) {
    await publish(qa);
    return;
  }
  if (argv.has("--verify")) {
    await verify(qa);
    return;
  }
  throw new Error("Usa --plan, --produce, --qa, --covers, --publish o --verify.");
}

main()
  .catch((error) => {
    console.error(`\nFATAL: ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
