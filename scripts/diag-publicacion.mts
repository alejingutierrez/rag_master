/**
 * Diagnóstico read-only PREVIO a publicar: duplicados, SEO, portada, estado de
 * publicación. NO escribe nada.
 *
 *   node --import tsx scripts/diag-publicacion.mts
 */
import { config as dotenv } from "dotenv";
// .env: el del cwd; si corres desde un worktree, cae al del repo padre.
dotenv({ path: process.env.ENV_FILE || `${process.cwd()}/.env` });
dotenv({ path: `${process.cwd()}/../../../.env` });
import { prisma } from "../src/lib/prisma";

interface Row {
  id: string; key: string; label: string; templateId: string;
  hasImage: boolean; hasSeo: boolean; hasStructured: boolean;
  slug: string; published: boolean; updatedAt: Date; words: number;
}

function scoreRow(r: Row): number {
  // Mejor candidato: portada > structuredData > SEO > más palabras > más reciente
  return (r.hasImage ? 8 : 0) + (r.hasStructured ? 4 : 0) + (r.hasSeo ? 2 : 0) + (r.published ? 1 : 0);
}

async function main() {
  const dels = await prisma.deliverable.findMany({
    where: { status: "COMPLETE", templateId: { in: ["ficha-hecho", "ficha-entidad", "ficha-epoca", "ficha-pregunta"] } },
    select: { id: true, templateId: true, metadata: true, structuredData: true, imageUrl: true, imageKey: true, publishedAt: true, updatedAt: true, userQuestion: true },
    orderBy: { updatedAt: "desc" },
  });

  const rows: Row[] = [];
  for (const d of dels) {
    const meta = d.metadata as Record<string, any> | null;
    const sr = meta?.sourceRef;
    const sd = d.structuredData as Record<string, any> | null;
    rows.push({
      id: d.id,
      key: typeof sr?.key === "string" ? sr.key : `(sin-sourceRef):${d.id}`,
      label: (sr?.label as string) ?? sd?.titulo ?? (d.userQuestion ?? "").slice(0, 40),
      templateId: d.templateId,
      hasImage: Boolean(d.imageUrl || d.imageKey),
      hasSeo: Boolean(meta?.seo?.metaTitle || meta?.seo?.title),
      hasStructured: Boolean(sd?.typology && sd?.slug),
      slug: sd?.slug ?? "—",
      published: Boolean(d.publishedAt),
      updatedAt: d.updatedAt,
      words: meta?.atelier?.wordCount ?? 0,
    });
  }

  // Agrupar por key
  const byKey = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byKey.has(r.key)) byKey.set(r.key, []);
    byKey.get(r.key)!.push(r);
  }

  const dupGroups = [...byKey.entries()].filter(([, v]) => v.length > 1);
  const publishedCount = rows.filter((r) => r.published).length;
  const sinSeo = rows.filter((r) => !r.hasSeo);
  const sinStructured = rows.filter((r) => !r.hasStructured);
  const sinImg = rows.filter((r) => !r.hasImage);
  const sinSourceRef = rows.filter((r) => r.key.startsWith("(sin-sourceRef)"));

  console.log(`▸ FICHAS COMPLETE: ${rows.length} · llaves únicas: ${byKey.size}`);
  console.log(`   ya publicadas: ${publishedCount} · sin publicar: ${rows.length - publishedCount}`);
  console.log(`   sin SEO: ${sinSeo.length} · sin structuredData: ${sinStructured.length} · sin portada: ${sinImg.length} · sin sourceRef: ${sinSourceRef.length}`);

  console.log(`\n▸ DUPLICADOS (misma llave, >1 ficha): ${dupGroups.length} grupos`);
  for (const [key, group] of dupGroups) {
    const sorted = [...group].sort((a, b) => scoreRow(b) - scoreRow(a) || b.updatedAt.getTime() - a.updatedAt.getTime());
    console.log(`  ${key}  (${group.length})`);
    sorted.forEach((r, i) => {
      console.log(`    ${i === 0 ? "→ MANTENER" : "  descartar"} ${r.id.slice(0, 8)} img=${r.hasImage ? "✓" : "—"} sd=${r.hasStructured ? "✓" : "—"} seo=${r.hasSeo ? "✓" : "—"} pub=${r.published ? "✓" : "—"} ${r.words}p slug=${r.slug}`);
    });
  }

  // Colisión de slug dentro de la misma tipología (aun con llaves distintas)
  const slugMap = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.hasStructured) continue;
    const sd = `${r.templateId}:${r.slug}`;
    if (!slugMap.has(sd)) slugMap.set(sd, []);
    slugMap.get(sd)!.push(r);
  }
  const slugClashes = [...slugMap.entries()].filter(([, v]) => v.length > 1);
  console.log(`\n▸ COLISIONES DE SLUG (misma tipología): ${slugClashes.length}`);
  for (const [sd, v] of slugClashes.slice(0, 15)) console.log(`  ${sd} × ${v.length} → ${v.map((r) => r.id.slice(0, 8)).join(", ")}`);

  if (sinSeo.length) {
    console.log(`\n▸ SIN SEO (primeras 15):`);
    for (const r of sinSeo.slice(0, 15)) console.log(`  ${r.id.slice(0, 8)} · ${r.label.slice(0, 40)}`);
  }
  if (sinStructured.length) {
    console.log(`\n▸ SIN structuredData (no publicables como ficha; primeras 15):`);
    for (const r of sinStructured.slice(0, 15)) console.log(`  ${r.id.slice(0, 8)} · ${r.label.slice(0, 40)}`);
  }

  // Plan: 1 por llave, publicable (structured + portada)
  const toPublish = [...byKey.values()].map((g) => [...g].sort((a, b) => scoreRow(b) - scoreRow(a) || b.updatedAt.getTime() - a.updatedAt.getTime())[0])
    .filter((r) => r.hasStructured && !r.published);
  const blocked = [...byKey.values()].map((g) => [...g].sort((a, b) => scoreRow(b) - scoreRow(a))[0]).filter((r) => !r.hasStructured);
  console.log(`\n════ PLAN: publicar ${toPublish.length} (1 por llave, con structuredData) · bloqueadas sin structuredData: ${blocked.length} ════`);

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error("✗", e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
