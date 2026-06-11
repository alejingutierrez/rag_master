/**
 * Minería de eventos para la línea de tiempo, derivados del corpus de preguntas.
 *
 * Por cada período histórico arma un "paquete de evidencia" (histograma de años,
 * top entidades, clusters temáticos, preguntas muestra en los picos de densidad)
 * y le pide a Claude que identifique los eventos pivote anclados a esa evidencia.
 * Después asigna preguntas a cada evento de forma determinística (ventana de años
 * + overlap de entidades) y calcula el peso de cada evento según la atención real
 * del corpus (nº de preguntas y nº de obras).
 *
 * Solo LEE de la BD. El resultado es un artefacto versionado en el repo:
 *   src/data/timeline-events.json
 *
 * Resumible: guarda checkpoint por período en tmp/timeline-events-checkpoint.json.
 *
 * Uso: npx tsx scripts/mine-timeline-events.mts
 *
 * Variables opcionales:
 *   FORCE=1                  re-minar todos los períodos (ignora checkpoint)
 *   ONLY=REG,VIO             minar solo estos períodos
 *   REASSIGN=1               recalibrar evidencia desde el checkpoint, sin LLM
 *   STOP_FILE=/tmp/stop-timeline  si existe, sale limpio entre períodos
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { prisma } from "../src/lib/prisma";
import { awsConfig } from "../src/lib/aws-config";
import { PERIOD_OPTIONS, CATEGORY_OPTIONS } from "../src/lib/taxonomy";

const bedrock = new BedrockRuntimeClient(awsConfig);

const CLAUDE_MODEL =
  process.env.BEDROCK_CLAUDE_MODEL_ID ||
  "us.anthropic.claude-opus-4-6-20250610-v1:0";

const ROOT = join(import.meta.dirname, "..");
const CHECKPOINT_PATH = join(ROOT, "tmp", "timeline-events-checkpoint.json");
const OUTPUT_PATH = join(ROOT, "src", "data", "timeline-events.json");
const STOP_FILE = process.env.STOP_FILE || "/tmp/stop-timeline";
const FORCE = process.env.FORCE === "1";
const ONLY = (process.env.ONLY || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const PAUSE_MS = 1500;
const MAX_RETRIES = 3;

// TRANS no es un período cronológico — sus preguntas igual entran a los eventos
// de otros períodos vía la ventana de años en la asignación.
const PERIODS = PERIOD_OPTIONS.filter((p) => p.code !== "TRANS");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransient(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "ThrottlingException" ||
    error.name === "ExpiredTokenException" ||
    error.name === "ServiceUnavailableException" ||
    /security token|InvalidClientTokenId|Signature expired|ExpiredToken|ETIMEDOUT|ECONNRESET|Too many requests|throttl/i.test(
      error.message
    )
  );
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface MinedEventRaw {
  anioInicio: number;
  anioFin: number;
  titulo: string;
  resumen: string;
  porQueImporta: string;
  categoria: string;
  entidadesClave: string[];
}

interface TimelineEvent extends MinedEventRaw {
  id: string;
  evidencia: {
    nPreguntas: number;
    nLibros: number;
    peso: number; // 0-100 normalizado dentro del período
    topEntidades: string[];
    questionIds: string[]; // top por score, con diversidad de obras
  };
}

interface PeriodResult {
  yearHistogram: Array<{ y: number; n: number; b: number }>;
  events: TimelineEvent[];
}

// ─── Evidencia por período ───────────────────────────────────────────────────

async function buildEvidence(periodoCode: string) {
  const histogram = await prisma.$queryRawUnsafe<
    Array<{ y: number; n: number; b: number }>
  >(
    `SELECT "yearPrincipal" AS y, COUNT(*)::int AS n, COUNT(DISTINCT "documentId")::int AS b
     FROM questions WHERE "periodoCode" = $1 AND "yearPrincipal" IS NOT NULL
     GROUP BY 1 ORDER BY 1`,
    periodoCode
  );

  const topEnt = async (col: string, limit: number) =>
    prisma.$queryRawUnsafe<Array<{ ent: string; n: number }>>(
      `SELECT ent, COUNT(*)::int AS n FROM questions, unnest("${col}") AS ent
       WHERE "periodoCode" = $1 GROUP BY 1 ORDER BY n DESC LIMIT ${limit}`,
      periodoCode
    );

  const [personas, lugares, conceptos] = await Promise.all([
    topEnt("entidadesPersonas", 18),
    topEnt("entidadesLugares", 12),
    topEnt("entidadesConceptos", 22),
  ]);

  const clusters = await prisma.$queryRawUnsafe<
    Array<{ cl: string; n: number; b: number; ymin: number; ymax: number }>
  >(
    `SELECT "clusterTematico" AS cl, COUNT(*)::int AS n, COUNT(DISTINCT "documentId")::int AS b,
            MIN("yearPrincipal")::int AS ymin, MAX("yearPrincipal")::int AS ymax
     FROM questions WHERE "periodoCode" = $1 AND "clusterTematico" IS NOT NULL
     GROUP BY 1 HAVING COUNT(*) >= 2 ORDER BY n DESC LIMIT 25`,
    periodoCode
  );

  // Preguntas muestra en los picos de densidad (2 por año, top 10 años).
  const peakYears = [...histogram].sort((a, b) => b.n - a.n).slice(0, 10);
  const samples: Array<{ y: number; pregunta: string }> = [];
  for (const { y } of peakYears) {
    const qs = await prisma.question.findMany({
      where: { periodoCode, yearPrincipal: y },
      select: { pregunta: true },
      take: 2,
      orderBy: { questionNumber: "asc" },
    });
    for (const q of qs)
      samples.push({ y, pregunta: q.pregunta.slice(0, 220) });
  }
  samples.sort((a, b) => a.y - b.y);

  return { histogram, personas, lugares, conceptos, clusters, samples };
}

// ─── Llamada a Claude ────────────────────────────────────────────────────────

const TOOL_NAME = "registrar_eventos";

const SYSTEM_PROMPT = `Eres un historiador experto en historia de Colombia, con dominio de la historiografía académica. Tu tarea es identificar los eventos pivote de un período histórico, anclados a la evidencia de un corpus de investigación.

El corpus son ~15.000 preguntas de investigación generadas a partir de cientos de obras académicas sobre historia colombiana. Recibirás, para un período dado:
- El histograma de años: cuántas preguntas (y de cuántas obras distintas) se anclan a cada año. La densidad refleja la atención historiográfica real del corpus.
- Las entidades más mencionadas (personas, lugares, conceptos) con sus conteos.
- Los clusters temáticos más frecuentes con su rango de años.
- Preguntas muestra de los años con mayor densidad.

## INSTRUCCIONES

1. Identifica entre 8 y 12 eventos pivote del período. Un "evento" puede ser puntual (un año) o un proceso corto (rango de años, máximo ~8 años).
2. ANCLA los eventos a la evidencia: prioriza los picos de densidad del histograma y las entidades/clusters dominantes. No inventes eventos que el corpus no respalde, salvo que sean historiográficamente imprescindibles para entender el período (máximo 2 de estos).
3. Los eventos deben caber dentro del rango del período (se te indica). Procesos que cruzan el límite: usa el tramo dentro del período.
4. "titulo": nombre canónico y corto del evento (ej. "Separación de Panamá", "Asamblea Nacional Constituyente").
5. "resumen": 1-2 frases con qué ocurrió, registro académico, sin retórica.
6. "porQueImporta": 1-2 frases sobre su significado historiográfico — conectado a lo que el corpus efectivamente pregunta (tensiones, debates, consecuencias).
7. "entidadesClave": 4-10 entidades. USA LOS NOMBRES EXACTOS que aparecen en las listas de entidades del corpus cuando existan (copia textual, incluyendo tildes); puedes añadir 1-2 que no estén en las listas si son esenciales.
8. "categoria": código de la categoría temática dominante del evento.
9. No traslapes eventos redundantes: si dos picos son el mismo proceso, un solo evento con rango.
10. Ordena los eventos cronológicamente.`;

function buildToolSpec() {
  const categoryCodes = CATEGORY_OPTIONS.map((c) => c.code);
  return {
    name: TOOL_NAME,
    description: "Registra los eventos pivote identificados para el período.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          eventos: {
            type: "array",
            minItems: 6,
            maxItems: 14,
            items: {
              type: "object",
              properties: {
                anioInicio: { type: "integer" },
                anioFin: { type: "integer" },
                titulo: { type: "string" },
                resumen: { type: "string" },
                porQueImporta: { type: "string" },
                categoria: { type: "string", enum: categoryCodes },
                entidadesClave: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 10,
                },
              },
              required: [
                "anioInicio",
                "anioFin",
                "titulo",
                "resumen",
                "porQueImporta",
                "categoria",
                "entidadesClave",
              ],
            },
          },
        },
        required: ["eventos"],
      },
    },
  };
}

async function mineEventsForPeriod(
  periodo: (typeof PERIODS)[number],
  evidence: Awaited<ReturnType<typeof buildEvidence>>
): Promise<MinedEventRaw[]> {
  const fmtEnt = (rows: Array<{ ent: string; n: number }>) =>
    rows.map((r) => `${r.ent} (${r.n})`).join(" · ");

  const userMessage = `## PERÍODO: ${periodo.nombre} (${periodo.rango}) — código ${periodo.code}

## CATEGORÍAS TEMÁTICAS VÁLIDAS
${CATEGORY_OPTIONS.map((c) => `- ${c.code}: ${c.nombre}`).join("\n")}

## HISTOGRAMA DE AÑOS (año: preguntas / obras)
${evidence.histogram.map((h) => `${h.y}: ${h.n}/${h.b}`).join("  ")}

## PERSONAS MÁS MENCIONADAS
${fmtEnt(evidence.personas)}

## LUGARES MÁS MENCIONADOS
${fmtEnt(evidence.lugares)}

## CONCEPTOS MÁS MENCIONADOS
${fmtEnt(evidence.conceptos)}

## CLUSTERS TEMÁTICOS (preguntas/obras [rango de años])
${evidence.clusters.map((c) => `- ${c.cl} — ${c.n}/${c.b} [${c.ymin}–${c.ymax}]`).join("\n")}

## PREGUNTAS MUESTRA EN PICOS DE DENSIDAD
${evidence.samples.map((s) => `[${s.y}] ${s.pregunta}`).join("\n")}

Identifica los eventos pivote del período anclados a esta evidencia.`;

  // Opus 4.7+ son "thinking models" y NO aceptan `temperature` en inferenceConfig.
  const isThinkingModel = /claude-(opus|sonnet)-(4-7|4-8|5)/.test(CLAUDE_MODEL);
  const inferenceConfig: { maxTokens: number; temperature?: number } = {
    maxTokens: 8000,
  };
  if (!isThinkingModel) inferenceConfig.temperature = 0.2;

  const command = new ConverseCommand({
    modelId: CLAUDE_MODEL,
    system: [{ text: SYSTEM_PROMPT }],
    messages: [{ role: "user", content: [{ text: userMessage }] }],
    toolConfig: {
      tools: [{ toolSpec: buildToolSpec() }],
      toolChoice: { tool: { name: TOOL_NAME } },
    },
    inferenceConfig,
  });

  const response = await bedrock.send(command);
  const toolUseBlock = response.output?.message?.content?.find(
    (block) => block.toolUse?.name === TOOL_NAME
  );
  if (!toolUseBlock?.toolUse?.input) {
    throw new Error("Claude no retornó el tool use con los eventos");
  }
  const input = toolUseBlock.toolUse.input as { eventos?: MinedEventRaw[] };
  if (!Array.isArray(input.eventos) || input.eventos.length === 0) {
    throw new Error("Respuesta sin eventos");
  }
  return input.eventos;
}

// ─── Asignación determinística de preguntas a eventos ───────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

interface CandidateQuestion {
  id: string;
  documentId: string;
  periodoCode: string;
  yearPrincipal: number | null;
  entidades: string[]; // normalizadas
}

async function loadCandidates(a: number, b: number): Promise<CandidateQuestion[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      documentId: string;
      periodoCode: string;
      yearPrincipal: number | null;
      entidadesPersonas: string[];
      entidadesLugares: string[];
      entidadesConceptos: string[];
    }>
  >(
    `SELECT id, "documentId", "periodoCode", "yearPrincipal",
            "entidadesPersonas", "entidadesLugares", "entidadesConceptos"
     FROM questions
     WHERE ("yearPrincipal" BETWEEN $1 AND $2)
        OR EXISTS (SELECT 1 FROM unnest("yearsSecondary") yy WHERE yy BETWEEN $1 AND $2)`,
    a,
    b
  );
  return rows.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    periodoCode: r.periodoCode,
    yearPrincipal: r.yearPrincipal,
    entidades: [
      ...r.entidadesPersonas,
      ...r.entidadesLugares,
      ...r.entidadesConceptos,
    ].map(normalize),
  }));
}

function assignQuestions(
  ev: MinedEventRaw,
  periodoCode: string,
  candidates: CandidateQuestion[]
) {
  const evEnts = ev.entidadesClave.map(normalize);
  const span = ev.anioFin - ev.anioInicio;
  const scored: Array<{ q: CandidateQuestion; score: number }> = [];

  for (const q of candidates) {
    let entHits = 0;
    for (const e of evEnts) if (q.entidades.includes(e)) entHits++;
    const yearInWindow =
      q.yearPrincipal != null &&
      q.yearPrincipal >= ev.anioInicio &&
      q.yearPrincipal <= ev.anioFin;
    const periodMatch = q.periodoCode === periodoCode;
    // Membresía: señal temática (entidades del evento) o, solo para eventos
    // puntuales (≤3 años), anclaje fuerte año+período. Sin esto, los procesos
    // de ventana ancha absorben todo el período por coincidencia de años y
    // aplastan a los eventos puntuales en el peso.
    const member = entHits > 0 || (span <= 3 && periodMatch && yearInWindow);
    if (!member) continue;
    const score =
      Math.min(entHits, 3) * 2 + (periodMatch ? 2 : 0) + (yearInWindow ? 1 : 0);
    scored.push({ q, score });
  }

  scored.sort((x, y) => y.score - x.score);

  const books = new Set(scored.map((s) => s.q.documentId));

  // Top preguntas con diversidad de obras: primera pasada un id por obra,
  // segunda pasada rellena hasta 14.
  const seen = new Set<string>();
  const top: string[] = [];
  for (const { q } of scored) {
    if (top.length >= 14) break;
    if (!seen.has(q.documentId)) {
      seen.add(q.documentId);
      top.push(q.id);
    }
  }
  for (const { q } of scored) {
    if (top.length >= 14) break;
    if (!top.includes(q.id)) top.push(q.id);
  }

  // Entidades más frecuentes entre las preguntas miembro (denormalizadas:
  // contamos sobre los nombres originales del evento + corpus).
  const entCount = new Map<string, number>();
  for (const { q } of scored) {
    for (const e of q.entidades) entCount.set(e, (entCount.get(e) ?? 0) + 1);
  }
  const topEntidades = [...entCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([e]) => e);

  return {
    nPreguntas: scored.length,
    nLibros: books.size,
    topEntidades,
    questionIds: top,
  };
}

function slugify(s: string): string {
  return normalize(s)
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("-");
}

// ─── Checkpoint ──────────────────────────────────────────────────────────────

type Checkpoint = Record<string, PeriodResult>;

function loadCheckpoint(): Checkpoint {
  if (FORCE || !existsSync(CHECKPOINT_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8")) as Checkpoint;
  } catch {
    return {};
  }
}

function saveCheckpoint(cp: Checkpoint) {
  mkdirSync(dirname(CHECKPOINT_PATH), { recursive: true });
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function calibrateEvents(
  periodoCode: string,
  rawEvents: MinedEventRaw[]
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  for (const ev of rawEvents) {
    const candidates = await loadCandidates(ev.anioInicio, ev.anioFin);
    const evidencia = assignQuestions(ev, periodoCode, candidates);
    events.push({
      ...ev,
      id: `${periodoCode}-${ev.anioInicio}-${slugify(ev.titulo)}`,
      evidencia: { ...evidencia, peso: 0 },
    });
  }

  // Peso normalizado dentro del período: 60% preguntas, 40% obras.
  const maxN = Math.max(1, ...events.map((e) => e.evidencia.nPreguntas));
  const maxL = Math.max(1, ...events.map((e) => e.evidencia.nLibros));
  for (const e of events) {
    e.evidencia.peso = Math.round(
      100 *
        (0.6 * (e.evidencia.nPreguntas / maxN) +
          0.4 * (e.evidencia.nLibros / maxL))
    );
  }

  events.sort((a, b) => a.anioInicio - b.anioInicio);
  return events;
}

function logEvents(events: TimelineEvent[]) {
  for (const e of events) {
    console.log(
      `  [${e.anioInicio}${e.anioFin !== e.anioInicio ? `–${e.anioFin}` : ""}] ${e.titulo} — ${e.evidencia.nPreguntas}q/${e.evidencia.nLibros}l peso=${e.evidencia.peso}`
    );
  }
}

function writeOutput(checkpoint: Checkpoint): boolean {
  const missing = PERIODS.filter((p) => !checkpoint[p.code]).map((p) => p.code);
  if (missing.length) {
    console.log(`\nFaltan períodos: ${missing.join(", ")} — re-ejecuta para completar.`);
    return false;
  }
  const output = {
    generatedAt: new Date().toISOString(),
    model: CLAUDE_MODEL,
    periods: Object.fromEntries(PERIODS.map((p) => [p.code, checkpoint[p.code]])),
  };
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 1));
  const totalEvents = PERIODS.reduce(
    (acc, p) => acc + checkpoint[p.code].events.length,
    0
  );
  console.log(
    `\n✓ ${OUTPUT_PATH} escrito — ${totalEvents} eventos en ${PERIODS.length} períodos`
  );
  return true;
}

// REASSIGN=1: recalcula la evidencia (asignación + peso) de los eventos ya
// minados en el checkpoint, sin volver a llamar al LLM. Útil al cambiar la
// regla de membresía.
async function reassign() {
  const checkpoint = loadCheckpoint();
  const codes = Object.keys(checkpoint).filter(
    (c) => !ONLY.length || ONLY.includes(c)
  );
  for (const code of codes) {
    const { events } = checkpoint[code];
    if (!events.length) continue;
    console.log(`── ${code} · recalibrando ${events.length} eventos ──`);
    checkpoint[code].events = await calibrateEvents(code, events);
    logEvents(checkpoint[code].events);
    saveCheckpoint(checkpoint);
  }
  writeOutput(checkpoint);
}

async function main() {
  if (process.env.REASSIGN === "1") {
    await reassign();
    return;
  }
  const start = Date.now();
  const checkpoint = loadCheckpoint();
  const todo = PERIODS.filter(
    (p) =>
      (!ONLY.length || ONLY.includes(p.code)) &&
      (FORCE || !checkpoint[p.code])
  );

  console.log(
    `Minería de eventos · modelo ${CLAUDE_MODEL}\n` +
      `Períodos pendientes: ${todo.map((p) => p.code).join(", ") || "(ninguno)"}\n`
  );

  for (const periodo of todo) {
    if (existsSync(STOP_FILE)) {
      console.log(`STOP_FILE detectado (${STOP_FILE}) — saliendo limpio.`);
      break;
    }

    console.log(`── ${periodo.code} · ${periodo.nombre} ──`);
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const evidence = await buildEvidence(periodo.code);
        if (evidence.histogram.length === 0) {
          console.log("  sin preguntas ancladas — período omitido");
          checkpoint[periodo.code] = { yearHistogram: [], events: [] };
          break;
        }

        const rawEvents = await mineEventsForPeriod(periodo, evidence);
        console.log(`  Claude propuso ${rawEvents.length} eventos`);

        const events = await calibrateEvents(periodo.code, rawEvents);
        checkpoint[periodo.code] = {
          yearHistogram: evidence.histogram,
          events,
        };
        logEvents(events);
        break;
      } catch (error) {
        lastError = error;
        const transient = isTransient(error);
        console.warn(
          `  intento ${attempt}/${MAX_RETRIES} falló${transient ? " (transitorio)" : ""}: ${(error as Error).message}`
        );
        if (attempt < MAX_RETRIES) await sleep(transient ? 8000 * attempt : 3000);
      }
    }
    if (!checkpoint[periodo.code]) {
      console.error(`  ✗ ${periodo.code} agotó reintentos:`, lastError);
    }
    saveCheckpoint(checkpoint);
    await sleep(PAUSE_MS);
  }

  // Ensamble final solo si están todos los períodos.
  if (writeOutput(checkpoint)) {
    console.log(`Duración total: ${Math.round((Date.now() - start) / 1000)}s`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
