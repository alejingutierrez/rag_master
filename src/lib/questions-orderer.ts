// Ordenador narrativo-cronológico de preguntas.
//
// El script anterior (scripts/order-questions.mts) usaba Claude Opus por grupo.
// La primera versión sin LLM era determinista pero plana (alfabético + longitud).
// Esta versión combina cronología fuerte con coherencia narrativa:
//
//   - ENTRE períodos: cronológico real (PRE→POS→TRANS) usando periodoOrden.
//     ORDER BY periodoCode (alfabético) ponía C91 antes de PRE — bug crítico.
//
//   - DENTRO de cada período: greedy chain por embeddings (Cohere v4).
//     Las preguntas dentro de un mismo rango temporal se ordenan de forma
//     que cada una "fluye" a la siguiente: empezamos por la más central
//     del grupo (mayor similitud promedio al resto) y vamos saltando al
//     vecino semántico más cercano que no haya sido usado. Esto produce
//     una secuencia narrativa: temas conectados quedan adyacentes.
//
//   - Por categoría/subcategoría: orden secundario usando los mismos
//     campos (cronología → cadena interna).
//
// Embeddings: se almacenan en Question.embedding (vector 1536). Si una
// pregunta no lo tiene, ensureQuestionEmbeddings() los genera en lote y
// los persiste. El reorderer cae a un fallback determinístico si los
// embeddings no están disponibles.

import { prisma } from "./prisma";
import { generateEmbedding } from "./bedrock";
import { periodOrderOf } from "./taxonomy";

interface QRow {
  id: string;
  pregunta: string;
  questionNumber: number;
  periodoCode: string;
  periodoNombre: string;
  categoriaCode: string;
  categoriaNombre: string;
  subcategoriaCode: string;
  subcategoriaNombre: string;
}

interface QRowWithEmbedding extends QRow {
  embedding: number[] | null;
}

export interface ReorderProgress {
  dimension: "periodo" | "categoria" | "subcategoria";
  groupsProcessed: number;
  questionsUpdated: number;
}

// ─── Embedding helpers ────────────────────────────────────────────────────────

/**
 * Genera y persiste embeddings para todas las preguntas del documento que
 * aún no lo tengan. Usa Cohere v4 (search_document) — semánticamente afín a
 * los chunks ya embebidos en el mismo espacio vectorial.
 *
 * Llama a Cohere una vez por pregunta sin embedding. Para libros recién
 * generados, esto procesa ~N preguntas en paralelo limitado.
 */
export async function ensureQuestionEmbeddings(documentId?: string): Promise<{
  generated: number;
  alreadyHad: number;
}> {
  const where = documentId ? `WHERE "documentId" = '${documentId}' AND embedding IS NULL` : `WHERE embedding IS NULL`;
  const pending: Array<{ id: string; pregunta: string }> = await prisma.$queryRawUnsafe(
    `SELECT id, pregunta FROM questions ${where} ORDER BY "createdAt" ASC LIMIT 1000`
  );

  if (pending.length === 0) {
    return { generated: 0, alreadyHad: 0 };
  }

  // Concurrencia moderada para no saturar Cohere/Bedrock.
  const CONCURRENCY = 5;
  let generated = 0;

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (row) => {
        try {
          const emb = await generateEmbedding(row.pregunta, "search_document");
          // pgvector recibe el array serializado como '[1,2,3,...]'.
          const vectorLiteral = `[${emb.join(",")}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE questions SET embedding = $1::vector WHERE id = $2`,
            vectorLiteral,
            row.id
          );
          generated++;
        } catch (e) {
          console.warn(`[orderer] embedding failed for ${row.id}:`, e);
        }
      })
    );
  }

  return { generated, alreadyHad: 0 };
}

// ─── Carga de filas con embeddings ────────────────────────────────────────────

