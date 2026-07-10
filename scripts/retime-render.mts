/**
 * Re-cronometra (tiempo de lectura) y re-renderiza partituras YA construidas,
 * sin volver a buscar imágenes (reusa las rutas img/ ya resueltas). Aplica los
 * cambios de motor (timing + salidas) a todos los videos existentes.
 *
 *   node --import tsx scripts/retime-render.mts
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const REMOTION = join(REPO, "remotion");
const OUT = join(REMOTION, "out");

async function main() {
  const { assignTiming } = await import("../src/lib/video/draft");
  const files = readdirSync(OUT).filter(
    (f) => (f.startsWith("score-type-") || f === "score-showcase-bogotazo.json") && f.endsWith(".json")
  );
  console.log(`▸ Re-cronometrando ${files.length} partituras…\n`);
  const targets: { score: string; out: string }[] = [];
  for (const f of files) {
    const path = join(OUT, f);
    const score = JSON.parse(readFileSync(path, "utf8"));
    const contents = (score.scenes as any[]).map(({ from, durationInFrames, ...rest }) => rest);
    const { scenes, totalFrames } = assignTiming(contents, { fps: score.meta.fps });
    score.scenes = scenes;
    score.meta.durationInFrames = totalFrames;
    writeFileSync(path, JSON.stringify(score, null, 2));
    const key = f.replace(/^score-(type-)?/, "").replace(/\.json$/, "");
    const outName = f === "score-showcase-bogotazo.json" ? "showcase-bogotazo" : `type-${key}`;
    console.log(`  · ${outName}  →  ${(totalFrames / score.meta.fps).toFixed(1)}s (${scenes.length} escenas)`);
    targets.push({ score: path, out: outName });
  }
  console.log(`\n▸ Renderizando ${targets.length}…\n`);
  for (const t of targets) {
    try {
      execSync(`npx remotion render src/index.ts TypographicVideo out/${t.out}.mp4 --props=${t.score} --concurrency=4`, { cwd: REMOTION, stdio: "ignore" });
      console.log(`  ✓ ${t.out}.mp4`);
    } catch { console.log(`  ✗ ${t.out}`); }
  }
}
main().catch((e) => { console.error("✗", e?.message ?? e); process.exit(1); });
