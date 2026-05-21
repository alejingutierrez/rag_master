/**
 * Eval de calidad de respuestas (factualidad) — NO solo retrieval.
 *
 * Pipeline:
 *  1. Para cada pregunta del golden set (excepto vagas):
 *     - Ejecuta pipeline completo (retrieval + Claude Opus)
 *     - Captura respuesta generada
 *  2. Evalúa factualidad usando heurística + Claude como judge:
 *     - Para cada expected_fact: ¿aparece en la respuesta?
 *     - Detecta hechos NO soportados por los chunks recuperados (alucinaciones)
 *  3. Reporta:
 *     - % facts presentes (recall factual)
 *     - % facts inventados (alucinación)
 *     - % citas válidas
 *
 * Uso: npx tsx eval/run-answer-eval.mts --tag f8-factuality
 *      npx tsx eval/run-answer-eval.mts --tag f8-factuality --quick  # solo 10 preguntas
 */
import "./load-env";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { prisma } from "../src/lib/prisma";
import { awsConfig } from "../src/lib/aws-config";
import { runRagPipeline } from "../src/lib/rag-pipeline";
import { askClaude } from "../src/lib/claude";
import { evaluateFactsHeuristic } from "./metrics";
import type { GoldenSet } from "./types";

const argv = process.argv.slice(2);
function arg(flag: string, def?: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i === -1) return def;
  return argv[i + 1] ?? def;
}

const TAG = arg("--tag", "answer-eval");
const TABLE = (arg("--table", "chunks_v2") as "chunks" | "chunks_v2");
const QUICK = argv.includes("--quick");
const TEMPLATE_ID = arg("--template", "mini-ensayo");

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_SET_PATH = resolve(__dirname, "golden-set.json");
const RUNS_DIR = resolve(__dirname, "runs");
mkdirSync(RUNS_DIR, { recursive: true });

const bedrock = new BedrockRuntimeClient(awsConfig);
const JUDGE_MODEL = process.env.BEDROCK_JUDGE_MODEL_ID || "us.anthropic.claude-sonnet-4-6";

interface FactJudgment {
  fact: string;
  present_in_answer: boolean;
  exact_quote?: string;
  confidence: number; // 0-1
}

interface HallucinationJudgment {
  claim: string;
  supported_by_chunks: boolean;
  reason?: string;
}

interface AnswerEvalResult {
  questionId: string;
  category: string;
  question: string;
  answer: string;
  chunksUsed: number;
  citationsFound: string[];
  facts: FactJudgment[];
  factsRecall: number; // % facts encontrados
  hallucinations: HallucinationJudgment[];
  hallucinationRate: number; // % claims sin soporte
  factualityScore: number; // recall - hallucination_penalty
  latencyMs: { retrieval: number; generation: number; judge: number; total: number };
}

async function judgeFacts(answer: string, expectedFacts: string[]): Promise<FactJudgment[]> {
  if (expectedFacts.length === 0) return [];

  const systemPrompt = `Eres un evaluador estricto de respuestas factuales.
Dada una respuesta y una lista de hechos esperados, dime cuáles están presentes en la respuesta.

Un hecho está "presente" si la respuesta lo afirma claramente (incluso si está parafraseado).
Un hecho NO está presente si la respuesta lo omite o lo contradice.

Responde EXACTAMENTE en este JSON:
{"facts": [
  {"fact": "<texto exacto del hecho>", "present_in_answer": true/false, "exact_quote": "<fragmento de la respuesta que lo confirma o '' si no>", "confidence": 0.0-1.0}
]}

NO incluyas otro texto. SOLO el JSON.`;

  const userPrompt = `RESPUESTA A EVALUAR:
${answer}

HECHOS ESPERADOS:
${expectedFacts.map((f, i) => `${i + 1}. ${f}`).join("\n")}

JSON:`;

  try {
    const cmd = new ConverseCommand({
      modelId: JUDGE_MODEL,
      system: [{ text: systemPrompt }],
      messages: [{ role: "user", content: [{ text: userPrompt }] }],
      inferenceConfig: { maxTokens: 4000, temperature: 0.0 },
    });
    const res = await bedrock.send(cmd);
    const text = res.output?.message?.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed: { facts: FactJudgment[] } = JSON.parse(jsonMatch[0]);
    return parsed.facts || [];
  } catch (e) {
    console.warn(`Judge falló: ${(e as Error).message.substring(0, 100)}`);
    // Fallback a heurística
    return evaluateFactsHeuristic(answer, expectedFacts).map((h) => ({
      fact: h.fact,
      present_in_answer: h.found,
      confidence: h.confidence,
    }));
  }
}

