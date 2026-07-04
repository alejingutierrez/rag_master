/**
 * Clasificador de PERSONAS: separa figura histórica de académico/autor moderno.
 *
 * El registro deriva la época por MODA del corpus, lo que ancla a los AUTORES de
 * las obras al período que ESTUDIAN (Carl Langebaek → "Prehispánico", Germán
 * Colmenares → "Colonia"). Esto le pide a Claude (nivel historiador) que juzgue,
 * por biografía real, si cada nombre es:
 *   - figura      → actor histórico (se le fija período + año reales)
 *   - academico   → historiador/investigador/autor moderno → hide
 *   - institucion → organización mal tipada como persona → hide
 *   - ruido       → no es una persona real → hide
 *
 * Señal fuerte: se le indica a Claude qué nombres son AUTORES del corpus (con los
 * años de sus obras). Un autor puede ser académico moderno (Colmenares) o una
 * figura cuya obra es fuente primaria (Mutis, Cané) — Claude los distingue.
 *
 * Resultado → se fusiona en src/data/entity-overrides.json (revisable). Luego:
 *   npx tsx scripts/mine-entities.mts   (regenera entities.json con los overrides)
 *
 * Solo LEE la BD. Resumible (checkpoint en tmp/). Uso:
 *   npx tsx scripts/classify-personas.mts
 *   TOP_N=500   además de los autores, clasifica las N personas más mencionadas
 *   FORCE=1     ignora el checkpoint
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { prisma } from "../src/lib/prisma";
import { awsConfig } from "../src/lib/aws-config";
import { PERIOD_OPTIONS, PERIOD_CODES } from "../src/lib/taxonomy";

const bedrock = new BedrockRuntimeClient(awsConfig);
const MODEL = process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-6-20250610-v1:0";
const ROOT = join(import.meta.dirname, "..");
const ENTITIES = join(ROOT, "src", "data", "entities.json");
const OVERRIDES = join(ROOT, "src", "data", "entity-overrides.json");
const CHECKPOINT = join(ROOT, "tmp", "classify-personas-checkpoint.json");
const TOP_N = parseInt(process.env.TOP_N || "500", 10);
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : 0; // 0 = sin límite (prueba)
const FORCE = process.env.FORCE === "1";
const BATCH = 40;
const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Persona = { type: string; slug: string; name: string; variants: string[]; periodoCode: string | null; anio: number | null; mentions: number };
type Cls = { slug: string; kind: "figura" | "academico" | "institucion" | "ruido"; periodoCode?: string | null; anio?: number | null };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();

// ── Índice de autores del corpus (nombres individuales + años de obra) ──
async function loadAuthorIndex(): Promise<Map<string, number[]>> {
  const docs = await prisma.document.findMany({ select: { metadata: true } });
  const byName = new Map<string, number[]>();
  for (const d of docs) {
    const m = (d.metadata ?? {}) as Record<string, unknown>;
    const a = m.author;
    const y = typeof m.publicationYear === "number" ? m.publicationYear : null;
    if (typeof a !== "string" || !a.trim()) continue;
    for (let one of a.split(/;|·|\/|\|| y | e |&|,/)) {
      one = one.replace(/\((?:[^)]*)\)/g, "").replace(/\b(editora?|editores|compiladora?|director|científico|coordinadora?)\b/gi, "").trim();
      const nm = norm(one);
      if (nm.split(" ").length < 2) continue; // nombre + apellido mínimo
      if (!byName.has(nm)) byName.set(nm, []);
      if (y) byName.get(nm)!.push(y);
    }
  }
  return byName;
}

/** ¿El nombre de la persona es (subsecuencia contigua de) algún autor individual? */
function authorMatch(name: string, authors: Map<string, number[]>): number[] | null {
  const p = ` ${norm(name)} `;
  if (p.trim().split(" ").length < 2) return null;
  for (const [an, years] of authors) {
    if (` ${an} `.includes(p)) return years;
  }
  return null;
}

