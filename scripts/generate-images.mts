/**
 * Genera imágenes de archivo B/N (estilo de la casa) para los videos, vía
 * gpt-image-2, y las guarda en remotion/public/img/.
 *
 *   node --import tsx scripts/generate-images.mts --in shotlist-images.json
 *
 * Entrada: JSON [{ name, prompt, accent?("rojo"|"amarillo"|"azul") }].
 * Reusa el estilo cerrado del Taller (STYLE_35): foto gelatina de plata + trama
 * de tinta + UN acento, sin texto, fiel a Colombia.
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

const STYLE_35 =
  "A black-and-white editorial photograph with the texture of a silver-gelatin print — documentary realism, high contrast, fine film grain — overlaid with subtle touches of pen-and-ink illustration: delicate parallel hatching and cross-hatching woven into the shadows and along the edges of forms, as if an engraver discreetly retouched the photograph. The photograph clearly dominates; the ink is an undertone.";
const COMMON =
  "Restrained, archival, museum-quality. Absolutely NO text, letters, captions, numbers, logos, watermarks, frames or borders. No modern objects or anachronisms. Historically faithful to the period and to Colombia / Latin America. Strong empty/negative space so typography can sit on top.";
const ACCENT_EN: Record<string, string> = {
  rojo: "deep crimson-red", amarillo: "muted ochre-gold yellow", azul: "deep cobalt-blue",
};

function housePrompt(scene: string, accent?: string): string {
  const acc = accent && ACCENT_EN[accent]
    ? `Plus ONE restrained accent of ${ACCENT_EN[accent]} spot ink applied ONLY on the single most meaningful element; every other element stays strictly monochrome, no bleed onto neighbors.`
    : "Entirely monochrome, no color accent.";
  return `${scene}\n\n${STYLE_35}\n\n${acc}\n\n${COMMON}`;
}

async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  const w = async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, w));
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const inIdx = argv.indexOf("--in");
  if (inIdx === -1) { console.error('Uso: --in <lista.json>'); process.exit(1); }
  const specs: Array<{ name: string; prompt: string; accent?: string }> = JSON.parse(readFileSync(resolve(argv[inIdx + 1]), "utf8"));
  loadEnv();
  const { generateImagePng } = await import("../src/lib/openai-image");
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\n▸ Generando ${specs.length} imágenes de archivo → remotion/public/img/\n`);
  const results = await pool(specs, 3, async (s) => {
    const dest = join(OUT_DIR, `${s.name}.png`);
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const png = await generateImagePng({ prompt: housePrompt(s.prompt, s.accent), size: "1024x1536", quality: "high", timeoutMs: 240_000 });
        writeFileSync(dest, png);
        console.log(`  ✓ ${s.name}.png`);
        return true;
      } catch (e) {
        const msg = (e as Error).message;
        if (/moderation|safety/i.test(msg) && attempt < 3) { console.log(`  · ${s.name} moderación, reintento`); continue; }
        console.log(`  ✗ ${s.name}: ${msg.slice(0, 120)}`);
        return false;
      }
    }
    return false;
  });
  console.log(`\n  ${results.filter(Boolean).length}/${specs.length} imágenes listas en remotion/public/img/\n`);
}

main().catch((e) => { console.error("✗", e?.message ?? e); process.exit(1); });
