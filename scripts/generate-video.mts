/**
 * CLI del generador de video tipográfico.
 *
 *   node --import tsx scripts/generate-video.mts "El Bogotazo" -d 30 -p ruptura --render
 *   node --import tsx scripts/generate-video.mts "La Gran Colombia" --fixture eval/fixtures/gran-colombia.json --render
 *
 * Flags: -d|--duration <s>  -p|--personality <ruptura|cifra|archivo|retrato>
 *        --fixture <json>    evidencia inyectada (sin RAG/BD, solo Bedrock)
 *        --no-verify         salta la verificación
 *        --render            además renderiza el MP4 con Remotion
 *        --out <path>        dónde escribir la partitura JSON
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const REMOTION = join(REPO, "remotion");

/** Carga .env de forma simple (sin pisar variables ya definidas). */
function loadEnv() {
  const envPath = join(REPO, ".env");
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function parseArgs(argv: string[]) {
  const a: { topic?: string; duration: number; personality: string; fixture?: string; noVerify: boolean; render: boolean; out?: string } = {
    duration: 30, personality: "ruptura", noVerify: false, render: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "-d" || t === "--duration") a.duration = Number(argv[++i]);
    else if (t === "-p" || t === "--personality") a.personality = argv[++i];
    else if (t === "--fixture") a.fixture = argv[++i];
    else if (t === "--no-verify") a.noVerify = true;
    else if (t === "--render") a.render = true;
    else if (t === "--out") a.out = argv[++i];
    else if (t === "--topic") a.topic = argv[++i];
    else if (!t.startsWith("-") && !a.topic) a.topic = t;
  }
  return a;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "video";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.topic) {
    console.error('Falta el tema. Ej: node --import tsx scripts/generate-video.mts "El Bogotazo" -d 30 --render');
    process.exit(1);
  }
  loadEnv();

  const { runDirector } = await import("../src/lib/video/director");

  let evidence;
  if (args.fixture) {
    const raw = JSON.parse(readFileSync(resolve(args.fixture), "utf8"));
    evidence = Array.isArray(raw) ? raw : raw.evidence;
    console.log(`▸ fixture: ${evidence.length} fragmentos de evidencia (sin RAG)`);
  }

  console.log(`\n▸ Director  «${args.topic}»  ·  ${args.personality}  ·  ${args.duration}s\n`);
  const t0 = Date.now();
  const { score, evidenceCount, verified } = await runDirector({
    topic: args.topic,
    personality: args.personality as never,
    durationSec: args.duration,
    evidence,
    verify: !args.noVerify,
    onStage: (s, d) => console.log(`  · ${s}${d ? ": " + d : ""}`),
  });

  const secs = (score.meta.durationInFrames / score.meta.fps).toFixed(1);
  console.log(
    `\n✓ partitura lista en ${((Date.now() - t0) / 1000).toFixed(1)}s` +
      `\n  época: ${score.meta.periodLabel} (${score.meta.periodCode})` +
      `\n  escenas: ${score.scenes.length}  ·  duración: ${secs}s  ·  evidencia: ${evidenceCount}  ·  verificado: ${verified ? "sí" : "no"}`
  );

  const slug = slugify(args.topic);
  const outPath = args.out ? resolve(args.out) : join(REMOTION, "out", `score-${slug}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(score, null, 2));
  console.log(`\n  partitura → ${outPath}`);

  const renderCmd = `npx remotion render src/index.ts TypographicVideo out/${slug}.mp4 --props=${outPath} --concurrency=4`;
  if (args.render) {
    console.log(`\n▸ renderizando…\n`);
    execSync(renderCmd, { cwd: REMOTION, stdio: "inherit" });
    console.log(`\n✓ video → ${join(REMOTION, "out", slug + ".mp4")}`);
  } else {
    console.log(`\n  para renderizar:\n    cd remotion && ${renderCmd}`);
  }
}

main().catch((e) => {
  console.error("\n✗ error:", e?.message ?? e);
  process.exit(1);
});