async function loadRowsWithEmbeddings(documentId?: string): Promise<QRowWithEmbedding[]> {
  // pgvector devuelve el embedding como string "[v1,v2,...]" — lo parseamos.
  const whereClause = documentId ? `WHERE "documentId" = $1` : ``;
  const params = documentId ? [documentId] : [];
  const rows: Array<{
    id: string;
    pregunta: string;
    questionNumber: number;
    periodoCode: string;
    periodoNombre: string;
    categoriaCode: string;
    categoriaNombre: string;
    subcategoriaCode: string;
    subcategoriaNombre: string;
    embedding: string | null;
  }> = await prisma.$queryRawUnsafe(
    `SELECT id, pregunta, "questionNumber", "periodoCode", "periodoNombre",
            "categoriaCode", "categoriaNombre", "subcategoriaCode", "subcategoriaNombre",
            embedding::text AS embedding
     FROM questions
     ${whereClause}`,
    ...params
  );

  return rows.map((r) => ({
    ...r,
    embedding: r.embedding ? parsePgVector(r.embedding) : null,
  }));
}

function parsePgVector(raw: string): number[] {
  // raw vendrá como '[0.1,0.2,...]'
  const inner = raw.startsWith("[") ? raw.slice(1, -1) : raw;
  return inner.split(",").map(Number);
}

// ─── Similitud coseno ─────────────────────────────────────────────────────────

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

function cosine(a: number[] | null, b: number[] | null): number {
  if (!a || !b) return 0;
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

// ─── Greedy chain narrativa + 2-opt + arranque cronológico ────────────────────

/**
 * Detecta el primer año explícito del texto y, como fallback, el siglo.
 * Devuelve { year, kind } donde kind="explicit" tiene prioridad sobre "century".
 * El kind permite que la lógica de arranque no mezcle ambas fuentes.
 */
function extractFirstYear(text: string): { year: number; kind: "explicit" | "century" } | null {
  // Año explícito (1400–2099), primer match gana.
  const yearMatch = text.match(/\b(1[4-9]\d{2}|20\d{2})\b/);
  if (yearMatch) return { year: parseInt(yearMatch[1], 10), kind: "explicit" };

  // Aproximación por siglo si no hay año.
  const centuryMatch = text.match(/\bsiglo\s+(XV{1,3}I{0,3}|XX{0,2}I{0,3})\b/i);
  if (centuryMatch) {
    const roman = centuryMatch[1].toUpperCase();
    const MAP: Record<string, number> = {
      XV: 1450, XVI: 1550, XVII: 1650, XVIII: 1750,
      XIX: 1850, XX: 1950, XXI: 2050,
    };
    if (roman in MAP) return { year: MAP[roman], kind: "century" };
  }
  return null;
}

/** Coste total de una cadena: suma de (1 − cos) entre vecinos consecutivos. */
function pathCost(chain: QRowWithEmbedding[]): number {
  let cost = 0;
  for (let i = 0; i < chain.length - 1; i++) {
    cost += 1 - cosine(chain[i].embedding, chain[i + 1].embedding);
  }
  return cost;
}

/**
 * 2-opt refinement: para cada par (i, j), si reversar el segmento [i..j]
 * reduce el coste total, se acepta. Repite hasta no mejorar más.
 *
 * Esto elimina los "saltos bruscos" que el greedy puro deja porque solo
 * mira al vecino inmediato. Complejidad O(n²) por pasada, varias pasadas
 * típicas hasta converger — para grupos de ≤30 preguntas es muy rápido.
 */
function twoOptRefine(chain: QRowWithEmbedding[]): QRowWithEmbedding[] {
  if (chain.length <= 3) return chain;

  let best = chain.slice();
  let bestCost = pathCost(best);
  let improved = true;
  const MAX_PASSES = 20; // salvaguarda contra ciclos por empates flotantes
  let passes = 0;

  while (improved && passes < MAX_PASSES) {
    improved = false;
    passes++;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const c = pathCost(candidate);
        if (c < bestCost - 1e-9) {
          best = candidate;
          bestCost = c;
          improved = true;
        }
      }
    }
  }
  return best;
}

/**
 * Ordena una lista de preguntas como una secuencia narrativa coherente.
 *
 * Pipeline:
 *   1. Arranque cronológico: si hay años detectables en el texto, empezamos
 *      por la pregunta del evento más temprano. Si no, por la "más central"
 *      (mayor similitud promedio al resto).
 *   2. Greedy chain: siguiente = la más similar a la actual entre las no usadas.
 *   3. 2-opt refinement: minimiza el coste global de la cadena (1 − cos
 *      acumulado entre vecinos), eliminando saltos bruscos del greedy puro.
 *
 * Si las preguntas no tienen embedding, cae a un orden determinístico estable
 * (subcategoría → longitud → questionNumber) — peor calidad pero nunca falla.
 */
