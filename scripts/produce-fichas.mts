/**
 * Producción en serie (headless) de FICHAS con portada, en versión EXTENSA.
 *
 * DIRIGE EL APP DESPLEGADO (que tiene credenciales válidas de Bedrock/OpenAI): es
 * la réplica headless de la pestaña "Producción en serie". Autentica con una
 * cookie de sesión firmada localmente con AUTH_SECRET (idéntico al de prod).
 * Las LECTURAS de catálogo/estado van directo a la RDS (read-only, funcionan).
 *
 * Trabajo:
 *   - HECHOS sin ficha             → POST /api/atelier (ficha-hecho, extensa) + portada
 *   - HECHOS con ficha sin portada → POST /api/deliverables/{id}/generate-image
 *   - PERSONAS/LUGARES/CONCEPTOS   → top-N por menciones, ficha-entidad extensa + portada
 *
 * Cooperativo (hay producción concurrente en prod): re-chequea justo antes de
 * actuar y salta lo ya hecho. Resumible: recomputa lo pendiente al arrancar.
 *
 *   node --import tsx scripts/produce-fichas.mts            # todo lo pendiente
 *   CONC=3 TOP_N=30 node --import tsx scripts/produce-fichas.mts
 *   node --import tsx scripts/produce-fichas.mts --plan     # solo plan (no escribe)
 *   node --import tsx scripts/produce-fichas.mts --only person --limit 1   # canario
 */
import { config as dotenv } from "dotenv";
// .env: el del cwd; si corres desde un worktree, cae al del repo padre.
dotenv({ path: process.env.ENV_FILE || `${process.cwd()}/.env` });
dotenv({ path: `${process.cwd()}/../../../.env` });

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { prisma } from "../src/lib/prisma";
import { signSession, adminEmail, SESSION_COOKIE } from "../src/lib/auth";
import { slugify } from "../src/lib/typology-schemas";
import { hechoKey, entidadKey, type SourceKind } from "../src/lib/source-ref";
import { evaluateSeriesPoll } from "../src/lib/atelier/series";

// ── Config ───────────────────────────────────────────────────────────────────
const BASE = process.env.SITE_URL || "https://historiacolombiana.com";
const CONC = Math.max(1, Number(process.env.CONC ?? "3"));
const TOP_N = Math.max(1, Number(process.env.TOP_N ?? "30"));
const REPORT_MS = Number(process.env.REPORT_MS ?? String(5 * 60 * 1000));
const POLL_MS = Number(process.env.POLL_MS ?? "8000");
const MAX_ITEM_MS = Number(process.env.MAX_ITEM_MS ?? String(35 * 60 * 1000));
const argv = process.argv.slice(2);
const LIMIT = (() => { const i = argv.indexOf("--limit"); return i >= 0 ? Number(argv[i + 1]) : Infinity; })();
const PLAN_ONLY = argv.includes("--plan");
const ONLY = (() => { const i = argv.indexOf("--only"); return i >= 0 ? argv[i + 1] : null; })();
// Estado de avance (JSON legible mientras corre). Override con STATE_FILE.
const STATE_FILE = process.env.STATE_FILE || join(tmpdir(), "produce-fichas-state.json");

const startMs = Date.now();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);
const log = (line: string) => console.log(line);

// ── Cliente autenticado del app desplegado ───────────────────────────────────
let COOKIE = "";
async function initAuth() {
  const token = await signSession({ sub: adminEmail(), role: "admin" });
  COOKIE = `${SESSION_COOKIE}=${token}`;
}
async function apiGet(path: string): Promise<any> {
  const r = await fetch(`${BASE}${path}`, { headers: { Cookie: COOKIE } });
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json();
}
async function apiPost(path: string, body?: unknown): Promise<{ status: number; json: any }> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Cookie: COOKIE, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

