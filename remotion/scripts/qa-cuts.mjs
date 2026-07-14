/**
 * QA de TRANSICIONES: stills justo alrededor de cada corte (from−4, from, from+4)
 * para ver el barrido/filo/persianas/flash/sangrado a su paso.
 *
 *   node scripts/qa-cuts.mjs [outDir] [soloEstilo]
 */
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill, openBrowser } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] ?? join(__dirname, "..", "out", "qa-cuts"));
const ONLY = process.argv[3];

const serveUrl = await bundle({
  entryPoint: join(__dirname, "..", "src", "index.ts"),
  publicDir: join(__dirname, "..", "public"),
});
const browser = await openBrowser("chrome");
const comps = (await getCompositions(serveUrl, { puppeteerInstance: browser })).filter(
  (c) => c.id.startsWith("fx-") && (!ONLY || c.id === `fx-${ONLY}`)
);

mkdirSync(OUT, { recursive: true });
let n = 0;
for (const comp of comps) {
  const score = comp.defaultProps;
  const frames = new Set();
  for (const s of score.scenes.slice(1)) {
    for (const off of [-4, 0, 4]) {
      const f = s.from + off;
      if (f >= 0 && f < comp.durationInFrames) frames.add(f);
    }
  }
  const sorted = [...frames].sort((a, b) => a - b);
  for (const frame of sorted) {
    const output = join(OUT, `${comp.id}-${String(frame).padStart(4, "0")}.jpeg`);
    await renderStill({
      composition: comp, serveUrl, output, frame,
      imageFormat: "jpeg", jpegQuality: 88, scale: 0.45,
      puppeteerInstance: browser, chromiumOptions: { gl: "angle" },
    });
    n++;
  }
  console.log(`${comp.id}: ${sorted.length} stills de corte`);
}
await browser.close({ silent: true });
console.log(`OK — ${n} stills en ${OUT}`);
