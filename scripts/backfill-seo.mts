/**
 * Backfill del SEO de las piezas YA PUBLICADAS.
 *
 * Corre `composeSeo` (Sonnet + respaldo determinista) sobre cada Deliverable
 * publicado y guarda el resultado en `metadata.seo` (merge no destructivo:
 * preserva atelier/image/sourceRef). Las piezas publicadas antes de la feature
 * usaban el fallback determinista al vuelo; esto les fija el SEO pulido y correcto.
 *
 * Uso:
 *   npx tsx scripts/backfill-seo.mts            # dry-run (muestra qué haría)
 *   npx tsx scripts/backfill-seo.mts --apply    # persiste en la BD (prod)
 *   npx tsx scripts/backfill-seo.mts --apply --force   # regenera incluso si ya tiene seo
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { composeSeo } from "../src/lib/atelier/seo-composer";
import { normalizeSeo } from "../src/lib/seo";
import type { DeliverableTaxonomy } from "../src/lib/taxonomy";
import type { StructuredData } from "../src/lib/typology-schemas";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");

async function main() {
  const rows = await prisma.deliverable.findMany({
    where: { status: "COMPLETE", source: "atelier", publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      answer: true,
      structuredData: true,
      metadata: true,
      userQuestion: true,
      question: { select: { pregunta: true, categoriaNombre: true } },
    },
  });

  console.log(`\nPiezas publicadas: ${rows.length}  ·  modo: ${APPLY ? "APPLY (escribe en prod)" : "DRY-RUN"}${FORCE ? " · FORCE" : ""}\n`);

  let done = 0;
  let skipped = 0;
  for (const d of rows) {
    const meta = (d.metadata ?? {}) as Record<string, unknown>;
    const existing = normalizeSeo(meta.seo);
    if (existing && !FORCE) {
      console.log(`— [skip] ${d.id} ya tiene metadata.seo (usa --force para regenerar)`);
      skipped++;
      continue;
    }

    const structured = (d.structuredData ?? null) as StructuredData | null;
    const titulo = structured?.titulo ?? d.question?.pregunta ?? d.userQuestion ?? "Producción";
    const resumen = structured?.resumen ?? d.question?.categoriaNombre ?? null;
    const taxonomy = (meta.atelier as { taxonomy?: DeliverableTaxonomy } | undefined)?.taxonomy;

    const seo = await composeSeo({
      titulo,
      resumen,
      answer: d.answer,
      typology: structured?.typology ?? null,
      taxonomy,
    });

    const path = structured
      ? `/${structured.typology === "hecho" ? "hechos" : structured.typology === "epoca" ? "epocas" : structured.typology === "entidad" ? "entidades" : "preguntas"}/${structured.slug}`
      : `/ensayos/${d.id}`;

    console.log(`● ${path}`);
    console.log(`    title (${seo.metaTitle.length}): ${seo.metaTitle}`);
    console.log(`    desc  (${seo.metaDescription.length}): ${seo.metaDescription}`);
    console.log(`    keys : ${seo.keywords.join(" · ")}`);

    if (APPLY) {
      await prisma.deliverable.update({
        where: { id: d.id },
        data: { metadata: { ...meta, seo } as unknown as object },
      });
      console.log(`    ✔ guardado en metadata.seo`);
    }
    done++;
  }

  console.log(`\nListo. Procesadas: ${done} · saltadas: ${skipped} · ${APPLY ? "cambios PERSISTIDOS" : "sin cambios (dry-run)"}\n`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("Backfill falló:", e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