// ── Estado de producción en prod (deliverableId + portada) ───────────────────
interface ProducedInfo { deliverableId: string; hasImage: boolean }
async function producedFromDB(templateId: string): Promise<Map<string, ProducedInfo>> {
  const dels = await prisma.deliverable.findMany({
    where: { status: "COMPLETE", templateId },
    select: { id: true, metadata: true, imageUrl: true, imageKey: true },
    orderBy: { updatedAt: "desc" },
  });
  const out = new Map<string, ProducedInfo>();
  for (const d of dels) {
    const sr = (d.metadata as { sourceRef?: { key?: unknown } } | null)?.sourceRef;
    const k = typeof sr?.key === "string" ? sr.key : "";
    if (!k || out.has(k)) continue;
    out.set(k, { deliverableId: d.id, hasImage: Boolean(d.imageUrl || d.imageKey) });
  }
  return out;
}
const SKIP_GENERATING_MS = Number(process.env.SKIP_GENERATING_MS ?? String(45 * 60 * 1000));

/**
 * Ejecuta un guard de BD tolerando fallos: si la consulta falla (p.ej. timeout
 * del pool de conexiones en corridas largas), NO se pierde la pieza — se sigue
 * adelante con el fallback (a lo sumo se duplica, que es inocuo).
 */
async function safeGuard<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
  for (let i = 0; i < 2; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === 0) { await sleep(1500); continue; }
      log(`   ⚠ guard ${label} falló (${(e as Error).message.slice(0, 60)}) — continúo sin saltar`);
    }
  }
  return fallback;
}
/** Salta si ya hay ficha COMPLETE, o una GENERATING reciente (otra corrida la está haciendo). */
async function alreadyProduced(templateId: string, key: string): Promise<boolean> {
  const d = await prisma.deliverable.findFirst({
    where: {
      templateId,
      metadata: { path: ["sourceRef", "key"], equals: key },
      OR: [
        { status: "COMPLETE" },
        { status: "GENERATING", updatedAt: { gte: new Date(Date.now() - SKIP_GENERATING_MS) } },
      ],
    },
    select: { id: true },
  });
  return Boolean(d);
}
async function hasImageNow(deliverableId: string): Promise<boolean> {
  const d = await prisma.deliverable.findUnique({ where: { id: deliverableId }, select: { imageUrl: true, imageKey: true } });
  return Boolean(d?.imageUrl || d?.imageKey);
}

