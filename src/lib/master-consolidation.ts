/**
 * Consolidación de preguntas → preguntas-madre.
 *
 * Fuente canónica de: tipos, rúbrica de la compuerta, prompts (síntesis / merge /
 * compuerta), la curva del dial y las funciones de persistencia no-destructiva.
 *
 * Diseño completo: docs/consolidacion-preguntas-madre.md
 *
 * Grano de consolidación = período × categoría (validado empíricamente: las
 * fronteras de subcategoría NO siguen la semántica). La subcategoría queda como
 * metadato de la hija, no como muro.
 */
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";
import { withBedrockSemaphore } from "./bedrock-semaphore";
import { generateEmbedding } from "./bedrock";
import { prisma } from "./prisma";

const bedrock = new BedrockRuntimeClient(awsConfig);
const CLAUDE_MODEL =
  process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-7";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ChildQuestion {
  id: string;
  pregunta: string;
  hip?: string | null; // hipotesisImplicita
  tipo?: string | null; // tipoPregunta
  subcat?: string | null; // subcategoriaNombre
  libro?: string | null; // filename del documento fuente
}

export interface TesisEnTension {
  tesis: string;
  questionId?: string;
  libro?: string;
}

export interface MasterDraft {
  pregunta: string;
  problemaSubyacente: string;
  tesisEnTension: TesisEnTension[];
  tipoPregunta?: string | null;
  escalaGeografica?: string | null;
  childIds: string[];
}

export type GateVeredicto = "PASA" | "BORDERLINE" | "PARAGUAS";

export interface GateResult {
  G1: boolean; // objeto, no postura
  G2: boolean; // pregunta, no rótulo
  G3: boolean; // ≥2 tesis rivales
  G4: boolean; // acotada / respondible
  G5: boolean; // cohesión
  score: number; // 0..5
  veredicto: GateVeredicto;
  razon: string;
  comoPartir?: string; // si PARAGUAS
}

export interface BlockSpec {
  period: string;
  cat: string;
  n: number;
  k: number; // objetivo de madres (dial)
}

// ─── El dial ─────────────────────────────────────────────────────────────────
// masters(n) = n / (1 + c·ln n). Default c=1.15 ("medio"). Tope 300/período se
// aplica al sumar los bloques de un período, no por bloque.
export function mastersFor(n: number, c = 1.15): number {
  if (n <= 1) return n;
  return Math.max(1, Math.round(n / (1 + c * Math.log(n))));
}

// ─── La compuerta (rúbrica validada calibrada + a ciegas) ────────────────────
export const GATE_RUBRIC = `Rúbrica de 5 tests (0/1 cada uno). PASA si score>=4 Y G1=1.
- G1 (objeto vs postura): las hijas comparten un OBJETO histórico concreto (ley, proceso, actor, evento), no solo una postura/dominio.
- G2 (pregunta vs rótulo): formula una tesis disputable ("¿por qué...?"), no una etiqueta ("el impacto de X").
- G3 (contraste real): hay >=2 tesis RIVALES entre las hijas que la madre obliga a confrontar.
- G4 (acotada): se responde con la evidencia de las hijas, no exige "toda la historia de X".
- G5 (cohesión): las hijas son temáticamente cercanas, no unidas solo por una etiqueta ancha.
Veredicto: PASA (>=4 y G1=1) | BORDERLINE (=3) | PARAGUAS (<3 o G1=0).`;

const childBlock = (qs: ChildQuestion[]) =>
  qs
    .map(
      (q) =>
        `- [${q.id}] (${q.tipo ?? "?"} · ${q.subcat ?? "?"} · ${q.libro ?? "?"}) ${q.pregunta}` +
        (q.hip ? `\n    hip: ${q.hip}` : "")
    )
    .join("\n");

export function buildSynthPrompt(qs: ChildQuestion[], b: BlockSpec): string {
  return `Eres un historiador especializado en historia de Colombia con exigencia académica.
Tienes ${qs.length} preguntas de investigación del bloque "${b.period} × ${b.cat}", provenientes de muchos libros distintos.

Tarea: sintetiza ~${b.k} PREGUNTAS-MADRE (puedes desviarte si el material lo exige; nunca fuerces).
Cada pregunta-madre agrupa preguntas-hija que interrogan el MISMO problema histórico CRUZANDO libros y subcategorías, y está escrita para SOSTENER LA TENSIÓN entre las visiones rivales de esos libros (más contrastada, no más genérica).

Reglas:
- Agrupa por OBJETO histórico (ley, proceso, actor, evento), no por postura vaga.
- Cada madre: una pregunta nítida y disputable + el problema subyacente + 2-4 tesis en tensión (citando questionId y libro) + los childIds que agrupa.
- NO fuerces: si una pregunta va sola, déjala como madre de 1 hija. Si dos cosas distintas, sepáralas.
- Toda hija debe quedar asignada a >=1 madre (puede colgar de 2 si aplica).

PREGUNTAS-HIJA:
${childBlock(qs)}

Devuelve SOLO JSON: {"masters":[{"pregunta","problemaSubyacente","tesisEnTension":[{"tesis","questionId","libro"}],"tipoPregunta","escalaGeografica","childIds":[]}]}`;
}