// ── Claude ──
const SYSTEM = `Eres un historiador experto en historia de Colombia. Recibes una lista de nombres extraídos de un corpus de obras académicas. Para CADA uno, clasifícalo:

- "figura": persona que VIVIÓ y ACTUÓ en la historia (de Colombia o vinculada a ella) — políticos, militares, líderes, artistas, religiosos, próceres, caciques, etc. Para estas indica su período canónico y un año representativo de su vida/actuación.
- "academico": historiador, arqueólogo, antropólogo, sociólogo, investigador o AUTOR MODERNO que ESCRIBE SOBRE la historia, pero no es un actor de ella. (Ej.: Germán Colmenares, Carl Henrik Langebaek, Jaime Jaramillo Uribe, Gerardo Reichel-Dolmatoff, Hermes Tovar Pinzón, Marco Palacios).
- "institucion": organización, entidad o colectivo mal tipado como persona (partidos, empresas, pueblos, instituciones).
- "ruido": no es una persona real, o es un fragmento/concepto/error.

CLAVE: te indico qué nombres son AUTORES del corpus. Un autor puede ser:
  · un académico moderno (la mayoría) → "academico".
  · una figura histórica cuya OBRA es fuente primaria (ej. José Celestino Mutis, Francisco José de Caldas, Miguel Cané, Josefa Acevedo de Gómez, un cronista colonial). Esas siguen siendo "figura".
Decide por la BIOGRAFÍA real de la persona (cuándo vivió), NO por lo que estudia ni por el período donde el corpus la menciona.

Períodos canónicos (código: rango):
${PERIOD_OPTIONS.map((p) => `  ${p.code}: ${p.rango}`).join("\n")}

Usa "TRANS" solo si de verdad abarca 3+ períodos. Devuelve el "slug" EXACTO que se te da.`;

const TOOL = {
  name: "clasificar",
  description: "Clasifica cada nombre de la lista.",
  inputSchema: {
    json: {
      type: "object",
      properties: {
        clasificaciones: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slug: { type: "string" },
              kind: { type: "string", enum: ["figura", "academico", "institucion", "ruido"] },
              periodoCode: { type: "string", enum: [...PERIOD_CODES, "NINGUNO"] },
              anio: { type: "integer", description: "Año representativo de la vida/actuación (negativo si a.C.). Solo para figura." },
            },
            required: ["slug", "kind"],
          },
        },
      },
      required: ["clasificaciones"],
    },
  },
};

async function classifyBatch(items: Array<{ p: Persona; years: number[] | null }>): Promise<Cls[]> {
  const lines = items.map(({ p, years }) => {
    const alias = p.variants.filter((v) => v !== p.name).slice(0, 3);
    const aliasStr = alias.length ? ` [alias: ${alias.join(", ")}]` : "";
    const authorStr = years ? ` · AUTOR del corpus${years.length ? ` (obras ${Math.min(...years)}–${Math.max(...years)})` : ""}` : "";
    return `- ${p.name} (slug: ${p.slug})${aliasStr} — el corpus lo menciona en: ${p.periodoCode ?? "?"}${authorStr}`;
  });
  const user = `Clasifica estos ${items.length} nombres:\n\n${lines.join("\n")}`;

  const isThinking = /claude-(opus|sonnet)-(4-6|4-7|4-8|5)/.test(MODEL);
  const inferenceConfig: { maxTokens: number; temperature?: number } = { maxTokens: 8000 };
  if (!isThinking) inferenceConfig.temperature = 0;

  const cmd = new ConverseCommand({
    modelId: MODEL,
    system: [{ text: SYSTEM }],
    messages: [{ role: "user", content: [{ text: user }] }],
    toolConfig: { tools: [{ toolSpec: TOOL }], toolChoice: { tool: { name: TOOL.name } } },
    inferenceConfig,
  });
  const res = await bedrock.send(cmd);
  const block = res.output?.message?.content?.find((b) => b.toolUse?.name === TOOL.name);
  const input = block?.toolUse?.input as { clasificaciones?: Cls[] } | undefined;
  if (!Array.isArray(input?.clasificaciones)) throw new Error("respuesta sin clasificaciones");
  return input.clasificaciones;
}

