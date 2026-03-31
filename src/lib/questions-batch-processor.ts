import { prisma } from "./prisma";
import { generateQuestionsForDocument } from "./questions-generator";

/**
 * Procesa generación de preguntas para documentos READY que aún no tienen preguntas.
 * Diseñado para correr dentro de `after()` — continúa aunque el cliente se desconecte.
 *
 * - Procesa documentos secuencialmente (Bedrock rate limits)
 * - Reintentos automáticos ante throttling
 * - Pausa reducida entre documentos (Sonnet es más rápido que Opus)
 */

const INTER_DOC_PAUSE_MS = 2000; // 2s entre docs (Sonnet es más tolerante)
const MAX_DOCS_PER_RUN = 20; // Procesar hasta 20 docs por invocación after()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BatchProgress {
  generated: number;
  failed: number;
  total: number;
  remaining: number;
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
    `[questions-batch] Starting batch: ${pendingDocs.length} docs (${totalPending} total pending)`
  );

  let generated = 0;
  let failed = 0;

  for (let i = 0; i < pendingDocs.length; i++) {
    const doc = pendingDocs[i];
    const start = Date.now();

    try {
      // Verificar que no se hayan generado preguntas mientras tanto
      const existingQuestions = await prisma.question.count({
        where: { documentId: doc.id },
      });
      if (existingQuestions > 0) {
        console.log(`[questions-batch] ${doc.filename} — already has questions, skipping`);
        generated++;
        continue;
      }

      const chunks = await prisma.chunk.findMany({
        where: { documentId: doc.id },
        select: { content: true, pageNumber: true, chunkIndex: true },
        orderBy: { chunkIndex: "asc" },
      });

      if (chunks.length === 0) {
        console.warn(`[questions-batch] ${doc.filename} — no chunks, skipping`);
        failed++;
        continue;
      }

      const questions = await generateQuestionsForDocument(chunks, doc.filename);

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
          justificacion: q.justificacion,
          batchId,
        })),
      });

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(
        `[questions-batch] ✅ ${doc.filename} — ${questions.length} questions in ${elapsed}s [${i + 1}/${pendingDocs.length}]`
      );
      generated++;
    } catch (error) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.error(
        `[questions-batch] ❌ ${doc.filename} — error after ${elapsed}s:`,
        error instanceof Error ? error.message : error
      );
      failed++;
    }

    // Pausa entre documentos para no saturar Bedrock
    if (i < pendingDocs.length - 1) {
      await sleep(INTER_DOC_PAUSE_MS);
    }
  }

  const remaining = totalPending - generated - failed;
  console.log(
    `[questions-batch] Batch complete: ${generated} generated, ${failed} failed, ${remaining} remaining`
  );

  return { generated, failed, total: pendingDocs.length, remaining };
}