async function judgeHallucinations(answer: string, chunks: { content: string }[]): Promise<HallucinationJudgment[]> {
  const chunksText = chunks.slice(0, 15).map((c, i) => `[#${i + 1}] ${c.content.substring(0, 800)}`).join("\n\n");

  // STAGE 1: LLM extrae solo los claims FACTUALES de la respuesta (no metáforas ni prosa estilística)
  const extractPrompt = `Eres un evaluador estricto de claims FACTUALES.
Extrae solo las afirmaciones VERIFICABLES (fechas, nombres propios, lugares, cifras, eventos concretos) de la siguiente respuesta. NO extraigas:
- Frases metafóricas o estilísticas (ej. "firmaba su propia sentencia", "su pluma no era decorativa")
- Caracterizaciones subjetivas (ej. "no era un burócrata", "era un hombre exigente")
- Opiniones del narrador
- Frases retóricas o transiciones

Solo extrae afirmaciones que un fact-checker pueda verificar (ej. "X nació en 1879", "Y fue asesinado el 9 de agosto", "Z fue director del periódico Voz").

Output JSON: {"claims": ["claim 1 verificable", "claim 2 verificable", ...]}. Máximo 12 claims. NO incluyas otro texto.`;

  let claimsToCheck: string[] = [];
  try {
    const cmd = new ConverseCommand({
      modelId: JUDGE_MODEL,
      system: [{ text: extractPrompt }],
      messages: [{ role: "user", content: [{ text: `RESPUESTA:\n${answer}\n\nJSON:` }] }],
      inferenceConfig: { maxTokens: 2000, temperature: 0.0 },
    });
    const res = await bedrock.send(cmd);
    const text = res.output?.message?.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed: { claims: string[] } = JSON.parse(jsonMatch[0]);
      claimsToCheck = (parsed.claims || []).slice(0, 12);
    }
  } catch (e) {
    console.warn(`Claim extraction falló: ${(e as Error).message.substring(0, 100)}`);
  }

  if (claimsToCheck.length === 0) {
    // Fallback heurístico si LLM extract falla
    const sentences = answer.split(/[.!?]\s+/).filter((s) => s.length > 30);
    for (const s of sentences) {
      if (/(?:19|20)\d{2}/.test(s) || /\b\d{2,}\b/.test(s)) {
        claimsToCheck.push(s.trim());
        if (claimsToCheck.length >= 8) break;
      }
    }
  }

  if (claimsToCheck.length === 0) return [];

  // STAGE 2: verificar cada claim contra los chunks
  const systemPrompt = `Eres un evaluador de alucinaciones para sistemas RAG.
Dado un conjunto de fragmentos documentales y una lista de claims factuales verificables, determina si cada claim está SOPORTADO por los fragmentos.

Un claim está soportado si los fragmentos contienen información que lo respalde — sea literal, parafraseado o inferible por razonamiento simple sobre el contenido.
Un claim NO está soportado si los fragmentos no lo mencionan en absoluto o lo contradicen.

Responde EXACTAMENTE en este JSON:
{"judgments": [
  {"claim": "<texto del claim>", "supported_by_chunks": true/false, "reason": "<breve explicación>"}
]}

NO incluyas otro texto.`;

  const userPrompt = `FRAGMENTOS DISPONIBLES:
${chunksText}

CLAIMS FACTUALES A VERIFICAR:
${claimsToCheck.map((c, i) => `${i + 1}. ${c}`).join("\n")}

JSON:`;

  try {
    const cmd = new ConverseCommand({
      modelId: JUDGE_MODEL,
      system: [{ text: systemPrompt }],
      messages: [{ role: "user", content: [{ text: userPrompt }] }],
      inferenceConfig: { maxTokens: 4000, temperature: 0.0 },
    });
    const res = await bedrock.send(cmd);
    const text = res.output?.message?.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed: { judgments: HallucinationJudgment[] } = JSON.parse(jsonMatch[0]);
    return parsed.judgments || [];
  } catch (e) {
    console.warn(`Hallucination judge falló: ${(e as Error).message.substring(0, 100)}`);
    return [];
  }
}

async function streamAnswer(question: string, chunks: { id: string; documentId: string; content: string; pageNumber: number; chunkIndex: number; similarity: number; metadata: Record<string, unknown>; documentFilename?: string }[], templateId: string): Promise<string> {
  const stream = await askClaude(question, chunks as any, 6000, { templateId });
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
        if (typeof data.text === "string") full += data.text;
      } catch { /* */ }
    }
  }
  return full;
}