// ── Catálogos ────────────────────────────────────────────────────────────────
interface TLEvent { id: string; titulo: string; porQueImporta?: string; anioInicio?: number; anioFin?: number }
function readJson<T>(rel: string): T | null {
  try { return JSON.parse(readFileSync(join(process.cwd(), rel), "utf8")) as T; } catch { return null; }
}
function yearSpan(a?: number, b?: number): string {
  if (a == null) return "";
  const f = (y: number) => (y < 0 ? `${-y} a.C.` : `${y}`);
  return a === b || b == null ? f(a) : `${f(a)}–${f(b)}`;
}
function hechosCatalog(): { key: string; label: string; intent: string }[] {
  const mined = readJson<{ periods: Record<string, { events?: TLEvent[] }> }>("src/data/timeline-events.json");
  const curated = readJson<{ periods: Record<string, TLEvent[]> }>("src/data/timeline-events-curated.json");
  const out: { key: string; label: string; intent: string }[] = [];
  const periods = mined?.periods ?? {};
  for (const code of Object.keys(periods)) {
    const seen = new Set<string>();
    const events = [...(periods[code].events ?? []), ...((curated?.periods?.[code]) ?? [])];
    for (const e of events) {
      if (!e?.id || seen.has(e.id)) continue;
      seen.add(e.id);
      const span = yearSpan(e.anioInicio, e.anioFin);
      const intent = `${e.titulo}${span ? ` (${span})` : ""}${e.porQueImporta ? `: ${e.porQueImporta}` : ""}`;
      out.push({ key: hechoKey(code, e), label: e.titulo, intent });
    }
  }
  return out;
}
type EType = "person" | "place" | "concept";
async function entidadesCatalog(): Promise<Record<EType, { key: string; label: string; intent: string }[]>> {
  const questions = await prisma.question.findMany({
    select: { id: true, entidadesPersonas: true, entidadesLugares: true, entidadesConceptos: true },
  });
  interface B { mentions: number; qids: Set<string>; type: EType; variants: Map<string, number> }
  const map = new Map<string, B>();
  const key = (t: string, name: string) => `${t}::${name.trim().toLowerCase()}`;
  const ingest = (type: EType, items: string[], qid: string) => {
    for (const raw of items ?? []) {
      const name = (raw ?? "").trim();
      if (!name) continue;
      const k = key(type, name);
      const ex = map.get(k);
      if (ex) { ex.qids.add(qid); ex.mentions = ex.qids.size; ex.variants.set(name, (ex.variants.get(name) ?? 0) + 1); }
      else map.set(k, { mentions: 1, qids: new Set([qid]), type, variants: new Map([[name, 1]]) });
    }
  };
  for (const q of questions) {
    ingest("person", q.entidadesPersonas, q.id);
    ingest("place", q.entidadesLugares, q.id);
    ingest("concept", q.entidadesConceptos, q.id);
  }
  const bestName = (b: B) => { let best = "", bc = -1; for (const [v, c] of b.variants) if (c > bc) { best = v; bc = c; } return best; };
  const out: Record<EType, { key: string; label: string; intent: string; mentions: number }[]> =
    { person: [], place: [], concept: [] } as never;
  for (const b of map.values()) {
    if (b.mentions < 2) continue;
    const name = bestName(b);
    // Framing consistente con las fichas ya producidas (intent = nombre). Nombres
    // muy cortos se enriquecen para superar el guard de ≥12 chars del route, sin
    // alterar el título (que la pieza deriva del contenido).
    const intent = name.length >= 12 ? name : `${name} en la historia de Colombia`;
    (out[b.type] as { key: string; label: string; intent: string; mentions: number }[])
      .push({ key: entidadKey(b.type, name), label: name, intent, mentions: b.mentions });
  }
  for (const t of ["person", "place", "concept"] as EType[]) (out[t] as { mentions: number }[]).sort((a, b) => b.mentions - a.mentions);
  return out as Record<EType, { key: string; label: string; intent: string }[]>;
}

// ── Jobs ─────────────────────────────────────────────────────────────────────
type Job =
  | { type: "full"; bucket: string; label: string; formatId: "ficha-hecho" | "ficha-entidad"; intent: string; sourceRef: { kind: SourceKind; key: string; label: string } }
  | { type: "portada"; bucket: string; label: string; deliverableId: string };

async function buildWorklist(): Promise<Job[]> {
  const [prodHecho, prodEnt, ents] = await Promise.all([
    producedFromDB("ficha-hecho"),
    producedFromDB("ficha-entidad"),
    entidadesCatalog(),
  ]);
  const hechos = hechosCatalog();
  const jobs: Job[] = [];
  for (const h of hechos) {
    const p = prodHecho.get(h.key);
    if (!p) jobs.push({ type: "full", bucket: "hecho", label: h.label, formatId: "ficha-hecho", intent: h.intent, sourceRef: { kind: "hecho", key: h.key, label: h.label } });
    else if (!p.hasImage) jobs.push({ type: "portada", bucket: "hecho", label: h.label, deliverableId: p.deliverableId });
  }
  for (const t of ["person", "place", "concept"] as EType[]) {
    for (const e of ents[t].slice(0, TOP_N)) {
      const p = prodEnt.get(e.key);
      if (!p) jobs.push({ type: "full", bucket: t, label: e.label, formatId: "ficha-entidad", intent: e.intent, sourceRef: { kind: "entidad", key: e.key, label: e.label } });
      else if (!p.hasImage) jobs.push({ type: "portada", bucket: t, label: e.label, deliverableId: p.deliverableId });
    }
  }
  return jobs;
}

