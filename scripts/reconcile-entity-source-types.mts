/**
 * Reconciliación recuperable de fichas antiguas cuyo `sourceRef` y tipo
 * estructurado no coinciden. El registro canónico decide cuál lado estaba mal:
 *
 * - si solo existe la entidad del tipo estructurado, corrige `sourceRef`;
 * - si solo existe la entidad del tipo de origen, corrige `structuredData`;
 * - si ambos/neither existen, no asume y lo deja para revisión manual.
 *
 * No borra ni despublica filas.
 *
 *   npx tsx scripts/reconcile-entity-source-types.mts
 *   npx tsx scripts/reconcile-entity-source-types.mts --apply
 */
import { config as dotenv } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
dotenv({ path: process.env.ENV_FILE || `${process.cwd()}/.env` });
dotenv({ path: `${process.cwd()}/../../../.env` });
import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/typology-schemas";

type EntityType = "persona" | "lugar" | "idea";
type RegistryEntity = { type: EntityType; slug: string; name: string };
type Repair =
  | { id: string; kind: "sourceRef"; from: string; to: string; metadata: Record<string, unknown> }
  | { id: string; kind: "structuredData"; from: string; to: string; structuredData: Record<string, unknown> };

const APPLY = process.argv.includes("--apply");
const ROOT = join(import.meta.dirname, "..");
const registry = JSON.parse(
  readFileSync(join(ROOT, "src/data/entities.json"), "utf8"),
) as { entities: RegistryEntity[] };
const byKey = new Map(registry.entities.map((entity) => [`${entity.type}:${entity.slug}`, entity]));

function typeFromStructured(tipo: unknown): EntityType | null {
  if (tipo === "Persona") return "persona";
  if (tipo === "Lugar") return "lugar";
  if (tipo === "Concepto" || tipo === "Institución") return "idea";
  return null;
}

function typeFromSource(prefix: string): EntityType | null {
  if (prefix === "person") return "persona";
  if (prefix === "place") return "lugar";
  if (prefix === "concept") return "idea";
  return null;
}

function sourcePrefix(type: EntityType): string {
  return type === "persona" ? "person" : type === "lugar" ? "place" : "concept";
}

function structuredLabel(type: EntityType, previous: unknown): string {
  if (type === "persona") return "Persona";
  if (type === "lugar") return "Lugar";
  return previous === "Institución" ? "Institución" : "Concepto";
}

async function main(): Promise<void> {
  const rows = await prisma.deliverable.findMany({
    where: {
      templateId: "ficha-entidad",
      status: "COMPLETE",
      publishedAt: { not: null },
    },
    select: { id: true, structuredData: true, metadata: true },
  });

  const repairs: Repair[] = [];
  const manual: Array<{ id: string; sourceRef: string; structuredType: EntityType }> = [];

  for (const row of rows) {
    const structured = (row.structuredData ?? {}) as Record<string, unknown>;
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const sourceRef = (metadata.sourceRef ?? {}) as Record<string, unknown>;
    if (structured.typology !== "entidad" || sourceRef.kind !== "entidad") continue;
    const refKey = typeof sourceRef.key === "string" ? sourceRef.key : "";
    const colon = refKey.indexOf(":");
    if (colon < 1) continue;
    const sourceType = typeFromSource(refKey.slice(0, colon));
    const structuredType = typeFromStructured(structured.tipo);
    if (!sourceType || !structuredType || sourceType === structuredType) continue;

    const sourceSlug = refKey.slice(colon + 1);
    const structuredSlug =
      typeof structured.slug === "string"
        ? structured.slug
        : slugify(typeof structured.titulo === "string" ? structured.titulo : "");
    const sourceEntity = byKey.get(`${sourceType}:${sourceSlug}`);
    const structuredEntity =
      byKey.get(`${structuredType}:${sourceSlug}`) ??
      byKey.get(`${structuredType}:${structuredSlug}`);

    if (structuredEntity && !sourceEntity) {
      const nextKey = `${sourcePrefix(structuredType)}:${structuredEntity.slug}`;
      repairs.push({
        id: row.id,
        kind: "sourceRef",
        from: refKey,
        to: nextKey,
        metadata: {
          ...metadata,
          sourceRef: { ...sourceRef, key: nextKey, label: structuredEntity.name },
        },
      });
    } else if (sourceEntity && !structuredEntity) {
      repairs.push({
        id: row.id,
        kind: "structuredData",
        from: `${String(structured.tipo)}:${structuredSlug}`,
        to: `${structuredLabel(sourceType, structured.tipo)}:${sourceEntity.slug}`,
        structuredData: {
          ...structured,
          tipo: structuredLabel(sourceType, structured.tipo),
          slug: sourceEntity.slug,
        },
      });
    } else {
      manual.push({ id: row.id, sourceRef: refKey, structuredType });
    }
  }

  console.log(
    `${APPLY ? "APPLY" : "DRY-RUN"} · ${rows.length} fichas publicadas · ` +
      `${repairs.length} reparaciones seguras · ${manual.length} manuales`,
  );
  for (const repair of repairs) {
    console.log(`- ${repair.id} · ${repair.kind}: ${repair.from} → ${repair.to}`);
  }
  for (const item of manual) {
    console.log(`- MANUAL ${item.id} · ${item.sourceRef} vs ${item.structuredType}`);
  }

  if (!APPLY || repairs.length === 0) return;
  await prisma.$transaction(
    repairs.map((repair) =>
      prisma.deliverable.update({
        where: { id: repair.id },
        data:
          repair.kind === "sourceRef"
            ? { metadata: repair.metadata as object }
            : { structuredData: repair.structuredData as object },
      }),
    ),
  );
  console.log(`✓ ${repairs.length} fichas reconciliadas sin borrar ni despublicar datos`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
