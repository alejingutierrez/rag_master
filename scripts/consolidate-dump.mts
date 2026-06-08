/**
 * READ-ONLY. Prepara la entrada del workflow de consolidación:
 *  - tmp/blocks/<PER>__<CAT>__sN.json  (preguntas-hija por shard)
 *  - tmp/blocks/manifest.json          (bloques período×categoría + objetivo K)
 *  - crea tmp/masters/ para las salidas
 * No escribe en la BD. No toca `questions`.
 *
 * Uso: npx tsx scripts/consolidate-dump.mts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/prisma";
import { mastersFor } from "../src/lib/master-consolidation";

const SHARD = 100; // máx preguntas por shard (un agente sintetiza por shard)
const ROOT = resolve("tmp");
const BLOCKS = resolve(ROOT, "blocks");
const MASTERS = resolve(ROOT, "masters");

const PERIODO_ORDEN: Record<string, number> = {
  PRE: 0, CON: 1, COL: 2, PRE_IND: 3, IND: 4, NGR: 5, EUC: 6, REG: 7,
  REP_LIB: 8, VIO: 9, FN: 10, CNA: 11, C91: 12, SDE: 13, POS: 14, TRANS: 15,
};

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function main() {
  rmSync(BLOCKS, { recursive: true, force: true });
  mkdirSync(BLOCKS, { recursive: true });
  mkdirSync(MASTERS, { recursive: true });

  const blocks = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "periodoCode" per, "categoriaCode" cat, count(*)::int n
     FROM questions GROUP BY 1,2 ORDER BY n DESC`
  );

  const manifest: any[] = [];
  for (const b of blocks) {
    const qs = await prisma.$queryRawUnsafe<any[]>(
      `SELECT q.id, q.pregunta, q."hipotesisImplicita" hip, q."tipoPregunta" tipo,
              q."subcategoriaNombre" subcat, d.filename libro
       FROM questions q JOIN documents d ON d.id = q."documentId"
       WHERE q."periodoCode" = $1 AND q."categoriaCode" = $2
       ORDER BY q."tipoPregunta", q.id`,
      b.per, b.cat
    );
    const shards = chunk(qs, SHARD);
    const shardPaths: string[] = [];
    shards.forEach((s, i) => {
      const p = resolve(BLOCKS, `${b.per}__${b.cat}__s${i}.json`);
      writeFileSync(p, JSON.stringify(s));
      shardPaths.push(p);
    });
    manifest.push({
      period: b.per,
      cat: b.cat,
      n: b.n,
      k: mastersFor(b.n, 1.15),
      periodoOrden: PERIODO_ORDEN[b.per] ?? 15,
      shards: shardPaths,
      outFile: resolve(MASTERS, `${b.per}__${b.cat}.json`),
    });
  }

  writeFileSync(resolve(BLOCKS, "manifest.json"), JSON.stringify(manifest, null, 2));
  const totalK = manifest.reduce((a, m) => a + m.k, 0);
  console.log(`Bloques: ${manifest.length} · preguntas: ${blocks.reduce((a, b) => a + b.n, 0)}`);
  console.log(`Shards totales: ${manifest.reduce((a, m) => a + m.shards.length, 0)}`);
  console.log(`Objetivo madres (dial medio): ${totalK}`);
  console.log(`Manifest: ${resolve(BLOCKS, "manifest.json")}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
