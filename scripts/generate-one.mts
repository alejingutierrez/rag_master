/**
 * Genera UN video de producción: tema + tipo → partitura → (render).
 *
 *   node --import tsx scripts/generate-one.mts "La Batalla de Boyacá" cronologia -d 30 --render
 *
 * Tipos: hueso-y-ceniza · manifiesto · brutalista · cifra-monumento · voces ·
 *        cronologia · retrato · archivo · editorial · collage
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const REMOTION = join(REPO, "remotion");

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
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "video";

async function main() {
  const argv = process.argv.slice(2);
  const topic = argv.find((a) => !a.startsWith("-"));
  const styleId = argv.filter((a) => !a.startsWith("-"))[1] || "hueso-y-ceniza";
  const dIdx = argv.findIndex((a) => a === "-d" || a === "--duration");
  const durationSec = dIdx >= 0 ? Number(argv[dIdx + 1]) : 30;
  const doRender = argv.includes("--render");
  if (!topic) { console.error('Falta el tema. Ej: ... "La Batalla de Boyacá" cronologia --render'); process.exit(1); }
  loadEnv();
  const { generateVideoScore } = await import("../src/lib/video/generate");

  console.log(`\n▸ Generando  «${topic}»  ·  tipo ${styleId}  ·  ${durationSec}s\n`);
  const t0 = Date.now();
  const { score, styleLabel, imagesUsed } = await generateVideoScore({
    topic, styleId, durationSec,
    destDir: join(REMOTION, "public", "img"),
    onStage: (s, d) => console.log(`  · ${s}${d ? ": " + d : ""}`),
  });
  console.log(
    `\n✓ listo en ${((Date.now() - t0) / 1000).toFixed(1)}s` +
      `\n  tipo: ${styleLabel}  ·  época: ${score.meta.periodLabel}` +
      `\n  escenas: ${score.scenes.length}  ·  duración: ${(score.meta.durationInFrames / score.meta.fps).toFixed(1)}s  ·  imágenes: ${imagesUsed}`
  );

  const base = slug(topic);
  const scoreFile = join(REMOTION, "out", `score-gen-${base}.json`);
  mkdirSync(dirname(scoreFile), { recursive: true });
  writeFileSync(scoreFile, JSON.stringify(score, null, 2));
  console.log(`\n  partitura → ${scoreFile}`);
  if (doRender) {
    console.log(`\n▸ renderizando…\n`);
    execSync(`npx remotion render src/index.ts TypographicVideo out/gen-${base}.mp4 --props=${scoreFile} --concurrency=4`, { cwd: REMOTION, stdio: "inherit" });
    console.log(`\n✓ video → ${join(REMOTION, "out", "gen-" + base + ".mp4")}`);
  }
}
main().catch((e) => { console.error("\n✗", e?.message ?? e); process.exit(1); });
