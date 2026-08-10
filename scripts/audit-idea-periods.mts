/**
 * Auditoría read-only del universo público de ideas.
 *
 * Comprueba que toda idea publicada resuelva a una entidad canónica con época
 * principal válida y al menos una época secundaria sustentada. También detecta
 * fichas cuyo `sourceRef` contradice el tipo estructurado.
 *
 *   npm run audit:idea-periods
 */
import { config as dotenv } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
dotenv({ path: process.env.ENV_FILE || `${process.cwd()}/.env` });
dotenv({ path: `${process.cwd()}/../../../.env` });
import { prisma } from "../src/lib/prisma";
import { PERIOD_CODES } from "../src/lib/taxonomy";
import { slugify } from "../src/lib/typology-schemas";

type EntityType = "persona" | "lugar" | "idea";
type RegistryEntity = {
  type: EntityType;
  slug: string;
  name: string;
  variants: string[];
  periodoCode: string | null;
  periods: string[];
};

const ROOT = join(import.meta.dirname, "..");
const registryFile = JSON.parse(
  readFileSync(join(ROOT, "src/data/entities.json"), "utf8"),
) as { generatedAt: string; entities: RegistryEntity[] };
const overrides = JSON.parse(
  readFileSync(join(ROOT, "src/data/entity-overrides.json"), "utf8"),
) as Record<string, { hide?: boolean; _motivo?: string }>;

const registryIdeas = registryFile.entities.filter((entity) => entity.type === "idea");
const ideasBySlug = new Map(registryIdeas.map((entity) => [entity.slug, entity]));
const ideaAliases = new Map<string, string>();

for (const entity of registryIdeas) {
  for (const surface of [entity.slug, ...entity.variants.map((variant) => slugify(variant))]) {
    if (surface && !ideaAliases.has(surface)) ideaAliases.set(surface, entity.slug);
  }
}
for (const [key, override] of Object.entries(overrides)) {
  if (!key.startsWith("idea:") || override.hide !== true) continue;
  const targetName = override._motivo?.match(/^QA:\s*duplicado de\s+"([^"]+)"$/i)?.[1];
  if (!targetName) continue;
  const targetSlug = slugify(targetName);
  if (ideasBySlug.has(targetSlug)) ideaAliases.set(key.slice("idea:".length), targetSlug);
}

function structuredTypeFamily(tipo: unknown): EntityType | null {
  if (tipo === "Persona") return "persona";
  if (tipo === "Lugar") return "lugar";
  if (tipo === "Concepto" || tipo === "Institución") return "idea";
  return null;
}

function sourceTypeFamily(key: string): EntityType | null {
  const prefix = key.slice(0, key.indexOf(":"));
  if (prefix === "person") return "persona";
  if (prefix === "place") return "lugar";
  if (prefix === "concept") return "idea";
  return null;
}

async function main(): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; structuredData: unknown; sourceRef: unknown }>
  >`
    SELECT
      id,
      "structuredData",
      metadata -> 'sourceRef' AS "sourceRef"
    FROM deliverables
    WHERE status = 'COMPLETE'
      AND source IN ('atelier', 'master')
      AND "publishedAt" IS NOT NULL
  `;

  const publicIdeaSlugs = new Set<string>();
  const orphanIdeas: Array<{ id: string; slug: string; source: string }> = [];
  const typeDrifts: Array<{ id: string; sourceType: EntityType; structuredType: EntityType }> = [];

  for (const row of rows) {
    const structured = (row.structuredData ?? {}) as Record<string, unknown>;
    const sourceRef = (row.sourceRef ?? {}) as Record<string, unknown>;
    const refKey = typeof sourceRef.key === "string" ? sourceRef.key : "";
    const refKind = sourceRef.kind === "entidad";
    const sourceType = refKind && refKey.includes(":") ? sourceTypeFamily(refKey) : null;
    const structuredType =
      structured.typology === "entidad" ? structuredTypeFamily(structured.tipo) : null;

    if (sourceType && structuredType && sourceType !== structuredType) {
      typeDrifts.push({ id: row.id, sourceType, structuredType });
    }

    if (sourceType) {
      if (sourceType !== "idea") continue;
      const rawSlug = refKey.slice(refKey.indexOf(":") + 1);
      const canonicalSlug = ideaAliases.get(rawSlug) ?? rawSlug;
      if (ideasBySlug.has(canonicalSlug)) publicIdeaSlugs.add(canonicalSlug);
      else orphanIdeas.push({ id: row.id, slug: rawSlug, source: "sourceRef" });
      continue;
    }

    if (structured.typology !== "entidad" || structuredType !== "idea") continue;
    const rawSlug =
      typeof structured.slug === "string"
        ? structured.slug
        : slugify(typeof structured.titulo === "string" ? structured.titulo : "");
    const canonicalSlug = ideaAliases.get(rawSlug) ?? rawSlug;
    if (ideasBySlug.has(canonicalSlug)) publicIdeaSlugs.add(canonicalSlug);
    else orphanIdeas.push({ id: row.id, slug: rawSlug, source: "structuredData" });
  }

  const validPeriods = new Set(PERIOD_CODES.filter((code) => code !== "TRANS"));
  const publicIdeas = [...publicIdeaSlugs]
    .map((slug) => ideasBySlug.get(slug))
    .filter((entity): entity is RegistryEntity => Boolean(entity));
  const failures = publicIdeas.flatMap((entity) => {
    const reasons: string[] = [];
    if (!entity.periodoCode || !validPeriods.has(entity.periodoCode)) {
      reasons.push("época principal ausente o no cronológica");
    }
    if (!entity.periods.includes(entity.periodoCode ?? "")) {
      reasons.push("la principal no está incluida en periods");
    }
    if (new Set(entity.periods).size !== entity.periods.length) {
      reasons.push("épocas duplicadas");
    }
    if (entity.periods.some((period) => !validPeriods.has(period))) {
      reasons.push("código de época inválido");
    }
    if (entity.periods.filter((period) => period !== entity.periodoCode).length === 0) {
      reasons.push("sin época secundaria");
    }
    if (entity.periods.length > 6) reasons.push("más de seis épocas");
    return reasons.length ? [{ name: entity.name, slug: entity.slug, reasons }] : [];
  });

  const summary = {
    registryGeneratedAt: registryFile.generatedAt,
    publishedIdeas: publicIdeas.length,
    withPrimaryPeriod: publicIdeas.filter((idea) => Boolean(idea.periodoCode)).length,
    withSecondaryPeriods: publicIdeas.filter(
      (idea) => idea.periods.some((period) => period !== idea.periodoCode),
    ).length,
    orphanIdeas: orphanIdeas.length,
    sourceTypeDrifts: typeDrifts.length,
    failures: failures.length,
  };
  console.log(JSON.stringify({ summary, failures, orphanIdeas, typeDrifts }, null, 2));

  if (failures.length || orphanIdeas.length || typeDrifts.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
