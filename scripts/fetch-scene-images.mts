/**
 * Busca y descarga imágenes de archivo REALES para escenas de video, reusando el
 * buscador del Taller. Baja los top candidatos por consulta para poder elegir.
 *
 *   node --import tsx scripts/fetch-scene-images.mts "El Bogotazo 1948" "tranvía Bogotá 1948" "Jorge Eliécer Gaitán"
 *
 * Guarda en remotion/public/img/<slug>-<n>.jpg e imprime fuente/tamaño de cada uno.
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
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

async function main() {
  const queries = process.argv.slice(2);
  if (queries.length === 0) { console.error("Pasa una o más consultas."); process.exit(1); }
  loadEnv();
  mkdirSync(OUT_DIR, { recursive: true });
  const { searchSceneImages, downloadImage, attribution } = await import("../src/lib/video/scene-images");

  for (const q of queries) {
    console.log(`\n▸ "${q}"`);
    let cands;
    try { cands = await searchSceneImages(q, { minWidth: 700, max: 6 }); }
    catch (e) { console.log(`  ✗ búsqueda falló: ${(e as Error).message}`); continue; }
    if (!cands.length) { console.log("  (sin candidatos ≥700px)"); continue; }
    const base = slug(q);
    for (let i = 0; i < Math.min(3, cands.length); i++) {
      const c = cands[i];
      const dest = join(OUT_DIR, `${base}-${i + 1}.jpg`);
      try {
        await downloadImage(c, dest);
        console.log(`  ✓ ${base}-${i + 1}.jpg  ${c.width}x${c.height}  [${attribution(c)}]`);
      } catch (e) {
        console.log(`  ✗ ${base}-${i + 1}: ${(e as Error).message.slice(0, 80)}`);
      }
    }
  }
  console.log("");
}

main().catch((e) => { console.error("✗", e?.message ?? e); process.exit(1); });