export function buildMergePrompt(cands: MasterDraft[], b: BlockSpec): string {
  return `Eres un historiador. Estas son ${cands.length} preguntas-madre candidatas del bloque "${b.period} × ${b.cat}", generadas por shards separados — habrá duplicados o solapamientos cross-shard.

Tarea: fusiona las que interrogan el MISMO problema histórico (uniendo sus childIds y sus tesis en tensión) hasta ~${b.k} madres. NO fundas objetos distintos (eso embota): si dudas, déjalas separadas. Reescribe la pregunta de las fusionadas para que sostenga el contraste combinado.

CANDIDATAS:
${JSON.stringify(cands, null, 1)}

Devuelve SOLO JSON con la misma forma: {"masters":[...]}`;
}

export function buildGatePrompt(masters: MasterDraft[], b: BlockSpec): string {
  return `Eres un evaluador historiográfico adversarial. Aplica esta rúbrica a cada pregunta-madre del bloque "${b.period} × ${b.cat}". Sé escéptico: marca PARAGUAS las que agrupan objetos dispares bajo una etiqueta ancha.

${GATE_RUBRIC}

MADRES:
${masters.map((m, i) => `#${i} ${m.pregunta}\n   problema: ${m.problemaSubyacente}\n   tesis: ${m.tesisEnTension.map((t) => t.tesis).join(" | ")}\n   #hijas: ${m.childIds.length}`).join("\n")}

Devuelve SOLO JSON: {"evaluaciones":[{"i":0,"G1":true,"G2":true,"G3":true,"G4":true,"G5":true,"score":5,"veredicto":"PASA","razon":"...","comoPartir":""}]}`;
}

// ─── LLM (camino de producción / daemon incremental) ─────────────────────────
export async function converseJSON<T>(user: string, maxTokens = 8000): Promise<T> {
  const command = new ConverseCommand({
    modelId: CLAUDE_MODEL,
    system: [
      {
        text:
          "Eres un historiador de Colombia, riguroso y académico. Respondes ÚNICAMENTE con JSON válido, sin texto adicional ni markdown.",
      },
    ],
    messages: [{ role: "user", content: [{ text: user }] }],
    inferenceConfig: { maxTokens },
  });
  const res = await withBedrockSemaphore(() => bedrock.send(command));
  const text =
    res.output?.message?.content?.map((c) => ("text" in c ? c.text : "")).join("") ?? "";
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json) as T;
}

export async function synthesizeBlock(qs: ChildQuestion[], b: BlockSpec) {
  return converseJSON<{ masters: MasterDraft[] }>(buildSynthPrompt(qs, b));
}
export async function gateMasters(masters: MasterDraft[], b: BlockSpec) {
  return converseJSON<{ evaluaciones: (GateResult & { i: number })[] }>(
    buildGatePrompt(masters, b)
  );
}

// ─── Persistencia (no-destructiva) ───────────────────────────────────────────
// Inserta una madre + sus links (m:n). `questions` NO se muta. Calcula embedding.
// NO escribe a prod salvo que el caller lo invoque explícitamente (ver loader).
export async function persistMaster(
  m: MasterDraft,
  gate: GateResult | undefined,
  b: BlockSpec,
  periodoOrden: number,
  runId: string,
  childMeta: Map<string, { libro?: string | null }>
): Promise<string> {
  const books = new Set(
    m.childIds.map((id) => childMeta.get(id)?.libro).filter(Boolean)
  );
  const created = await prisma.masterQuestion.create({
    data: {
      periodoCode: b.period,
      periodoOrden,
      categoriaCode: b.cat,
      pregunta: m.pregunta,
      problemaSubyacente: m.problemaSubyacente,
      tesisEnTension: m.tesisEnTension as unknown as object,
      tipoPregunta: m.tipoPregunta ?? null,
      escalaGeografica: m.escalaGeografica ?? null,
      gateScore: gate?.score ?? 0,
      gateReasons: (gate ?? {}) as unknown as object,
      status: "DRAFT",
      childCount: m.childIds.length,
      bookCount: books.size,
      runId,
    },
    select: { id: true },
  });

  // Embedding de la madre (pgvector vía SQL crudo; Prisma no lo soporta).
  try {
    const emb = await generateEmbedding(m.pregunta, "search_document");
    await prisma.$executeRawUnsafe(
      `UPDATE master_questions SET embedding = $1::vector WHERE id = $2`,
      `[${emb.join(",")}]`,
      created.id
    );
  } catch {
    /* embedding opcional; no bloquea */
  }

  // Links m:n. isPrimary lo decide el caller (por ahora todos primary=true para
  // la madre con más afinidad; en bulk marcamos la primera asignación).
  if (m.childIds.length) {
    await prisma.questionMasterLink.createMany({
      data: m.childIds.map((qid, idx) => ({
        questionId: qid,
        masterId: created.id,
        isPrimary: idx === 0,
      })),
      skipDuplicates: true,
    });
  }
  return created.id;
}