function narrativeChain(rows: QRowWithEmbedding[]): QRowWithEmbedding[] {
  if (rows.length <= 1) return rows;

  const haveEmbeddings = rows.every((r) => r.embedding && r.embedding.length > 0);
  if (!haveEmbeddings) {
    return [...rows].sort(
      (a, b) =>
        a.subcategoriaCode.localeCompare(b.subcategoriaCode) ||
        a.pregunta.length - b.pregunta.length ||
        a.questionNumber - b.questionNumber
    );
  }

  // 1. Seleccionar pregunta de arranque.
  //    Prioridad: año EXPLÍCITO más temprano > siglo más temprano > centralidad.
  //    El siglo no compite con años explícitos: si AL MENOS UNA pregunta tiene
  //    año explícito, ignoramos los siglos para no inyectar ruido (ej: "siglo XX"
  //    → 1950 empataría artificialmente con eventos puntuales de 1950).
  const years = rows.map((r) => extractFirstYear(r.pregunta));
  const explicitYears = years.map((y) => (y?.kind === "explicit" ? y.year : null));
  const centuryYears = years.map((y) => (y?.kind === "century" ? y.year : null));
  const hasExplicit = explicitYears.some((y) => y !== null);
  const hasCentury = centuryYears.some((y) => y !== null);
  const arrangeByYear = hasExplicit || hasCentury;
  const yearsToUse = hasExplicit ? explicitYears : centuryYears;

  let bestStart = 0;
  if (arrangeByYear) {
    // Empezar por la pregunta con año detectable más temprano.
    let minYear = Infinity;
    for (let i = 0; i < rows.length; i++) {
      const y = yearsToUse[i];
      if (y !== null && y < minYear) {
        minYear = y;
        bestStart = i;
      }
    }
  } else {
    // Sin años: pregunta con mayor centralidad semántica.
    let bestScore = -Infinity;
    for (let i = 0; i < rows.length; i++) {
      let sum = 0;
      for (let j = 0; j < rows.length; j++) {
        if (i !== j) sum += cosine(rows[i].embedding, rows[j].embedding);
      }
      if (sum > bestScore) {
        bestScore = sum;
        bestStart = i;
      }
    }
  }

  // 2. Greedy chain desde bestStart.
  const used = new Set<number>();
  const order: QRowWithEmbedding[] = [];
  let current = bestStart;
  used.add(current);
  order.push(rows[current]);

  while (used.size < rows.length) {
    let bestNext = -1;
    let bestSim = -Infinity;
    for (let j = 0; j < rows.length; j++) {
      if (used.has(j)) continue;
      const sim = cosine(rows[current].embedding, rows[j].embedding);
      if (sim > bestSim) {
        bestSim = sim;
        bestNext = j;
      }
    }
    if (bestNext === -1) break;
    used.add(bestNext);
    order.push(rows[bestNext]);
    current = bestNext;
  }

  // 3. 2-opt refinement: cuando arrancamos por año, preservamos el head
  //    (es el ancla cronológica que no queremos perder).
  if (order.length <= 3) return order;
  if (arrangeByYear) {
    const head = order[0];
    const tail = twoOptRefine(order.slice(1));
    return [head, ...tail];
  }
  return twoOptRefine(order);
}

// ─── Ordenadores por dimensión ────────────────────────────────────────────────

/**
 * ordenPeriodo / temaPeriodo: dentro de cada período, greedy chain narrativa.
 */
async function orderByPeriodo(rows: QRowWithEmbedding[]): Promise<ReorderProgress> {
  const groups = new Map<string, QRowWithEmbedding[]>();
  for (const r of rows) {
    const arr = groups.get(r.periodoCode) ?? [];
    arr.push(r);
    groups.set(r.periodoCode, arr);
  }

  let updates = 0;
  for (const [, list] of groups) {
    const chained = narrativeChain(list);
    await Promise.all(
      chained.map((q, idx) =>
        prisma.question.update({
          where: { id: q.id },
          data: {
            ordenPeriodo: idx + 1,
            temaPeriodo: q.periodoNombre,
            periodoOrden: periodOrderOf(q.periodoCode),
          },
        })
      )
    );
    updates += chained.length;
  }
  return { dimension: "periodo", groupsProcessed: groups.size, questionsUpdated: updates };
}

