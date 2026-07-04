/**
 * Registro CANÓNICO de entidades — derivado del corpus de preguntas.
 *
 * Escanea TODAS las preguntas (Question.entidadesPersonas/Lugares/Conceptos) y
 * construye, por entidad canónica (slug), su:
 *   - nombre canónico (variante más frecuente) + variantes (para el auto-enlace)
 *   - menciones (nº de preguntas)
 *   - ÉPOCA primaria (MODA de los períodos de sus preguntas, NO la unión ruidosa)
 *   - períodos denoised (los que concentran la entidad) + año representativo
 *
 * Las relaciones ("relacionadas") NO se guardan aquí: se computan en lectura
 * desde las piezas PUBLICADAS (co-ocurrencia acotada), coherente con el gate de
 * solo-publicado — así no hay enlaces a entidades sin página.
 *
 * Esto arregla el "backfill" de época (las personas no tenían época propia: se
 * unían TODOS los períodos donde se las mencionaba, ensuciando los filtros) y da
 * al sitio un diccionario estable para:
 *   1) auto-enlazar menciones en prosa (aunque la ficha no esté producida)
 *   2) filtrar por época con una época "hogar" por entidad
 *   3) evitar el escaneo de ~8 s por request (se lee de disco, cacheado)
 *
 * Curación "uno por uno": src/data/entity-overrides.json — un mapa
 * `"type:slug" -> { periodoCode?, anio?, hide? }` que PISA la derivación. Se
 * aplica al final; es el backfill revisable.
 *
 * Solo LEE de la BD. Artefacto versionado: src/data/entities.json
 *
 * Uso: npx tsx scripts/mine-entities.mts
 *   MIN_MENTIONS=2   umbral de menciones para entrar al registro (default 2)
 *   REPORT=1         solo imprime el resumen, no escribe el archivo
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/typology-schemas";
import { PERIOD_YEAR_BOUNDS, periodOrderOf } from "../src/lib/taxonomy";

type EntityType = "persona" | "lugar" | "idea";

const ROOT = join(import.meta.dirname, "..");
const OUTPUT_PATH = join(ROOT, "src", "data", "entities.json");
const OVERRIDES_PATH = join(ROOT, "src", "data", "entity-overrides.json");
const MIN_MENTIONS = parseInt(process.env.MIN_MENTIONS || "2", 10);
const REPORT_ONLY = process.env.REPORT === "1";

/** Cuántas variantes guardar por entidad (acota el tamaño del JSON). */
const MAX_VARIANTS = 8;

interface Accum {
  type: EntityType;
  slug: string;
  variants: Map<string, number>;
  questionIds: Set<string>;
  periodCounts: Map<string, number>;
  years: number[]; // yearPrincipal de las preguntas donde aparece
  yearsByPeriod: Map<string, number[]>;
}

export interface RegistryEntity {
  type: EntityType;
  slug: string;
  name: string;
  variants: string[];
  mentions: number;
  periodoCode: string | null;
  periods: string[];
  periodoOrden: number;
  anio: number | null;
}

interface Override {
  periodoCode?: string | null;
  anio?: number | null;
  hide?: boolean;
}

function periodStartYear(code: string | null): number | null {
  if (!code) return null;
  return PERIOD_YEAR_BOUNDS[code]?.start ?? null;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function bestVariant(variants: Map<string, number>): string {
  let best = "";
  let n = -1;
  for (const [v, c] of variants) if (c > n) { best = v; n = c; }
  return best;
}

function loadOverrides(): Record<string, Override> {
  if (!existsSync(OVERRIDES_PATH)) return {};
  try {
    const raw = JSON.parse(readFileSync(OVERRIDES_PATH, "utf8")) as Record<string, Override>;
    // Las claves _README / _* son documentación, no overrides.
    return Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith("_")));
  } catch (err) {
    console.warn(`  overrides ilegibles (${OVERRIDES_PATH}):`, (err as Error).message);
    return {};
  }
}

