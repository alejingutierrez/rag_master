/**
 * Prueba el buscador de archivo CON scoring del LLM (searchReferences del Taller):
 * genera queries, barre proveedores, puntúa relevancia y descarga los mejores.
 * Guarda en remotion/public/img/<base>-<n>.jpg.
 *
 *   node --import tsx scripts/fetch-refs.mts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const OUT_DIR = join(REPO, "remotion", "public", "img");

function loadEnv() {
  const p = join(REPO, ".env");
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("="); if (eq === -1) continue;
    const k = line.slice(0, eq).trim(); let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}

async function main() {
  loadEnv();
  mkdirSync(OUT_DIR, { recursive: true });
  const { searchReferences } = await import("../src/lib/atelier/reference-search");

  const ctx = {
    titulo: "El Bogotazo",
    resumen: "El 9 de abril de 1948 fue asesinado el líder liberal Jorge Eliécer Gaitán en la Carrera Séptima de Bogotá; su muerte desató un levantamiento popular que incendió el centro, volcó tranvías y dejó miles de muertos, iniciando La Violencia.",
    periodoLabel: "La Violencia (1948)",
    entidades: ["Jorge Eliécer Gaitán"],
    lugares: ["Bogotá", "Carrera Séptima", "Plaza de Bolívar"],
    visualIntent: "hecho-documental" as const,
    visualAnchors: ["Jorge Eliécer Gaitán", "tranvía de Bogotá", "Bogotá años 1940", "Plaza de Bolívar Bogotá", "Capitolio Nacional Bogotá"],
  };

  console.log(`▸ searchReferences("${ctx.titulo}")…\n`);
  const res = await searchReferences(ctx);
  console.log(`\n  queries: ${res.queries.join(" | ")}`);
  console.log(`  considered=${res.considered}  relevant=${res.relevant}  usable=${res.usable}  descargadas=${res.refs.length}  ok=${res.ok}\n`);
  res.refs.forEach((r, i) => {
    const dest = join(OUT_DIR, `ref-bogotazo-${i + 1}.jpg`);
    writeFileSync(dest, r.buffer);
    console.log(`  ✓ ref-bogotazo-${i + 1}.jpg  score=${r.meta.score}  [${r.meta.provider}] ${(r.meta.title || "").slice(0, 60)}`);
  });
}

main().catch((e) => { console.error("✗", e?.message ?? e); process.exit(1); });
