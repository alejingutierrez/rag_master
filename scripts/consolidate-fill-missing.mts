/**
 * Rellena los SHARDS pendientes (bloques sin outFile cuyo shard.masters.json no
 * existe) por el camino LOCAL robusto: synthesizeBlock() → converseJSON()
 * (Bedrock directo + parseo JSON + reintentos). Por shard (≤100 preguntas) para
 * no exceder tokens. Idempotente: omite shards ya hechos.
 *
 * Pensado para correr en FOREGROUND por lotes (FILL_LIMIT) — los procesos en
 * background se matan al cerrar el turno.
 *
 *   BEDROCK_SEMAPHORE_LIMIT=6 FILL_POOL=6 FILL_LIMIT=42 npx tsx scripts/consolidate-fill-missing.mts
 *
 * Repetir hasta "pendientes: 0". Luego: salvage + apply.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { synthesizeBlock, type ChildQuestion, type BlockSpec } from "../src/lib/master-consolidation";

const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(fn: () => Promise<T>, n = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < n; i++) {
    try { return await fn(); } catch (e) { last = e; await sleep(2500 * (i + 1)); }
  }
  throw last;
}

async function main() {
  const manifest = read(resolve("tmp/blocks/manifest.json")) as any[];
  const pending: Array<{ b: any; shard: string; mf: string; k: number }> = [];
  for (const b of manifest) {
    if (existsSync(b.outFile)) continue;
    const perShardK = Math.max(2, Math.ceil(b.k / b.shards.length));
    for (const s of b.shards) {
      const mf = s.replace(/\.json$/, ".masters.json");
      if (!existsSync(mf)) pending.push({ b, shard: s, mf, k: perShardK });
    }
  }
  const LIMIT = Number(process.env.FILL_LIMIT ?? "9999");
  const batch = pending.slice(0, LIMIT);
  console.log(`Shards pendientes: ${pending.length} · procesando este lote: ${batch.length}`);

  const POOL = Number(process.env.FILL_POOL ?? "5");
  let idx = 0, done = 0, fail = 0;
  async function worker() {
    while (idx < batch.length) {
      const { b, shard, mf, k } = batch[idx++];
      try {
        const qs: ChildQuestion[] = read(shard);
        const spec: BlockSpec = { period: b.period, cat: b.cat, n: qs.length, k };
        const res = await withRetry(() => synthesizeBlock(qs, spec));
        const masters = (res?.masters || []).filter((m: any) => m && m.pregunta && Array.isArray(m.childIds));
        writeFileSync(mf, JSON.stringify(masters));
        done++;
        console.log(`✓ ${b.period}×${b.cat} [${mf.split("/").pop()}]: ${masters.length} (${done + fail}/${batch.length})`);
      } catch (e) {
        fail++;
        console.warn(`✗ ${b.period}×${b.cat}: ${(e as Error).message.slice(0, 80)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: POOL }, worker));
  console.log(`Lote hecho: ${done} ok, ${fail} fallidos · pendientes restantes: ${pending.length - done}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