async function main() {
  const start = Date.now();
  console.log(`Minería de entidades · umbral ≥${MIN_MENTIONS} menciones`);

  const questions = await prisma.question.findMany({
    select: {
      id: true,
      entidadesPersonas: true,
      entidadesLugares: true,
      entidadesConceptos: true,
      periodoCode: true,
      yearPrincipal: true,
    },
  });
  console.log(`  ${questions.length} preguntas leídas`);

  const byKey = new Map<string, Accum>();
  const upsert = (type: EntityType, rawName: string): Accum | null => {
    const name = rawName.trim();
    if (!name) return null;
    const slug = slugify(name);
    if (!slug) return null;
    const key = `${type}:${slug}`;
    let a = byKey.get(key);
    if (!a) {
      a = {
        type, slug,
        variants: new Map(),
        questionIds: new Set(),
        periodCounts: new Map(),
        years: [],
        yearsByPeriod: new Map(),
      };
      byKey.set(key, a);
    }
    a.variants.set(name, (a.variants.get(name) ?? 0) + 1);
    return a;
  };

  for (const q of questions) {
    const seen = new Set<string>();
    for (const [type, list] of [
      ["persona", q.entidadesPersonas],
      ["lugar", q.entidadesLugares],
      ["idea", q.entidadesConceptos],
    ] as const) {
      for (const nm of list) {
        const a = upsert(type, nm);
        const key = a && `${a.type}:${a.slug}`;
        if (!a || !key || seen.has(key)) continue;
        seen.add(key);
        a.questionIds.add(q.id);
        if (q.periodoCode) {
          a.periodCounts.set(q.periodoCode, (a.periodCounts.get(q.periodoCode) ?? 0) + 1);
          if (q.yearPrincipal != null) {
            const arr = a.yearsByPeriod.get(q.periodoCode) ?? [];
            arr.push(q.yearPrincipal);
            a.yearsByPeriod.set(q.periodoCode, arr);
          }
        }
        if (q.yearPrincipal != null) a.years.push(q.yearPrincipal);
      }
    }
  }

  const overrides = loadOverrides();
  console.log(`  ${Object.keys(overrides).length} overrides de curación`);

  const entities: RegistryEntity[] = [];
  for (const a of byKey.values()) {
    const mentions = a.questionIds.size;
    if (mentions < MIN_MENTIONS) continue;
    const key = `${a.type}:${a.slug}`;
    const ov = overrides[key];
    if (ov?.hide) continue;

    // Época primaria = MODA de períodos (excluye TRANS si hay alternativa).
    let primary: string | null = null;
    let primaryN = -1;
    let transN = 0;
    for (const [code, n] of a.periodCounts) {
      if (code === "TRANS") { transN = n; continue; }
      if (n > primaryN) { primary = code; primaryN = n; }
    }
    if (!primary && transN > 0) primary = "TRANS";

    // Períodos denoised: relativo a la MODA (no al total). Así una persona
    // concentrada queda con 1 período; un lugar/idea transversal (p. ej. Bogotá,
    // presente en todas las épocas) conserva sus varios períodos y filtra en cada
    // uno — en vez de colapsar a la época más frecuente del corpus. Excluye TRANS
    // (no es un período cronológico ni chip del filtro). Top 6 por frecuencia.
    const modeCount = primary && primary !== "TRANS" ? (a.periodCounts.get(primary) ?? 0) : 0;
    const thresh = Math.max(2, Math.ceil(0.25 * modeCount));
    const periods = [...a.periodCounts.entries()]
      .filter(([code, n]) => code !== "TRANS" && (code === primary || n >= thresh))
      .sort((x, y) => y[1] - x[1])
      .slice(0, 6)
      .map(([code]) => code)
      .sort((x, y) => periodOrderOf(x) - periodOrderOf(y));

    // Año representativo: mediana de los años DENTRO de la época primaria (para
    // que año y época sean coherentes); si no hay, inicio del período.
    const anioDerived =
      median(a.yearsByPeriod.get(primary ?? "") ?? []) ??
      median(a.years) ??
      periodStartYear(primary);

    const periodoCode = ov?.periodoCode !== undefined ? ov.periodoCode : primary;
    const anio = ov?.anio !== undefined ? ov.anio : anioDerived;

    const variants = [...a.variants.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, MAX_VARIANTS)
      .map(([v]) => v);

    entities.push({
      type: a.type,
      slug: a.slug,
      name: bestVariant(a.variants),
      variants,
      mentions,
      periodoCode: periodoCode ?? null,
      periods: periodoCode && !periods.includes(periodoCode) ? [periodoCode, ...periods] : periods,
      periodoOrden: periodoCode ? periodOrderOf(periodoCode) : 99,
      anio: anio ?? null,
    });
  }

  entities.sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name, "es"));

  // ── Resumen ──
  const byType = { persona: 0, lugar: 0, idea: 0 } as Record<EntityType, number>;
  for (const e of entities) byType[e.type]++;
  console.log(
    `\n  Entidades ≥${MIN_MENTIONS} menciones: ${entities.length}` +
      `  (personas ${byType.persona} · lugares ${byType.lugar} · ideas ${byType.idea})`,
  );
  const noEpoca = entities.filter((e) => !e.periodoCode).length;
  console.log(`  Sin época derivada: ${noEpoca}`);
  console.log(`\n  Top 25 personas (mención · época · año):`);
  for (const e of entities.filter((e) => e.type === "persona").slice(0, 25)) {
    console.log(`    ${e.name} — ${e.mentions} · ${e.periodoCode ?? "—"} · ${e.anio ?? "—"}  [${e.periods.join(",")}]`);
  }

  if (REPORT_ONLY) {
    console.log(`\n(REPORT=1 — no se escribió el archivo)`);
    return;
  }

  const output = {
    generatedAt: new Date().toISOString(),
    minMentions: MIN_MENTIONS,
    count: entities.length,
    entities,
  };
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 1));
  console.log(`\n✓ ${OUTPUT_PATH} — ${entities.length} entidades · ${Math.round((Date.now() - start) / 1000)}s`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