// ── Ejecución remota (mirror de la serie: POST + poll) ───────────────────────
async function pollUntilDone(deliverableId: string, label: string): Promise<void> {
  let imageKickoffStarted = false;
  let imageRetries = 0;
  const t0 = Date.now();
  for (;;) {
    if (Date.now() - t0 > MAX_ITEM_MS) throw new Error(`timeout tras ${(MAX_ITEM_MS / 60000).toFixed(0)}min`);
    await sleep(POLL_MS);
    let d: any;
    try { d = await apiGet(`/api/deliverables/${deliverableId}`); } catch { continue; } // transitorio → reintenta
    const action = evaluateSeriesPoll(d, { requireImage: true, imageRetries, imageKickoffStarted });
    if (action.kind === "done") return;
    if (action.kind === "error") throw new Error(`${action.reason}`);
    if (action.kind === "trigger-image") {
      if (!imageKickoffStarted || action.reason === "image-error") {
        const ir = await apiPost(`/api/deliverables/${deliverableId}/generate-image`);
        // 202 Accepted (corre en after()), 200 OK, 409 ya-en-curso → todos válidos.
        const okKick = (ir.status >= 200 && ir.status < 300) || ir.status === 409;
        if (!okKick) throw new Error(ir.json?.error ?? `generate-image ${ir.status}`);
        imageKickoffStarted = true;
        if (action.reason === "image-error") imageRetries++;
      }
    }
  }
}

async function produceFull(job: Extract<Job, { type: "full" }>): Promise<{ skipped: boolean; deliverableId?: string }> {
  if (await safeGuard(() => alreadyProduced(job.formatId, job.sourceRef.key), false, `alreadyProduced ${job.label}`)) return { skipped: true };
  const r = await apiPost("/api/atelier", {
    intent: job.intent,
    formatId: job.formatId,
    longitud: "extensa",
    sourceRef: job.sourceRef,
  });
  if (r.status !== 200) throw new Error(r.json?.error ?? `POST /api/atelier ${r.status}`);
  const deliverableId = r.json?.deliverableId as string | undefined;
  if (!deliverableId) throw new Error("sin deliverableId");
  await pollUntilDone(deliverableId, job.label);
  return { skipped: false, deliverableId };
}

// ── Estado / reporte ─────────────────────────────────────────────────────────
interface St { total: number; done: number; fail: number; skipped: number; startedAt: string; buckets: Record<string, { total: number; done: number; fail: number }>; inflight: string[]; failedItems: string[]; finishedAt?: string }
function writeState(s: St) {
  try { mkdirSync(dirname(STATE_FILE), { recursive: true }); writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); } catch {}
}
function report(s: St, tag = "REPORT") {
  const elapsedMin = (Date.now() - startMs) / 60000;
  const closed = s.done + s.skipped;
  const rate = closed > 0 ? closed / elapsedMin : 0;
  const remaining = s.total - s.done - s.fail - s.skipped;
  const etaMin = rate > 0 ? remaining / rate : NaN;
  const bd = Object.entries(s.buckets).map(([k, v]) => `${k} ${v.done}/${v.total}${v.fail ? `✕${v.fail}` : ""}`).join(" · ");
  const inflight = s.inflight.length ? ` | en curso: ${s.inflight.slice(0, CONC).map((l) => l.slice(0, 26)).join(", ")}` : "";
  log(`[${tag}] ${ts()} · ${s.done}/${s.total} listas${s.skipped ? ` · ⤳${s.skipped}` : ""}${s.fail ? ` · ✕${s.fail}` : ""} · ${elapsedMin.toFixed(0)}min · ${rate.toFixed(2)}/min · ETA ~${Number.isFinite(etaMin) ? Math.ceil(etaMin) : "?"}min | ${bd}${inflight}`);
}

