/**
 * Auditor estricto del contrato geográfico de `/lugares`.
 *
 * Sin BASE_URL valida la base persistida. Con BASE_URL añade el directorio y,
 * con CHECK_ROUTES=1, recorre todas las páginas públicas canónicas.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

interface PlaceRow {
  id: string;
  slug: string;
  title: string;
  type: string;
  sourceRefKey: string | null;
  lat: number | null;
  lng: number | null;
}

const BASE_URL = process.env.BASE_URL?.replace(/\/$/, "") ?? null;
const CHECK_ROUTES = process.env.CHECK_ROUTES === "1";

function validPair(lat: number | null, lng: number | null): boolean {
  return lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function canonicalSlug(row: PlaceRow): string {
  return row.sourceRefKey?.startsWith("place:")
    ? row.sourceRefKey.slice("place:".length)
    : row.slug;
}

async function mapLimit<T, R>(
  values: T[],
  limit: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (next < values.length) {
        const index = next++;
        out[index] = await fn(values[index]);
      }
    }),
  );
  return out;
}

async function main(): Promise<void> {
  const places = await prisma.$queryRaw<PlaceRow[]>`
    SELECT
      id,
      "structuredData" ->> 'slug' AS slug,
      "structuredData" ->> 'titulo' AS title,
      "structuredData" ->> 'tipo' AS type,
      metadata -> 'sourceRef' ->> 'key' AS "sourceRefKey",
      CASE WHEN jsonb_typeof("structuredData" -> 'lat') = 'number'
        THEN ("structuredData" ->> 'lat')::float8 ELSE NULL END AS lat,
      CASE WHEN jsonb_typeof("structuredData" -> 'lng') = 'number'
        THEN ("structuredData" ->> 'lng')::float8 ELSE NULL END AS lng
    FROM deliverables
    WHERE status = 'COMPLETE'
      AND "publishedAt" IS NOT NULL
      AND "templateId" = 'ficha-entidad'
      AND "structuredData" ->> 'typology' = 'entidad'
      AND (
        "structuredData" ->> 'tipo' = 'Lugar'
        OR metadata -> 'sourceRef' ->> 'key' LIKE 'place:%'
      )
  `;

  const invalid: string[] = [];
  const partial: string[] = [];
  const structuredSlugs = new Set<string>();
  const canonicalSlugs = new Set<string>();
  const duplicateStructured: string[] = [];
  const duplicateCanonical: string[] = [];
  for (const row of places) {
    const slug = row.slug;
    const canonical = canonicalSlug(row);
    const lat = row.lat;
    const lng = row.lng;
    if ((lat == null) !== (lng == null)) partial.push(slug);
    if (!validPair(lat, lng)) invalid.push(slug);
    if (structuredSlugs.has(slug)) duplicateStructured.push(slug);
    if (canonicalSlugs.has(canonical)) duplicateCanonical.push(canonical);
    structuredSlugs.add(slug);
    canonicalSlugs.add(canonical);
  }

  const result: Record<string, unknown> = {
    publishedPlaceSheets: places.length,
    validCoordinatePairs: places.length - invalid.length,
    invalidOrMissing: invalid.length,
    partialPairs: partial.length,
    uniqueStructuredSlugs: structuredSlugs.size,
    uniqueCanonicalSlugs: canonicalSlugs.size,
  };
  const failures: string[] = [];
  if (invalid.length) failures.push(`Pares inválidos o ausentes: ${invalid.join(", ")}`);
  if (partial.length) failures.push(`Pares parciales: ${partial.join(", ")}`);
  if (duplicateStructured.length) {
    failures.push(`Slugs estructurados duplicados: ${duplicateStructured.join(", ")}`);
  }
  if (duplicateCanonical.length) {
    failures.push(`Slugs canónicos duplicados: ${duplicateCanonical.join(", ")}`);
  }

  if (BASE_URL) {
    const [response, sitemapResponse] = await Promise.all([
      fetch(`${BASE_URL}/lugares`),
      fetch(`${BASE_URL}/sitemap.xml`),
    ]);
    const html = await response.text();
    const sitemap = await sitemapResponse.text();
    const publicSlugs = [
      ...new Set([...html.matchAll(/href="\/lugares\/([^"?#]+)"/g)].map((match) => match[1])),
    ].sort();
    const sitemapSlugs = [
      ...new Set(
        [...sitemap.matchAll(/<loc>[^<]*\/lugares\/([^<]+)<\/loc>/g)].map((match) =>
          decodeURIComponent(match[1]),
        ),
      ),
    ].sort();
    const publicSlugSet = new Set(publicSlugs);
    const sitemapSlugSet = new Set(sitemapSlugs);
    const extraSitemapSlugs = sitemapSlugs.filter((slug) => !publicSlugSet.has(slug));
    const missingSitemapSlugs = publicSlugs.filter((slug) => !sitemapSlugSet.has(slug));
    const withCoordinates = Number(
      html.match(/([0-9]+)<!-- --> con coordenadas/)?.[1] ?? Number.NaN,
    );
    const withoutCoordinates = Number(
      html.match(/([0-9]+)<!-- --> sin coordenadas/)?.[1] ?? Number.NaN,
    );
    Object.assign(result, {
      directoryStatus: response.status,
      publicRoutes: publicSlugs.length,
      directoryWithCoordinates: withCoordinates,
      directoryWithoutCoordinates: withoutCoordinates,
      sitemapStatus: sitemapResponse.status,
      sitemapPlaceRoutes: sitemapSlugs.length,
      extraSitemapSlugs,
      missingSitemapSlugs,
    });
    if (!response.ok) failures.push(`/lugares respondió ${response.status}`);
    if (!sitemapResponse.ok) failures.push(`/sitemap.xml respondió ${sitemapResponse.status}`);
    if (withoutCoordinates !== 0) failures.push(`El directorio declara ${withoutCoordinates} sin coordenadas`);
    if (withCoordinates !== publicSlugs.length) {
      failures.push(`El directorio declara ${withCoordinates}/${publicSlugs.length} con coordenadas`);
    }
    if (publicSlugs.length !== canonicalSlugs.size) {
      failures.push(`Rutas públicas ${publicSlugs.length} != slugs canónicos ${canonicalSlugs.size}`);
    }
    if (extraSitemapSlugs.length) {
      failures.push(`Aliases obsoletos en sitemap: ${extraSitemapSlugs.join(", ")}`);
    }
    if (missingSitemapSlugs.length) {
      failures.push(`Rutas canónicas ausentes del sitemap: ${missingSitemapSlugs.join(", ")}`);
    }
    if (CHECK_ROUTES) {
      const statuses = await mapLimit(publicSlugs, 10, async (slug) => {
        const page = await fetch(`${BASE_URL}/lugares/${slug}`, { redirect: "manual" });
        return { slug, status: page.status };
      });
      const broken = statuses.filter(({ status }) => status !== 200);
      result.checkedRoutes = statuses.length;
      result.brokenRoutes = broken;
      if (broken.length) failures.push(`Rutas no-200: ${JSON.stringify(broken)}`);
    }
  }

  console.log(JSON.stringify(result, null, 2));
  if (failures.length) throw new Error(failures.join("\n"));
  console.log("✓ Contrato geográfico de Lugares completo y consistente.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
