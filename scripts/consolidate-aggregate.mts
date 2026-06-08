/**
 * READ-ONLY (disco). Ensambla las salidas del workflow en tmp/master-layer.json
 * y reporta por período: madres generadas, compuerta (PASA/BORDERLINE/PARAGUAS),
 * cobertura de bloques, y conteo vs el tope ≤300/período.
 *
 * Uso: npx tsx scripts/consolidate-aggregate.mts
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BLOCKS = resolve("tmp/blocks");
const ORDER = ["PRE","CON","COL","PRE_IND","IND","NGR","EUC","REG","REP_LIB","VIO","FN","CNA","C91","SDE","POS","TRANS"];
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));

function main() {
  const manifest = read(resolve(BLOCKS, "manifest.json")) as any[];
  const layer: any[] = [];
  const missing: string[] = [];

  for (const b of manifest) {
    if (!existsSync(b.outFile)) { missing.push(`${b.period}×${b.cat}`); continue; }
    const masters = read(b.outFile);
    const gateFile = b.outFile.replace(/\.json$/, ".gate.json");
    const gate = existsSync(gateFile) ? read(gateFile) : [];
    layer.push({ period: b.period, cat: b.cat, n: b.n, k: b.k, periodoOrden: b.periodoOrden, masters, gate });
  }

  writeFileSync(resolve("tmp/master-layer.json"), JSON.stringify(layer, null, 1));

  // Rollup por período
  const P: Record<string, any> = {};
  for (const e of layer) {
    const p = (P[e.period] ??= { preg: 0, madres: 0, pass: 0, border: 0, paraguas: 0 });
    p.preg += e.n;
    p.madres += e.masters.length;
    for (const g of e.gate) {
      if (g.veredicto === "PASA") p.pass++;
      else if (g.veredicto === "BORDERLINE") p.border++;
      else if (g.veredicto === "PARAGUAS") p.paraguas++;
    }
  }
  const rows = ORDER.filter((p) => P[p]).map((p) => ({
    período: p, preg: P[p].preg, madres: P[p].madres,
    "≤300": P[p].madres <= 300 ? "✓" : "✗",
    PASA: P[p].pass, BORDER: P[p].border, PARAGUAS: P[p].paraguas,
  }));
  console.table(rows);
  const sum = (k: string) => rows.reduce((a, r: any) => a + (typeof r[k] === "number" ? r[k] : 0), 0);
  console.log(`\nTOTAL: ${sum("madres")} madres · PASA ${sum("PASA")} · BORDERLINE ${sum("BORDER")} · PARAGUAS ${sum("PARAGUAS")}`);
  console.log(`Cobertura: ${layer.length}/${manifest.length} bloques${missing.length ? ` · faltan: ${missing.join(", ")}` : " (completa)"}`);
  console.log(`Capa escrita: tmp/master-layer.json`);
  console.log(`Cargar a BD (requiere aprobación): CONSOLIDATE_APPLY=I_APPROVE npx tsx scripts/consolidate-apply.mts`);
}
main();
