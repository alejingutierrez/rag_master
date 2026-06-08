/**
 * Salva a tmp/master-layer.json TODAS las madres ya generadas en disco:
 *  - bloques con outFile (merge+gate) → se usan tal cual
 *  - bloques con solo shard-masters → se concatenan (sin merge; aceptable para DRAFT)
 * No llama LLM. No escribe en BD. Imprime cobertura + conteo por período.
 *
 * Uso: npx tsx scripts/consolidate-salvage.mts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ORDER = ["PRE","CON","COL","PRE_IND","IND","NGR","EUC","REG","REP_LIB","VIO","FN","CNA","C91","SDE","POS","TRANS"];
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));

function main() {
  const manifest = read(resolve("tmp/blocks/manifest.json")) as any[];
  const layer: any[] = [];
  const missing: string[] = [];

  for (const b of manifest) {
    let masters: any[] | null = null;
    let gate: any[] = [];
    if (existsSync(b.outFile)) {
      masters = read(b.outFile);
      const gf = b.outFile.replace(/\.json$/, ".gate.json");
      if (existsSync(gf)) gate = read(gf);
    } else {
      const acc: any[] = [];
      for (const s of b.shards) {
        const mf = s.replace(/\.json$/, ".masters.json");
        if (existsSync(mf)) { try { acc.push(...read(mf)); } catch { /* skip */ } }
      }
      if (acc.length) masters = acc;
    }
    if (!masters || !masters.length) { missing.push(`${b.period}×${b.cat}`); continue; }
    // sanea: cada madre debe tener childIds[]
    masters = masters.filter((m) => m && m.pregunta && Array.isArray(m.childIds));
    layer.push({ period: b.period, cat: b.cat, n: b.n, k: b.k, periodoOrden: b.periodoOrden, masters, gate });
  }

  writeFileSync(resolve("tmp/master-layer.json"), JSON.stringify(layer, null, 1));

  const P: Record<string, number> = {};
  let total = 0, links = 0;
  for (const e of layer) {
    P[e.period] = (P[e.period] ?? 0) + e.masters.length;
    total += e.masters.length;
    links += e.masters.reduce((a: number, m: any) => a + m.childIds.length, 0);
  }
  console.log("Bloques salvados:", layer.length, "/", manifest.length, "· faltan:", missing.length);
  console.log("MADRES:", total, "· LINKS:", links);
  console.log("Por período:", ORDER.filter((p) => P[p]).map((p) => `${p}:${P[p]}`).join(" "));
  console.log("→ tmp/master-layer.json");
}
main();
