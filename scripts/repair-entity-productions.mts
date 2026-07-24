/**
 * Audita y retira de publicación/pendientes las fichas de entidad duplicadas o
 * que violaron su sourceRef. Es recuperable: no borra filas ni imágenes; cambia
 * el duplicado a ERROR y deja el diagnóstico + estado original en metadata.
 *
 *   npx tsx scripts/repair-entity-productions.mts          # dry-run
 *   npx tsx scripts/repair-entity-productions.mts --apply  # aplica en la BD
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { normalizeStructured, slugify } from "../src/lib/typology-schemas";
import { validateEntitySourceContract } from "../src/lib/entity-source-contract";
import type { SourceRef } from "../src/lib/source-ref";

const APPLY = process.argv.includes("--apply");

interface Row {
  id: string;
  status: string;
  publishedAt: Date | null;
  publishedBy: string | null;
  updatedAt: Date;
  structuredData: unknown;
  metadata: unknown;
}

interface RepairTarget {
  row: Row;
  reasons: string[];
  duplicateOf?: string;
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function sourceRefOf(row: Row): SourceRef | null {
  const raw = metadataRecord(row.metadata).sourceRef;
  if (!raw || typeof raw !== "object") return null;
  const ref = raw as Record<string, unknown>;
  return typeof ref.kind === "string" &&
    typeof ref.key === "string" &&
    typeof ref.label === "string"
    ? (ref as unknown as SourceRef)
    : null;
}

function bestFirst(a: Row, b: Row): number {
  if (Boolean(a.publishedAt) !== Boolean(b.publishedAt)) return a.publishedAt ? -1 : 1;
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

function addTarget(
  targets: Map<string, RepairTarget>,
  row: Row,
  reason: string,
  duplicateOf?: string,
): void {
  const target = targets.get(row.id) ?? { row, reasons: [] };
  if (!target.reasons.includes(reason)) target.reasons.push(reason);
  if (duplicateOf) target.duplicateOf = duplicateOf;
  targets.set(row.id, target);
}

async function main(): Promise<void> {
  const rows = (await prisma.deliverable.findMany({
    where: {
      templateId: "ficha-entidad",
      status: "COMPLETE",
    },
    select: {
      id: true,
      status: true,
      publishedAt: true,
      publishedBy: true,
      updatedAt: true,
      structuredData: true,
      metadata: true,
    },
  })) as Row[];

  const targets = new Map<string, RepairTarget>();
  const byStructuredIdentity = new Map<string, Row[]>();
  const bySource = new Map<string, Row[]>();

  for (const row of rows) {
    const structured = normalizeStructured(row.structuredData);
    if (!structured || structured.typology !== "entidad") continue;

    if (structured.tipo === "Persona") {
      const identityKey = `${structured.tipo}:${slugify(structured.titulo)}`;
      const sameIdentity = byStructuredIdentity.get(identityKey) ?? [];
      sameIdentity.push(row);
      byStructuredIdentity.set(identityKey, sameIdentity);
    }

    const sourceRef = sourceRefOf(row);
    if (sourceRef?.kind === "entidad") {
      if (structured.tipo === "Persona") {
        const sourceKey = `${sourceRef.kind}:${sourceRef.key}`;
        const sameSource = bySource.get(sourceKey) ?? [];
        sameSource.push(row);
        bySource.set(sourceKey, sameSource);
      }

      const contract = validateEntitySourceContract(sourceRef, structured);
      // Este cierre repara la familia de páginas denunciada: personas
      // duplicadas o nacidas por error desde un lugar/concepto. Otras
      // recategorizaciones históricas se auditan, pero no se retiran aquí.
      if (!contract.ok && structured.tipo === "Persona") {
        addTarget(targets, row, contract.error ?? "sourceRef inválido");
      }
    }
  }

  for (const [key, group] of byStructuredIdentity) {
    if (group.length < 2) continue;
    const [keeper, ...duplicates] = [...group].sort(bestFirst);
    for (const row of duplicates) {
      addTarget(targets, row, `identidad estructurada duplicada: ${key}`, keeper.id);
    }
  }

  for (const [key, group] of bySource) {
    if (group.length < 2) continue;
    const [keeper, ...duplicates] = [...group].sort(bestFirst);
    for (const row of duplicates) {
      addTarget(targets, row, `sourceRef duplicado: ${key}`, keeper.id);
    }
  }

  const plan = [...targets.values()].sort((a, b) => a.row.id.localeCompare(b.row.id));
  console.log(
    `${APPLY ? "APPLY" : "DRY-RUN"} · ${rows.length} fichas COMPLETE · ${plan.length} a retirar`,
  );
  for (const item of plan) {
    console.log(
      `- ${item.row.id} · ${item.row.publishedAt ? "PUBLICADA" : "PENDIENTE"}${
        item.duplicateOf ? ` · conserva ${item.duplicateOf}` : ""
      }\n  ${item.reasons.join(" | ")}`,
    );
  }

  if (!APPLY || plan.length === 0) return;

  await prisma.$transaction(
    plan.map((item) => {
      const metadata = metadataRecord(item.row.metadata);
      return prisma.deliverable.update({
        where: { id: item.row.id },
        data: {
          status: "ERROR",
          publishedAt: null,
          publishedBy: null,
          metadata: {
            ...metadata,
            entityRepair: {
              repairedAt: new Date().toISOString(),
              reasons: item.reasons,
              duplicateOf: item.duplicateOf,
              originalStatus: item.row.status,
              originalPublishedAt: item.row.publishedAt?.toISOString() ?? null,
              originalPublishedBy: item.row.publishedBy,
            },
          } as unknown as object,
        },
      });
    }),
  );
  console.log(`✓ ${plan.length} fichas retiradas sin borrar datos`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