// ── Main ──
async function main() {
  const start = Date.now();
  const reg = JSON.parse(readFileSync(ENTITIES, "utf8")) as { entities: Persona[] };
  const personas = reg.entities.filter((e) => e.type === "persona");
  const bySlug = new Map(personas.map((p) => [p.slug, p]));

  console.log(`Clasificador de personas · modelo ${MODEL}`);
  const authors = await loadAuthorIndex();
  console.log(`  ${authors.size} autores individuales del corpus`);

  // Objetivo: autores ∪ top-N por menciones.
  const authorYears = new Map<string, number[] | null>();
  const targets: Persona[] = [];
  const seen = new Set<string>();
  for (const p of personas) {
    const ym = authorMatch(p.name, authors) ?? p.variants.map((v) => authorMatch(v, authors)).find(Boolean) ?? null;
    if (ym) { authorYears.set(p.slug, ym); if (!seen.has(p.slug)) { seen.add(p.slug); targets.push(p); } }
  }
  const topN = [...personas].sort((a, b) => b.mentions - a.mentions).slice(0, TOP_N);
  for (const p of topN) if (!seen.has(p.slug)) { seen.add(p.slug); targets.push(p); }
  // SLUGS=slug1,slug2 — fuerza incluir personas específicas (p. ej. las publicadas,
  // que pueden ser arqueólogos de bajas menciones fuera del top-N).
  for (const s of (process.env.SLUGS || "").split(",").map((x) => x.trim()).filter(Boolean)) {
    const p = bySlug.get(s);
    if (p && !seen.has(s)) { seen.add(s); targets.push(p); }
  }
  if (LIMIT > 0) targets.splice(LIMIT);
  console.log(`  Objetivo: ${targets.length} personas (autores ${authorYears.size} ∪ top ${TOP_N})${LIMIT ? ` [LIMIT ${LIMIT}]` : ""}`);

  // Checkpoint
  const done: Record<string, Cls> = FORCE || !existsSync(CHECKPOINT) ? {} : JSON.parse(readFileSync(CHECKPOINT, "utf8"));
  const pending = targets.filter((p) => !done[p.slug]);
  console.log(`  Pendientes: ${pending.length} (ya hechas: ${Object.keys(done).length})\n`);

  for (let i = 0; i < pending.length; i += BATCH) {
    const chunk = pending.slice(i, i + BATCH).map((p) => ({ p, years: authorYears.get(p.slug) ?? null }));
    let ok = false;
    for (let attempt = 1; attempt <= MAX_RETRIES && !ok; attempt++) {
      try {
        const cls = await classifyBatch(chunk);
        for (const c of cls) if (bySlug.has(c.slug)) done[c.slug] = c;
        ok = true;
      } catch (err) {
        console.warn(`  lote ${i / BATCH + 1} intento ${attempt} falló: ${(err as Error).message}`);
        if (attempt < MAX_RETRIES) await sleep(4000 * attempt);
      }
    }
    mkdirSync(dirname(CHECKPOINT), { recursive: true });
    writeFileSync(CHECKPOINT, JSON.stringify(done));
    const kinds = Object.values(done).reduce((a, c) => ((a[c.kind] = (a[c.kind] ?? 0) + 1), a), {} as Record<string, number>);
    console.log(`  ${Math.min(i + BATCH, pending.length)}/${pending.length} · figura:${kinds.figura ?? 0} academico:${kinds.academico ?? 0} inst:${kinds.institucion ?? 0} ruido:${kinds.ruido ?? 0}`);
    await sleep(800);
  }

  // ── Fusionar en overrides ──
  const existing: Record<string, unknown> = existsSync(OVERRIDES) ? JSON.parse(readFileSync(OVERRIDES, "utf8")) : {};
  let hidden = 0, reepoch = 0;
  for (const [slug, c] of Object.entries(done)) {
    const key = `persona:${slug}`;
    if (c.kind === "academico" || c.kind === "institucion" || c.kind === "ruido") {
      existing[key] = { hide: true, _motivo: c.kind };
      hidden++;
    } else if (c.kind === "figura") {
      const code = c.periodoCode && c.periodoCode !== "NINGUNO" && PERIOD_CODES.includes(c.periodoCode) ? c.periodoCode : null;
      const anio = typeof c.anio === "number" && c.anio > -4000 && c.anio < 2100 ? c.anio : null;
      if (code) { existing[key] = { periodoCode: code, ...(anio != null ? { anio } : {}) }; reepoch++; }
    }
  }
  writeFileSync(OVERRIDES, JSON.stringify(existing, null, 1));

  console.log(`\n✓ overrides fusionados: ${hidden} ocultados, ${reepoch} con época corregida`);
  console.log(`  Ahora: npx tsx scripts/mine-entities.mts  (regenera entities.json)`);
  console.log(`  Duración: ${Math.round((Date.now() - start) / 1000)}s`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
