import type { GoldenQuestion, RetrievalMetrics, AnswerMetrics } from "./types";

/**
 * Determina si un chunk es pertinente para una pregunta.
 *
 * Heurística:
 *  - Cuenta cuántos expected_keywords aparecen en el chunk (case-insensitive, sin acentos).
 *  - Cuenta keywords "fuertes" = nombres propios o términos específicos largos (≥7 chars con mayúscula).
 *  - Pertinente si:
 *     - tiene ≥1 keyword fuerte (nombre propio específico)
 *     - O tiene ≥2 keywords genéricos
 */
export function isChunkRelevant(content: string, question: GoldenQuestion): boolean {
  if (question.should_fail_elegantly) return false;
  if (question.expected_keywords.length === 0) return false;

  const normContent = normalize(content);
  let matches = 0;
  let strongMatches = 0;

  for (const kw of question.expected_keywords) {
    const normKw = normalize(kw);
    if (normContent.includes(normKw)) {
      matches++;
      // Keyword "fuerte" = ≥7 chars con mayúscula (típicamente nombres propios específicos)
      // Excluye términos genéricos como "asesinato", "muertos", "presidente"
      if (kw.length >= 7 && /^[A-ZÁ-Ú]/.test(kw)) {
        strongMatches++;
      }
    }
  }

  return strongMatches >= 1 || matches >= 2;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

export function calculatePrecisionAtK(
  relevanceScores: number[],
  k: number
): number {
  if (relevanceScores.length === 0) return 0;
  const topK = relevanceScores.slice(0, k);
  if (topK.length === 0) return 0;
  const sum = topK.reduce((a, b) => a + b, 0);
  return sum / topK.length;
}

export function calculateRecallAtK(
  relevanceScores: number[],
  totalRelevantInCorpus: number,
  k: number
): number {
  if (totalRelevantInCorpus === 0) return 1; // No hay nada que recuperar
  const topK = relevanceScores.slice(0, k);
  const found = topK.reduce((a, b) => a + b, 0);
  return found / totalRelevantInCorpus;
}

/**
 * MRR: si el primer chunk relevante está en posición i, score = 1/i.
 * Si no hay ningún chunk relevante, score = 0.
 */
export function calculateMRR(relevanceScores: number[]): number {
  for (let i = 0; i < relevanceScores.length; i++) {
    if (relevanceScores[i] === 1) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

/**
 * Cuenta qué expected_facts aparecen en una respuesta.
 * Heurística simple: extraer entidades de cada fact (años, nombres, lugares) y buscar en respuesta.
 * Para preguntas factuales reales, esto se complementa con un LLM judge.
 */
export function evaluateFactsHeuristic(
  answer: string,
  expectedFacts: string[]
): { fact: string; found: boolean; confidence: number }[] {
  const normAnswer = normalize(answer);
  return expectedFacts.map((fact) => {
    const entities = extractEntities(fact);
    let matched = 0;
    for (const e of entities) {
      if (normAnswer.includes(normalize(e))) matched++;
    }
    const confidence = entities.length > 0 ? matched / entities.length : 0;
    return { fact, found: confidence >= 0.6, confidence };
  });
}

function extractEntities(fact: string): string[] {
  const entities: string[] = [];
  // Años (4 dígitos)
  const years = fact.match(/\b(1[89]\d{2}|20\d{2})\b/g) || [];
  entities.push(...years);
  // Nombres propios capitalizados (≥2 caracteres)
  const names = fact.match(/[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*/g) || [];
  entities.push(...names.filter((n) => n.length >= 4 && !/^(El|La|Los|Las|De|Del|En|Por|Para|Su|Sus|Que|Como|Una|Uno|Fue|Era|Está|Tenía|Tras|Como|Es|Han|Se)$/.test(n)));
  // Cifras significativas
  const numbers = fact.match(/\b\d{2,3}(?:[.,]?\d{3})*\b/g) || [];
  entities.push(...numbers);
  return Array.from(new Set(entities));
}

export function summarizeMetrics(metrics: RetrievalMetrics[]) {
  const n = metrics.length;
  if (n === 0) {
    return {
      avgPrecisionAt5: 0,
      avgPrecisionAt10: 0,
      avgRecallAt50: 0,
      avgMRR: 0,
      avgLatencyMs: 0,
    };
  }
  return {
    avgPrecisionAt5: metrics.reduce((a, m) => a + m.precisionAt5, 0) / n,
    avgPrecisionAt10: metrics.reduce((a, m) => a + m.precisionAt10, 0) / n,
    avgRecallAt50: metrics.reduce((a, m) => a + m.recallAt50, 0) / n,
    avgMRR: metrics.reduce((a, m) => a + m.mrr, 0) / n,
    avgLatencyMs: metrics.reduce((a, m) => a + m.latencyMs, 0) / n,
  };
}

export function summarizeByCategory(metrics: RetrievalMetrics[]) {
  const byCategory = new Map<string, RetrievalMetrics[]>();
  for (const m of metrics) {
    if (!byCategory.has(m.category)) byCategory.set(m.category, []);
    byCategory.get(m.category)!.push(m);
  }
  const result: Record<string, ReturnType<typeof summarizeMetrics> & { n: number }> = {};
  for (const [cat, list] of byCategory) {
    result[cat] = { ...summarizeMetrics(list), n: list.length };
  }
  return result;
}
