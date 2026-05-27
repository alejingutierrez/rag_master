import { prisma } from "./prisma";
import {
  generateQuestionsForDocument,
  computeTargetCount,
} from "./questions-generator";
import { reorderQuestions, ensureQuestionEmbeddings } from "./questions-orderer";
import { periodOrderOf } from "./taxonomy";

/**
 * Procesa generación de preguntas para documentos READY que aún no tienen preguntas.
 * Diseñado para correr dentro de `after()` — continúa aunque el cliente se desconecte.
 *
 * - Procesa documentos en paralelo (Sonnet aguanta varios concurrentes)
 * - Reintentos automáticos ante throttling (en questions-generator)
 * - Pausa corta entre ráfagas para no saturar Bedrock
 */

const INTER_DOC_PAUSE_MS = 500; // 500ms entre ráfagas concurrentes
const MAX_DOCS_PER_RUN = 60; // Procesar hasta 60 docs por invocación after()
// Configurable por env. Opus 4.7 + thinking + tool use es muy demandante para
// Bedrock. Probamos con 6 y se throttleó casi todo. Con 2 le damos respiro.
// Override: QUESTIONS_BATCH_CONCURRENCY=N para experimentar.
const CONCURRENCY = parseInt(process.env.QUESTIONS_BATCH_CONCURRENCY || "2", 10);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BatchProgress {
  generated: number;
  failed: number;
  total: number;
  remaining: number;
}

async function processOneDoc(
  doc: { id: string; filename: string },
  position: string
): Promise<"generated" | "failed"> {
  const start = Date.now();

  try {
    // Verificar que no se hayan generado preguntas mientras tanto
    const existingQuestions = await prisma.question.count({
      where: { documentId: doc.id },
    });
    if (existingQuestions > 0) {
      console.log(`[questions-batch] ${doc.filename} — already has questions, skipping`);
      return "generated";
    }

    const chunks = await prisma.chunk.findMany({
      where: { documentId: doc.id },
      select: { content: true, pageNumber: true, chunkIndex: true },
      orderBy: { chunkIndex: "asc" },
    });

    if (chunks.length === 0) {
      console.warn(`[questions-batch] ${doc.filename} — no chunks, skipping`);
      return "failed";
    }

    // N adaptativo por libro: depende de la cantidad de chunks.
    const targetCount = computeTargetCount(chunks.length);

    const questions = await generateQuestionsForDocument(chunks, doc.filename, {
      targetCount,
    });

    // Guardar preguntas
    await prisma.question.deleteMany({ where: { documentId: doc.id } });

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    await prisma.question.createMany({
      data: questions.map((q, idx) => ({
        id: `q_${now}_${idx}_${Math.random().toString(36).slice(2, 8)}`,
        documentId: doc.id,
        questionNumber: q.questionNumber,
        pregunta: q.pregunta,
        periodoCode: q.periodoCode,
        periodoNombre: q.periodoNombre,
        periodoRango: q.periodoRango,
        categoriaCode: q.categoriaCode,
        categoriaNombre: q.categoriaNombre,
        subcategoriaCode: q.subcategoriaCode,
        subcategoriaNombre: q.subcategoriaNombre,
        periodosRelacionados: q.periodosRelacionados,
        categoriasRelacionadas: q.categoriasRelacionadas,
        yearPrincipal: q.yearPrincipal,
        yearsSecondary: q.yearsSecondary,
        entidadesPersonas: q.entidadesPersonas,
        entidadesLugares: q.entidadesLugares,
        entidadesConceptos: q.entidadesConceptos,
        tipoPregunta: q.tipoPregunta,
        clusterTematico: q.clusterTematico,
        hipotesisImplicita: q.hipotesisImplicita,
        escalaGeografica: q.escalaGeografica,
        justificacion: q.justificacion,
        batchId,
        targetCount,
        periodoOrden: periodOrderOf(q.periodoCode),
      })),
    });

    // Embeddings (Cohere v4) para greedy chain narrativa dentro de cada período.
    try {
      await ensureQuestionEmbeddings(doc.id);
    } catch (e) {
      console.warn(`[questions-batch] embeddings failed for ${doc.filename}:`, e);
    }

    // Reorden narrativo: greedy chain dentro de cada período + cronología externa.
    try {
      await reorderQuestions({ documentId: doc.id });
    } catch (e) {
      console.warn(`[questions-batch] reorder failed for ${doc.filename}:`, e);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `[questions-batch] ✅ ${doc.filename} — ${questions.length}/${targetCount} questions (${chunks.length} chunks) in ${elapsed}s ${position}`
    );
    return "generated";
  } catch (error) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(
      `[questions-batch] ❌ ${doc.filename} — error after ${elapsed}s:`,
      error instanceof Error ? error.message : error
    );
    return "failed";
  }
}

export async function processQuestionsBatch(): Promise<BatchProgress> {
  // Encontrar documentos READY sin preguntas
  const pendingDocs = await prisma.document.findMany({
    where: { status: "READY", questions: { none: {} } },
    select: { id: true, filename: true },
    orderBy: { createdAt: "asc" },
    take: MAX_DOCS_PER_RUN,
  });

  const totalPending = await prisma.document.count({
    where: { status: "READY", questions: { none: {} } },
  });

  if (pendingDocs.length === 0) {
    return { generated: 0, failed: 0, total: 0, remaining: 0 };
  }

  console.log(
    `[questions-batch] Starting batch: ${pendingDocs.length} docs (${totalPending} total pending), N=adaptive, concurrency=${CONCURRENCY}`
  );

  let generated = 0;
  let failed = 0;

  // Procesar en ráfagas de CONCURRENCY docs en paralelo
  for (let i = 0; i < pendingDocs.length; i += CONCURRENCY) {
    const chunk = pendingDocs.slice(i, i + CONCURRENCY);
    const positions: string[] = chunk.map(
      (_doc: { id: string; filename: string }, idx: number) =>
        `[${i + idx + 1}/${pendingDocs.length}]`
    );

    const results = await Promise.all(
      chunk.map(
        (doc: { id: string; filename: string }, idx: number) =>
          processOneDoc(doc, positions[idx])
      )
    );

    for (const r of results) {
      if (r === "generated") generated++;
      else failed++;
    }

    // Pausa corta entre ráfagas para no saturar Bedrock
    if (i + CONCURRENCY < pendingDocs.length) {
      await sleep(INTER_DOC_PAUSE_MS);
    }
  }

  const remaining = totalPending - generated - failed;
  console.log(
    `[questions-batch] Batch complete: ${generated} generated, ${failed} failed, ${remaining} remaining`
  );

  return { generated, failed, total: pendingDocs.length, remaining };
}
