/**
 * Publica fichas curadas vía la ruta sancionada PATCH /api/deliverables/{id}
 * (que garantiza slug único por tipología y registra publishedBy).
 *
 * SEGURIDAD ANTI-DUPLICADOS: agrupa por `metadata.sourceRef.key` y publica UNA
 * sola ficha por llave (la mejor: portada > structuredData > SEO > más reciente).
 * Los duplicados NUNCA se publican. Tampoco las que no tienen structuredData
 * (no renderizan como ficha) ni las que no tienen portada.
 *
 *   DRY=1 node --import tsx scripts/publicar-fichas.mts   # previsualiza
 *   node --import tsx scripts/publicar-fichas.mts         # publica
 */
import { config as dotenv } from "dotenv";
// .env: el del cwd; si corres desde un worktree, cae al del repo padre.
dotenv({ path: process.env.ENV_FILE || `${process.cwd()}/.env` });
dotenv({ path: `${process.cwd()}/../../../.env` });
import { prisma } from "../src/lib/prisma";
import { signSession, adminEmail, SESSION_COOKIE } from "../src/lib/auth";

const BASE = process.env.SITE_URL || "https://historiacolombiana.com";
const DRY = process.env.DRY === "1";
const CONC = Number(process.env.CONC ?? "4");

interface Row {
  id: string; key: string; label: string; templateId: string;
  hasImage: boolean; hasSeo: boolean; hasStructured: boolean;
  slug: string; published: boolean; updatedAt: Date; words: number;
}
const score = (r: Row) => (r.hasImage ? 8 : 0) + (r.hasStructured ? 4 : 0) + (r.hasSeo ? 2 : 0) + (r.published ? 1 : 0);

async function main() {
  const cookie = `${SESSION_COOKIE}=${await signSession({ sub: adminEmail(), role: "admin" })}`;

  const dels = await prisma.deliverable.findMany({
    where: { status: "COMPLETE", templateId: { in: ["ficha-hecho", "ficha-entidad", "ficha-epoca", "ficha-pregunta"] } },
    select: { id: true, templateId: true, metadata: true, structuredData: true, imageUrl: true, imageKey: true, publishedAt: true, updatedAt: true, userQuestion: true },
  });

  const rows: Row[] = dels.map((d) => {
    const meta = d.metadata as Record<string, any> | null;
    const sd = d.structuredData as Record<string, any> | null;
    const sr = meta?.sourceRef;
    return {
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
    };
  });

  const byKey = new Map<string, Row[]>();
  for (const r of rows) { if (!byKey.has(r.key)) byKey.set(r.key, []); byKey.get(r.key)!.push(r); }

  const best: Row[] = [];
  const dupsExcluded: Row[] = [];
  for (const group of byKey.values()) {
    const sorted = [...group].sort((a, b) => score(b) - score(a) || b.updatedAt.getTime() - a.updatedAt.getTime());
    best.push(sorted[0]);
    dupsExcluded.push(...sorted.slice(1));
  }

  const skipNoStructured = best.filter((r) => !r.published && !r.hasStructured);
  const skipNoImage = best.filter((r) => !r.published && r.hasStructured && !r.hasImage);
  const already = best.filter((r) => r.published);

  // SEGUNDA BARRERA anti-duplicados: por (tipología, slug). Cubre gemelos que el
  // agrupamiento por sourceRef.key no ve (fichas sin sourceRef, o con llave
  // distinta pero misma entidad). Si ya hay una PUBLICADA con ese slug, no se
  // publica otra; y entre varias candidatas con el mismo slug, solo pasa una.
  const typologyOf = (r: Row) => r.templateId.replace("ficha-", "");
  const publishedSlugs = new Set(rows.filter((r) => r.published && r.hasStructured).map((r) => `${typologyOf(r)}:${r.slug}`));
  const claimed = new Set<string>();
  const targets: Row[] = [];
  const skipSlugDup: Row[] = [];
  for (const r of best.filter((x) => !x.published && x.hasStructured && x.hasImage).sort((a, b) => score(b) - score(a))) {
    const sk = `${typologyOf(r)}:${r.slug}`;
    if (publishedSlugs.has(sk) || claimed.has(sk)) { skipSlugDup.push(r); continue; }
    claimed.add(sk);
    targets.push(r);
  }

  console.log(`▸ ${DRY ? "SIMULACRO" : "PUBLICANDO"} · ${BASE}`);
  console.log(`   llaves únicas: ${byKey.size} · ya publicadas: ${already.length}`);
  console.log(`   → A PUBLICAR: ${targets.length}`);
  console.log(`   excluidas por DUPLICADO (misma llave): ${dupsExcluded.filter((r) => !r.published).length}`);
  console.log(`   excluidas por SLUG ya publicado/repetido: ${skipSlugDup.length}`);
  console.log(`   excluidas sin structuredData: ${skipNoStructured.length} · sin portada: ${skipNoImage.length}`);
  if (skipSlugDup.length) {
    console.log(`\n   duplicados por slug excluidos:`);
    for (const r of skipSlugDup) console.log(`     ✗ ${r.id.slice(0, 10)} · ${typologyOf(r)}:${r.slug} · ${r.label.slice(0, 30)}`);
  }

  if (dupsExcluded.filter((r) => !r.published).length) {
    console.log(`\n   duplicados excluidos:`);
    for (const r of dupsExcluded.filter((x) => !x.published)) console.log(`     ✗ ${r.id.slice(0, 8)} · ${r.key} · ${r.label.slice(0, 34)}`);
  }
  if (skipNoImage.length) for (const r of skipNoImage) console.log(`     ⚠ sin portada: ${r.id.slice(0, 8)} · ${r.label.slice(0, 40)}`);

  if (DRY) {
    console.log(`\n   muestra de las que se publicarían (15):`);
    for (const r of targets.slice(0, 15)) console.log(`     • ${r.templateId.replace("ficha-", "").padEnd(8)} ${r.label.slice(0, 38).padEnd(38)} /${r.slug}`);
    await prisma.$disconnect();
    return;
  }

  let ok = 0, fail = 0;
  const failures: string[] = [];
  let idx = 0;
  const worker = async () => {
    while (idx < targets.length) {
      const r = targets[idx++];
      try {
        const res = await fetch(`${BASE}/api/deliverables/${r.id}`, {
          method: "PATCH",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ published: true }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        const finalSlug = (j?.deliverable?.structuredData as any)?.slug ?? r.slug;
        ok++;
        console.log(`  ✓ ${r.templateId.replace("ficha-", "").padEnd(8)} ${r.label.slice(0, 34).padEnd(34)} /${finalSlug}`);
      } catch (e) {
        fail++; failures.push(`${r.label} — ${(e as Error).message}`);
        console.log(`  ✗ ${r.label.slice(0, 34)} · ${(e as Error).message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONC, targets.length) }, worker));

  console.log(`\n════ publicadas: ${ok} · fallidas: ${fail} ════`);
  for (const f of failures) console.log(`   - ${f}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error("✗", e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