async function main() {
  console.log(`\n🎯 RAG Answer Eval — tag="${TAG}"`);
  console.log(`   table=${TABLE} | template=${TEMPLATE_ID} | judge=${JUDGE_MODEL}\n`);

  const goldenSet: GoldenSet = JSON.parse(readFileSync(GOLDEN_SET_PATH, "utf8"));
  let questions = goldenSet.questions.filter((q) => !q.should_fail_elegantly);
  if (QUICK) questions = questions.slice(0, 10);
  console.log(`📚 Evaluando ${questions.length} preguntas\n`);

  const results: AnswerEvalResult[] = [];

  for (const q of questions) {
    process.stdout.write(`  [${q.id}] ${q.question.substring(0, 50)}... `);

    const t0 = Date.now();
    try {
      const tRet0 = Date.now();
      const ragResult = await runRagPipeline(q.question, {
        tableName: TABLE,
        useBM25: true,
        useReranker: true,
        useQueryExpansion: true,
        useParentExpansion: true,
        finalTopK: 25,
      });
      const tRet = Date.now() - tRet0;

      const tGen0 = Date.now();
      const answer = await streamAnswer(q.question, ragResult.chunks, TEMPLATE_ID!);
      const tGen = Date.now() - tGen0;

      const tJudge0 = Date.now();
      const [factJudgments, hallucinations] = await Promise.all([
        judgeFacts(answer, q.expected_facts),
        judgeHallucinations(answer, ragResult.chunks),
      ]);
      const tJudge = Date.now() - tJudge0;

      const citationsFound = (answer.match(/\[#(\d+)\]/g) || []);
      const factsRecall = factJudgments.length > 0
        ? factJudgments.filter((f) => f.present_in_answer).length / factJudgments.length
        : 0;
      const hallucinationRate = hallucinations.length > 0
        ? hallucinations.filter((h) => !h.supported_by_chunks).length / hallucinations.length
        : 0;
      // Factualidad combinada: recall - penalty
      const factualityScore = Math.max(0, factsRecall - 0.5 * hallucinationRate);

      const r: AnswerEvalResult = {
        questionId: q.id,
        category: q.category,
        question: q.question,
        answer,
        chunksUsed: ragResult.chunks.length,
        citationsFound,
        facts: factJudgments,
        factsRecall,
        hallucinations,
        hallucinationRate,
        factualityScore,
        latencyMs: { retrieval: tRet, generation: tGen, judge: tJudge, total: Date.now() - t0 },
      };
      results.push(r);

      const mark = factualityScore >= 0.95 ? "✅" : factualityScore >= 0.7 ? "🟡" : "❌";
      console.log(`${mark} facts=${(factsRecall * 100).toFixed(0)}% halluc=${(hallucinationRate * 100).toFixed(0)}% citations=${citationsFound.length} | ${r.latencyMs.total / 1000}s`);
    } catch (e) {
      console.log(`❌ ERROR: ${(e as Error).message.substring(0, 100)}`);
    }
  }

  // Resumen
  const avg = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const avgFactsRecall = avg(results.map((r) => r.factsRecall));
  const avgHallucination = avg(results.map((r) => r.hallucinationRate));
  const avgFactuality = avg(results.map((r) => r.factualityScore));
  const avgCitations = avg(results.map((r) => r.citationsFound.length));
  const avgLatency = avg(results.map((r) => r.latencyMs.total));

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`📊 RESUMEN — ${TAG}`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`  Facts recall    : ${(avgFactsRecall * 100).toFixed(1)}%   ← % de hechos esperados presentes`);
  console.log(`  Hallucination   : ${(avgHallucination * 100).toFixed(1)}%   ← % de claims NO soportados por chunks`);
  console.log(`  Factuality      : ${(avgFactuality * 100).toFixed(1)}%   ← target: 95%`);
  console.log(`  Citations avg   : ${avgCitations.toFixed(1)} por respuesta`);
  console.log(`  Latency avg     : ${(avgLatency / 1000).toFixed(1)}s`);

  // Por categoría
  const cats = new Set(results.map((r) => r.category));
  console.log(`\n  Por categoría:`);
  for (const c of cats) {
    const rs = results.filter((r) => r.category === c);
    console.log(`    ${c.padEnd(20)} n=${rs.length}  factuality=${(avg(rs.map(r => r.factualityScore)) * 100).toFixed(0)}%  citations=${avg(rs.map(r => r.citationsFound.length)).toFixed(1)}`);
  }

  // Casos con baja factualidad
  const lowFact = results.filter((r) => r.factualityScore < 0.7).sort((a, b) => a.factualityScore - b.factualityScore);
  if (lowFact.length > 0) {
    console.log(`\n  ⚠️  Respuestas con factualidad baja (<70%):`);
    for (const r of lowFact) {
      console.log(`     [${r.questionId}] f=${(r.factualityScore * 100).toFixed(0)}% | ${r.question.substring(0, 70)}`);
    }
  }

  const outPath = resolve(RUNS_DIR, `${TAG}-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify({
    tag: TAG,
    timestamp: new Date().toISOString(),
    summary: { avgFactsRecall, avgHallucination, avgFactuality, avgCitations, avgLatency },
    results,
  }, null, 2));
  console.log(`\n💾 Resultados: ${outPath}\n`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
