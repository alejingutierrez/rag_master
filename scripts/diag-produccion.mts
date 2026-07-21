/**
 * Diagnóstico read-only del estado de producción de FICHAS con portada.
 * Cruza el catálogo (mismos ítems/llaves que la serie) contra el estado real en
 * la RDS de prod (Deliverable ficha COMPLETE + imageUrl). NO escribe nada.
 *
 *   node --import tsx scripts/diag-produccion.mts
 */
import { config as dotenv } from "dotenv";
// .env: el del cwd; si corres desde un worktree, cae al del repo padre.
dotenv({ path: process.env.ENV_FILE || `${process.cwd()}/.env` });
dotenv({ path: `${process.cwd()}/../../../.env` });

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/typology-schemas";
import { hechoKey, entidadKey } from "../src/lib/source-ref";

const TOP_N = 30;

interface ProducedInfo { deliverableId: string; hasImage: boolean; published: boolean }

async function producedFromDB(templateId: string): Promise<Map<string, ProducedInfo>> {
  const dels = await prisma.deliverable.findMany({
    where: { status: "COMPLETE", templateId },
    select: { id: true, metadata: true, imageUrl: true, imageKey: true, publishedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  const out = new Map<string, ProducedInfo>();
  for (const d of dels) {
    const sr = (d.metadata as { sourceRef?: { key?: unknown } } | null)?.sourceRef;
    const k = typeof sr?.key === "string" ? sr.key : "";
    if (!k || out.has(k)) continue;
    out.set(k, { deliverableId: d.id, hasImage: Boolean(d.imageUrl || d.imageKey), published: Boolean(d.publishedAt) });
  }
  return out;
}

// ── Catálogo de hechos: mined ∪ curated (por período, dedupe por id) ─────────
interface TLEvent { id: string; titulo: string }
function readJson<T>(rel: string): T | null {
  try { return JSON.parse(readFileSync(join(process.cwd(), rel), "utf8")) as T; } catch { return null; }
}
function hechosCatalog(): { key: string; label: string; code: string }[] {
  const mined = readJson<{ periods: Record<string, { events?: TLEvent[] }> }>("src/data/timeline-events.json");
  const curated = readJson<{ periods: Record<string, TLEvent[]> }>("src/data/timeline-events-curated.json");
  const out: { key: string; label: string; code: string }[] = [];
  const periods = mined?.periods ?? {};
  for (const code of Object.keys(periods)) {
    const seen = new Set<string>();
    const events = [...(periods[code].events ?? []), ...((curated?.periods?.[code]) ?? [])];
    for (const e of events) {
      if (!e?.id || seen.has(e.id)) continue;
      seen.add(e.id);
      out.push({ key: hechoKey(code, e), label: e.titulo, code });
    }
  }
  return out;
}

// ── Catálogo de entidades: replica /api/entities (agregación de Question) ─────
type EType = "person" | "place" | "concept";
async function entidadesCatalog(): Promise<Record<EType, { key: string; label: string; mentions: number }[]>> {
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
  const out: Record<EType, { key: string; label: string; mentions: number }[]> = { person: [], place: [], concept: [] };
  for (const b of map.values()) {
    if (b.mentions < 2) continue;
    const name = bestName(b);
    out[b.type].push({ key: entidadKey(b.type, name), label: name, mentions: b.mentions });
  }
  for (const t of ["person", "place", "concept"] as EType[]) out[t].sort((a, b) => b.mentions - a.mentions);
  return out;
}

function summarize(label: string, catalog: { key: string; label: string }[], produced: Map<string, ProducedInfo>) {
  let portada = 0, fichaSinPortada = 0, sinFicha = 0;
  const missing: string[] = [], noPortada: string[] = [];
  for (const it of catalog) {
    const p = produced.get(it.key);
    if (!p) { sinFicha++; missing.push(it.label); continue; }
    if (p.hasImage) portada++; else { fichaSinPortada++; noPortada.push(it.label); }
  }
  console.log(`\n■ ${label} — catálogo: ${catalog.length}`);
  console.log(`   LISTO (ficha+portada):  ${portada}`);
  console.log(`   ficha SIN portada:      ${fichaSinPortada}`);
  console.log(`   SIN ficha (faltante):   ${sinFicha}`);
  console.log(`   → PENDIENTE total:      ${sinFicha + fichaSinPortada}`);
  if (missing.length) console.log(`     · sin ficha: ${missing.slice(0, 10).join(" · ")}${missing.length > 10 ? ` …(+${missing.length - 10})` : ""}`);
  if (noPortada.length) console.log(`     · sin portada: ${noPortada.slice(0, 10).join(" · ")}${noPortada.length > 10 ? ` …(+${noPortada.length - 10})` : ""}`);
  return { total: catalog.length, portada, fichaSinPortada, sinFicha };
}

async function main() {
  console.log(`▸ Diagnóstico de producción (read-only; nada se escribe)`);
  const [prodHecho, prodEnt, ents] = await Promise.all([
    producedFromDB("ficha-hecho"),
    producedFromDB("ficha-entidad"),
    entidadesCatalog(),
  ]);
  const hechos = hechosCatalog();
  const rH = summarize("HECHOS", hechos, prodHecho);

  const rE: Record<string, ReturnType<typeof summarize>> = {};
  for (const [type, label] of [["person", "PERSONAS"], ["place", "LUGARES"], ["concept", "CONCEPTOS"]] as const) {
    rE[type] = summarize(`${label} (top ${TOP_N} de ${ents[type].length})`, ents[type].slice(0, TOP_N), prodEnt);
  }

  const pend = rH.sinFicha + rH.fichaSinPortada + Object.values(rE).reduce((s, r) => s + r.sinFicha + r.fichaSinPortada, 0);
  console.log(`\n════════ TOTAL PENDIENTE (sin ficha + sin portada): ${pend} ════════`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error("✗", e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