/**
 * ordenCategoria: dentro de cada categoría, primero cronología externa
 * (periodoOrden) y dentro de cada subgrupo período, cadena narrativa.
 */
async function orderByCategoria(rows: QRowWithEmbedding[]): Promise<ReorderProgress> {
  const groups = new Map<string, QRowWithEmbedding[]>();
  for (const r of rows) {
    const arr = groups.get(r.categoriaCode) ?? [];
    arr.push(r);
    groups.set(r.categoriaCode, arr);
  }

  let updates = 0;
  for (const [, list] of groups) {
    // Partir por período cronológico, encadenar narrativo dentro, concatenar.
    const byPeriodo = new Map<string, QRowWithEmbedding[]>();
    for (const r of list) {
      const arr = byPeriodo.get(r.periodoCode) ?? [];
      arr.push(r);
      byPeriodo.set(r.periodoCode, arr);
    }
    const orderedPeriods = [...byPeriodo.keys()].sort(
      (a, b) => periodOrderOf(a) - periodOrderOf(b)
    );
    const final: QRowWithEmbedding[] = [];
    for (const p of orderedPeriods) {
      final.push(...narrativeChain(byPeriodo.get(p)!));
    }

    await Promise.all(
      final.map((q, idx) =>
        prisma.question.update({
          where: { id: q.id },
          data: {
            ordenCategoria: idx + 1,
            temaCategoria: q.categoriaNombre,
          },
        })
      )
    );
    updates += final.length;
  }
  return { dimension: "categoria", groupsProcessed: groups.size, questionsUpdated: updates };
}

/**
 * ordenSubcategoria: dentro de cada subcategoría, cronología externa
 * + cadena narrativa intra-período.
 */
async function orderBySubcategoria(rows: QRowWithEmbedding[]): Promise<ReorderProgress> {
  const groups = new Map<string, QRowWithEmbedding[]>();
  for (const r of rows) {
    const arr = groups.get(r.subcategoriaCode) ?? [];
    arr.push(r);
    groups.set(r.subcategoriaCode, arr);
  }

  let updates = 0;
  for (const [, list] of groups) {
    const byPeriodo = new Map<string, QRowWithEmbedding[]>();
    for (const r of list) {
      const arr = byPeriodo.get(r.periodoCode) ?? [];
      arr.push(r);
      byPeriodo.set(r.periodoCode, arr);
    }
    const orderedPeriods = [...byPeriodo.keys()].sort(
      (a, b) => periodOrderOf(a) - periodOrderOf(b)
    );
    const final: QRowWithEmbedding[] = [];
    for (const p of orderedPeriods) {
      final.push(...narrativeChain(byPeriodo.get(p)!));
    }

    await Promise.all(
      final.map((q, idx) =>
        prisma.question.update({
          where: { id: q.id },
          data: {
            ordenSubcategoria: idx + 1,
            temaSubcategoria: q.subcategoriaNombre,
          },
        })
      )
    );
    updates += final.length;
  }
  return { dimension: "subcategoria", groupsProcessed: groups.size, questionsUpdated: updates };
}

// ─── Entrypoint público ───────────────────────────────────────────────────────

export type ReorderDimension = "periodo" | "categoria" | "subcategoria" | "all";

export async function reorderQuestions(
  opts: { dimension?: ReorderDimension; documentId?: string } = {}
): Promise<ReorderProgress[]> {
  const dimension = opts.dimension ?? "all";

  // Asegurar que los embeddings existen antes de armar las cadenas.
  // Si no se generan (fallo de Cohere), narrativeChain cae a fallback determinístico.
  try {
    await ensureQuestionEmbeddings(opts.documentId);
  } catch (e) {
    console.warn(`[orderer] ensureQuestionEmbeddings failed:`, e);
  }

  const rows = await loadRowsWithEmbeddings(opts.documentId);
  if (rows.length === 0) return [];

  const results: ReorderProgress[] = [];
  if (dimension === "periodo" || dimension === "all") {
    results.push(await orderByPeriodo(rows));
  }
  if (dimension === "categoria" || dimension === "all") {
    results.push(await orderByCategoria(rows));
  }
  if (dimension === "subcategoria" || dimension === "all") {
    results.push(await orderBySubcategoria(rows));
  }
  return results;
}
