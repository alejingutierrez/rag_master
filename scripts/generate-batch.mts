/**
 * Tanda de videos: genera N partituras (Director + RAG real) y las renderiza.
 * Cada job usa una personalidad distinta para mostrar la variedad remezclable.
 *
 *   node --import tsx scripts/generate-batch.mts
 *
 * Corre con concurrencia moderada (subprocesos independientes, cada uno con su
 * propio semáforo de Bedrock). Los fallos se saltan y se reportan al final.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const REMOTION = join(REPO, "remotion");

const JOBS = [
  { slug: "01-dorado", topic: "El Dorado y la conquista de los muiscas", p: "voces", d: 30 },
  { slug: "02-mutis", topic: "La Expedición Botánica de José Celestino Mutis", p: "archivo", d: 30 },
  { slug: "03-veinte-julio", topic: "El 20 de julio de 1810", p: "enigma", d: 30 },
  { slug: "04-bolivar", topic: "Simón Bolívar", p: "retrato", d: 35 },
  { slug: "05-mil-dias", topic: "La Guerra de los Mil Días", p: "ruptura", d: 30 },
  { slug: "06-const-1991", topic: "La Constitución de 1991", p: "manifiesto", d: 30 },
  { slug: "07-bogotazo", topic: "El Bogotazo", p: "cronologia", d: 30 },
  { slug: "08-frente-nacional", topic: "El Frente Nacional", p: "contraste", d: 30 },
  { slug: "09-escobar", topic: "Pablo Escobar y el Cartel de Medellín", p: "cifra", d: 25 },
  { slug: "10-acuerdo-paz", topic: "El Acuerdo de Paz de 2016", p: "causa-consecuencia", d: 40 },
];

const scorePath = (j: { slug: string }) => join(REMOTION, "out", `score-${j.slug}.json`);
const mp4Path = (j: { slug: string }) => join(REMOTION, "out", `${j.slug}.mp4`);

function run(cmd: string, args: string[], cwd = REPO): Promise<{ code: number; out: string }> {
  return new Promise((res) => {
    const c = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (out += d));
    c.on("close", (code) => res({ code: code ?? 1, out }));
  });
}

async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return results;
}

type Job = (typeof JOBS)[number];

async function gen(j: Job): Promise<boolean> {
  console.log(`  gen  ▸ ${j.slug}  (${j.p})`);
  const r = await run("node", ["--import", "tsx", "scripts/generate-video.mts", j.topic, "-d", String(j.d), "-p", j.p, "--out", scorePath(j)]);
  const ok = r.code === 0 && existsSync(scorePath(j));
  console.log(`  gen  ${ok ? "✓" : "✗"} ${j.slug}`);
  if (!ok) console.log(r.out.split("\n").filter(Boolean).slice(-4).map((l) => "       " + l).join("\n"));
  return ok;
}

async function render(j: Job): Promise<boolean> {
  console.log(`  rndr ▸ ${j.slug}`);
  const r = await run("npx", ["remotion", "render", "src/index.ts", "TypographicVideo", `out/${j.slug}.mp4`, `--props=${scorePath(j)}`, "--concurrency=3"], REMOTION);
  const ok = r.code === 0 && existsSync(mp4Path(j));
  console.log(`  rndr ${ok ? "✓" : "✗"} ${j.slug}`);
  if (!ok) console.log(r.out.split("\n").filter(Boolean).slice(-6).map((l) => "       " + l).join("\n"));
  return ok;
}

(async () => {
  console.log(`\n▸ TANDA — ${JOBS.length} videos\n\n▸ Fase 1: generar partituras (concurrencia 2)\n`);
  const genned = await pool(JOBS, 2, (j) => gen(j));
  const ready = JOBS.filter((_, i) => genned[i]);

  console.log(`\n▸ Fase 2: renderizar ${ready.length} videos (concurrencia 2)\n`);
  const rendered = await pool(ready, 2, (j) => render(j));
  const doneSet = new Set(ready.filter((_, i) => rendered[i]).map((j) => j.slug));

  console.log(`\n════════════════ RESUMEN ════════════════`);
  for (let i = 0; i < JOBS.length; i++) {
    const j = JOBS[i];
    const done = doneSet.has(j.slug);
    console.log(`  ${done ? "✓" : "✗"}  ${j.p.padEnd(18)}  ${done ? `out/${j.slug}.mp4` : "(falló)"}  —  ${j.topic}`);
  }
  console.log(`\n  ${doneSet.size}/${JOBS.length} videos en remotion/out/\n`);
})();