async function pool(jobs: Job[], n: number, st: St) {
  let idx = 0;
  const worker = async () => {
    while (idx < jobs.length) {
      const job = jobs[idx++];
      const tag = `${job.bucket}:${job.label}`;
      st.inflight.push(tag); writeState(st);
      const t0 = Date.now();
      try {
        if (job.type === "portada") {
          if (await safeGuard(() => hasImageNow(job.deliverableId), false, `hasImage ${job.label}`)) { st.skipped++; log(`[SKIP] ${ts()} · portada ya existe · ${job.bucket} · ${job.label}`); }
          else { await pollUntilDone(job.deliverableId, job.label); st.done++; st.buckets[job.bucket].done++; log(`[DONE] ${ts()} · portada · ${job.bucket} · ${job.label} · ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
        } else {
          const r = await produceFull(job);
          if (r.skipped) { st.skipped++; log(`[SKIP] ${ts()} · ya producida · ${job.bucket} · ${job.label}`); }
          else { st.done++; st.buckets[job.bucket].done++; log(`[DONE] ${ts()} · ficha · ${job.bucket} · ${job.label} · ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
        }
      } catch (e) {
        st.fail++; st.buckets[job.bucket].fail++; st.failedItems.push(`${job.bucket}:${job.label} — ${(e as Error).message}`);
        log(`[ERR] ${ts()} · ${job.bucket} · ${job.label} · ${(e as Error).message}`);
      } finally {
        const i = st.inflight.indexOf(tag); if (i >= 0) st.inflight.splice(i, 1);
        writeState(st);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, worker));
}

async function main() {
  await initAuth();
  // Verifica auth contra prod antes de empezar (falla temprano si el secreto no cuadra).
  const probe = await fetch(`${BASE}/api/production-state?kind=entidad`, { headers: { Cookie: COOKIE } });
  if (!probe.ok) throw new Error(`Auth contra ${BASE} falló (${probe.status}). ¿AUTH_SECRET/ADMIN_EMAIL correctos?`);

  let jobs = await buildWorklist();
  if (ONLY) jobs = jobs.filter((j) => j.type === ONLY || j.bucket === ONLY);
  // Portadas PRIMERO: son baratas (solo imagen) y cierran de una las piezas cuyo
  // contenido ya está pero les falta la portada (victorias rápidas).
  jobs.sort((a, b) => (a.type === "portada" ? 0 : 1) - (b.type === "portada" ? 0 : 1));
  if (Number.isFinite(LIMIT)) jobs = jobs.slice(0, LIMIT);

  const buckets: St["buckets"] = {};
  for (const j of jobs) (buckets[j.bucket] ??= { total: 0, done: 0, fail: 0 }).total++;
  const st: St = { total: jobs.length, done: 0, fail: 0, skipped: 0, startedAt: new Date().toISOString(), buckets, inflight: [], failedItems: [] };

  const byType = jobs.reduce((m, j) => ((m[j.type] = (m[j.type] ?? 0) + 1), m), {} as Record<string, number>);
  log(`▸ PLAN · ${BASE} · ${jobs.length} ítems · full=${byType.full ?? 0} portada=${byType.portada ?? 0} · conc ${CONC} · extensa`);
  for (const [b, v] of Object.entries(buckets)) log(`   · ${b}: ${v.total}`);
  writeState(st);
  if (PLAN_ONLY) { await prisma.$disconnect(); return; }

  report(st, "REPORT");
  const timer = setInterval(() => report(st, "REPORT"), REPORT_MS);
  await pool(jobs, CONC, st);
  clearInterval(timer);

  st.finishedAt = new Date().toISOString();
  writeState(st);
  report(st, "FIN");
  if (st.failedItems.length) { log(`✕ Fallidos (${st.failedItems.length}):`); for (const f of st.failedItems) log(`   - ${f}`); }
  log(`[FIN] ${ts()} · ${st.done}/${st.total} listas · ⤳${st.skipped} saltadas · ✕${st.fail} fallidas · ${((Date.now() - startMs) / 60000).toFixed(1)}min`);
  await prisma.$disconnect();
}
main().catch(async (e) => { log(`[FATAL] ${(e as Error).message}`); console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
