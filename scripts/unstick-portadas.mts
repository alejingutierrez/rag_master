/**
 * Destraba portadas huérfanas: fichas COMPLETE cuya imagen quedó en estado
 * "generando" viejo (proceso murió sin terminar ni errar). Re-dispara la
 * generación contra el app desplegado (la ruta permite re-generar si el estado
 * lleva >12 min = STALE_MS). Read-only salvo el POST de re-disparo.
 *
 *   node --import tsx scripts/unstick-portadas.mts            # umbral 12 min
 *   STALE_MIN=12 node --import tsx scripts/unstick-portadas.mts
 */
import { config as dotenv } from "dotenv";
// .env: el del cwd; si corres desde un worktree, cae al del repo padre.
dotenv({ path: process.env.ENV_FILE || `${process.cwd()}/.env` });
dotenv({ path: `${process.cwd()}/../../../.env` });
import { prisma } from "../src/lib/prisma";
import { signSession, adminEmail, SESSION_COOKIE } from "../src/lib/auth";

const BASE = process.env.SITE_URL || "https://historiacolombiana.com";
const STALE_MIN = Number(process.env.STALE_MIN ?? "12");

async function main() {
  const cookie = `${SESSION_COOKIE}=${await signSession({ sub: adminEmail(), role: "admin" })}`;
  const rows = await prisma.deliverable.findMany({
    where: { templateId: { in: ["ficha-hecho", "ficha-entidad"] }, status: "COMPLETE", imageUrl: null, imageKey: null },
    select: { id: true, metadata: true, userQuestion: true },
  });
  const now = Date.now();
  const stale = rows.filter((r) => {
    const im = (r.metadata as { image?: { status?: string; at?: string } } | null)?.image;
    if (im?.status !== "generando") return false;
    const at = im.at ? Date.parse(im.at) : 0;
    return now - at > STALE_MIN * 60 * 1000;
  });
  const sinDisparar = rows.filter((r) => {
    const im = (r.metadata as { image?: { status?: string } } | null)?.image;
    return !im || (im.status !== "generando" && im.status !== "ok");
  });
  console.log(`COMPLETE sin portada: ${rows.length} · atascadas 'generando' (>${STALE_MIN}min): ${stale.length} · sin disparar: ${sinDisparar.length}`);
  const targets = [...stale, ...sinDisparar];
  for (const d of targets) {
    const r = await fetch(`${BASE}/api/deliverables/${d.id}/generate-image`, { method: "POST", headers: { Cookie: cookie } });
    console.log(`  ${r.status} · ${(d.userQuestion ?? "").slice(0, 34)} · ${d.id.slice(0, 8)}`);
  }
  if (!targets.length) console.log("  (nada que destrabar)");
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error("✗", e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
