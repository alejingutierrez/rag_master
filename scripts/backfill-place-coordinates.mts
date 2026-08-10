/**
 * Backfill curado de coordenadas para fichas públicas de Lugar.
 *
 * Por defecto es de solo lectura. Para aplicar el registro revisado:
 *   APPLY=1 CONFIRM_PLACE_COORDINATES=84 npx tsx scripts/backfill-place-coordinates.mts
 *
 * El script aborta si aparece un Lugar sin coordenadas que no esté en el
 * registro curado. Así un nuevo lote nunca se completa silenciosamente con un
 * punto inventado o sin procedencia.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import registryFile from "../src/data/place-coordinate-backfill.json";

type CoordinateKind =
  | "exact"
  | "locality"
  | "centroid"
  | "representative"
  | "historical-capital";

interface CoordinateEntry {
  lat: number;
  lng: number;
  kind: CoordinateKind;
  place?: string;
  sourceUrl: string;
  note?: string;
}

interface PlaceRow {
  id: string;
  slug: string;
  title: string;
  lat: number | null;
  lng: number | null;
}

const APPLY = process.env.APPLY === "1";
const FORCE = process.env.FORCE === "1";
const entries = registryFile.coordinates as Record<string, CoordinateEntry>;
const expectedConfirmation = String(Object.keys(entries).length);

function validPair(lat: number | null, lng: number | null): boolean {
  return lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function validateRegistry(): void {
  const invalid: string[] = [];
  for (const [slug, entry] of Object.entries(entries)) {
    if (!slug || !validPair(entry.lat, entry.lng)) invalid.push(`${slug}: coordenada inválida`);
    if (!entry.sourceUrl.startsWith("https://")) invalid.push(`${slug}: fuente inválida`);
    if (
      !["exact", "locality", "centroid", "representative", "historical-capital"].includes(
        entry.kind,
      )
    ) {
      invalid.push(`${slug}: convención inválida`);
    }
  }
  if (invalid.length) throw new Error(`Registro geográfico inválido:\n${invalid.join("\n")}`);
}

async function main(): Promise<void> {
  validateRegistry();
  const places = await prisma.$queryRaw<PlaceRow[]>`
    SELECT
      id,
      "structuredData" ->> 'slug' AS slug,
      "structuredData" ->> 'titulo' AS title,
      CASE WHEN jsonb_typeof("structuredData" -> 'lat') = 'number'
        THEN ("structuredData" ->> 'lat')::float8 ELSE NULL END AS lat,
      CASE WHEN jsonb_typeof("structuredData" -> 'lng') = 'number'
        THEN ("structuredData" ->> 'lng')::float8 ELSE NULL END AS lng
    FROM deliverables
    WHERE status = 'COMPLETE'
      AND "publishedAt" IS NOT NULL
      AND "templateId" = 'ficha-entidad'
      AND "structuredData" ->> 'typology' = 'entidad'
      AND "structuredData" ->> 'tipo' = 'Lugar'
  `;

  const bySlug = new Map<string, PlaceRow>();
  const duplicateSlugs: string[] = [];
  for (const row of places) {
    if (bySlug.has(row.slug)) duplicateSlugs.push(row.slug);
    bySlug.set(row.slug, row);
  }
  if (duplicateSlugs.length) {
    throw new Error(`Slugs de Lugar duplicados: ${[...new Set(duplicateSlugs)].join(", ")}`);
  }

  const missing = places.filter((row) => !validPair(row.lat, row.lng));
  const uncovered = missing.map((row) => row.slug).filter((slug) => !entries[slug]);
  const orphanEntries = Object.keys(entries).filter((slug) => !bySlug.has(slug));
  if (uncovered.length || orphanEntries.length) {
    throw new Error(
      [
        uncovered.length ? `Lugares sin punto curado: ${uncovered.join(", ")}` : "",
        orphanEntries.length ? `Entradas sin ficha publicada: ${orphanEntries.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const planned = places.filter((row) => {
    const entry = entries[row.slug];
    if (!entry) return false;
    return FORCE || !validPair(row.lat, row.lng);
  });

  console.log(
    JSON.stringify(
      {
        registryVersion: registryFile.version,
        publishedPlaceSheets: places.length,
        validBefore: places.length - missing.length,
        invalidOrMissingBefore: missing.length,
        curatedEntries: Object.keys(entries).length,
        plannedWrites: planned.length,
        apply: APPLY,
        force: FORCE,
      },
      null,
      2,
    ),
  );

  if (!APPLY) {
    console.log("Solo lectura. Usa APPLY=1 y la confirmación exacta para escribir.");
    return;
  }
  if (process.env.CONFIRM_PLACE_COORDINATES !== expectedConfirmation) {
    throw new Error(
      `Confirmación ausente: usa CONFIRM_PLACE_COORDINATES=${expectedConfirmation}`,
    );
  }

  const appliedAt = new Date().toISOString();
  await prisma.$transaction(
    async (tx) => {
      for (const row of planned) {
        const entry = entries[row.slug];
        const audit = JSON.stringify({
          version: registryFile.version,
          kind: entry.kind,
          sourceUrl: entry.sourceUrl,
          note: entry.note ?? null,
          appliedAt,
        });
        await tx.$executeRawUnsafe(
          `UPDATE deliverables
           SET "structuredData" = jsonb_set(
                 jsonb_set(
                   jsonb_set("structuredData", '{lugarPrincipal}', $2::jsonb, true),
                   '{lat}', $3::jsonb, true
                 ),
                 '{lng}', $4::jsonb, true
               ),
               metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{coordinateAudit}', $5::jsonb, true),
               "updatedAt" = NOW()
           WHERE id = $1`,
          row.id,
          JSON.stringify(entry.place ?? row.title),
          JSON.stringify(entry.lat),
          JSON.stringify(entry.lng),
          audit,
        );
      }
    },
    { timeout: 120_000 },
  );
  console.log(`✓ ${planned.length} fichas actualizadas con procedencia editorial.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
