/**
 * Convierte los borradores de tipo (del workflow video-nine-types) en videos:
 * borrador → partitura (assembleScore) → resuelve consultas de imagen a archivo
 * real (searchReferences; fallback a puro tipo si no hay buena imagen) → render.
 *
 *   node --import tsx scripts/build-type-videos.mts --in drafts.json [--no-render]
 *
 * drafts.json = [{ periodCode, title, style, scenes:[...] }, ...]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const REMOTION = join(REPO, "remotion");
const IMG_DIR = join(REMOTION, "public", "img");

function loadEnv() {
  const p = join(REPO, ".env");
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, "utf8").split("\n")) {
    const line = raw.trim(); if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("="); if (eq === -1) continue;
    const k = line.slice(0, eq).trim(); let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "x";

const MAX_IMAGES_PER_VIDEO = 4; // cota para no eternizar la búsqueda

async function main() {
  const argv = process.argv.slice(2);
  const inPath = argv[argv.indexOf("--in") + 1];
  const noRender = argv.includes("--no-render");
  if (!inPath) { console.error("Falta --in drafts.json"); process.exit(1); }
  loadEnv();
  mkdirSync(IMG_DIR, { recursive: true });
  const drafts = JSON.parse(readFileSync(resolve(inPath), "utf8")) as any[];

  const { parseDraft, assembleScore } = await import("../src/lib/video/draft");
  const { searchReferences } = await import("../src/lib/atelier/reference-search");

  const imgCache = new Map<string, string | null>(); // query -> "img/x.jpg" | null

  async function resolveQuery(q: string): Promise<string | null> {
    if (imgCache.has(q)) return imgCache.get(q)!;
    try {
      const res = await searchReferences({ titulo: q, resumen: q, visualAnchors: [q], visualIntent: "hecho-documental" as const });
      const ref = res.refs[0];
      if (!ref) { imgCache.set(q, null); return null; }
      const name = `q-${slug(q)}.jpg`;
      writeFileSync(join(IMG_DIR, name), ref.buffer);
      const path = `img/${name}`;
      imgCache.set(q, path);
      console.log(`    img "${q}" → ${name} [${ref.meta.provider} score=${ref.meta.score}]`);
      return path;
    } catch (e) {
      console.log(`    img "${q}" ✗ ${(e as Error).message.slice(0, 60)}`);
      imgCache.set(q, null); return null;
    }
  }

  const built: { key: string; style: string; scoreFile: string }[] = [];

  for (const d of drafts) {
    const key = slug(d.style || d.title);
    try {
      const parsed = parseDraft(d);
      const score = assembleScore(parsed, { topic: d.title, personality: (d.style || "ruptura") as never, durationSec: 30 });
      // resolver imágenes (con cota)
      let used = 0;
      for (const s of score.scenes as any[]) {
        for (const field of ["image", "imageFill"] as const) {
          const q = s[field];
          if (typeof q === "string" && !q.startsWith("img/")) {
            if (used >= MAX_IMAGES_PER_VIDEO) { delete s[field]; continue; }
            const path = await resolveQuery(q);
            if (path) { s[field] = path; used++; } else { delete s[field]; }
          }
        }
      }
      const scoreFile = join(REMOTION, "out", `score-type-${key}.json`);
      writeFileSync(scoreFile, JSON.stringify(score, null, 2));
      console.log(`  ✓ ${key}  (${score.scenes.length} escenas, ${used} imágenes)`);
      built.push({ key, style: d.style || d.title, scoreFile });
    } catch (e) {
      console.log(`  ✗ ${key}: ${(e as Error).message.slice(0, 100)}`);
    }
  }

  if (noRender) { console.log("\n(--no-render) partituras listas."); return; }
  console.log(`\n▸ Renderizando ${built.length} videos…\n`);
  for (const b of built) {
    try {
      execSync(`npx remotion render src/index.ts TypographicVideo out/type-${b.key}.mp4 --props=${b.scoreFile} --concurrency=4`, { cwd: REMOTION, stdio: "ignore" });
      console.log(`  ✓ type-${b.key}.mp4`);
    } catch { console.log(`  ✗ render type-${b.key}`); }
  }
}
main().catch((e) => { console.error("✗", e?.message ?? e); process.exit(1); });
