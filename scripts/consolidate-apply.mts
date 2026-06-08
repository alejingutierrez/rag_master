/**
 * Carga la capa-madre generada (tmp/master-layer.json) a la BD como DRAFT.
 *
 * ⚠️  ESCRIBE EN LA BASE DE DATOS (RDS de producción es solo-lectura por defecto).
 *     Por seguridad NO escribe nada salvo que se pase explícitamente:
 *
 *        CONSOLIDATE_APPLY=I_APPROVE npx tsx scripts/consolidate-apply.mts
 *
 *     Sin esa variable hace un DRY-RUN: imprime exactamente qué insertaría y sale.
 *     Requiere que las tablas existan (migración aplicada en deploy).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/prisma";
import { persistMaster, type MasterDraft, type GateResult, type BlockSpec } from "../src/lib/master-consolidation";

const APPROVED = process.env.CONSOLIDATE_APPLY === "I_APPROVE";
const LAYER = resolve("tmp/master-layer.json");

async function main() {
  const layer = JSON.parse(readFileSync(LAYER, "utf8")) as Array<{
    period: string; cat: string; n: number; k: number; periodoOrden: number;
    masters: MasterDraft[]; gate: (GateResult & { i: number })[];
  }>;

  const totalMasters = layer.reduce((a, b) => a + b.masters.length, 0);
  const totalLinks = layer.reduce((a, b) => a + b.masters.reduce((x, m) => x + m.childIds.length, 0), 0);

  console.log(`Capa: ${layer.length} bloques · ${totalMasters} madres · ${totalLinks} links (m:n)`);

  if (!APPROVED) {
    console.log("\n⚠️  DRY-RUN (no se escribe nada). Para aplicar a la BD:");
    console.log("    CONSOLIDATE_APPLY=I_APPROVE npx tsx scripts/consolidate-apply.mts\n");
    // muestra una muestra
    for (const b of layer.slice(0, 2)) {
      console.log(`  ${b.period}×${b.cat}: ${b.masters.length} madres`);
      b.masters.slice(0, 2).forEach((m) => console.log(`    - ${m.pregunta}`));
    }
    await prisma.$disconnect();
    return;
  }

  const runId = `run_${layer.length}_${totalMasters}`;
  let written = 0;
  for (const b of layer) {
    const spec: BlockSpec = { period: b.period, cat: b.cat, n: b.n, k: b.k };
    const childMeta = new Map<string, { libro?: string | null }>();
    const gByI = new Map(b.gate.map((g) => [g.i, g]));
    const skipEmbedding = process.env.SKIP_EMBED === "1";
    for (let i = 0; i < b.masters.length; i++) {
      await persistMaster(b.masters[i], gByI.get(i), spec, b.periodoOrden, runId, childMeta, { skipEmbedding });
      written++;
    }
    console.log(`  ${b.period}×${b.cat}: +${b.masters.length} (${written}/${totalMasters})`);
  }
  console.log(`\n✓ Escritas ${written} madres DRAFT. Curar en UI antes de cambiar el default de navegación.`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
