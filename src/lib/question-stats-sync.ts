// Sincroniza los campos denormalizados de Question.* a partir del estado real
// de sus Deliverables. Se llama desde los endpoints que crean/cambian/borran
// Deliverable, para mantener consistencia sin triggers en DB.
//
// Campos sincronizados:
// - deliverableCount     → Deliverables con status=COMPLETE
// - completedTemplateIds → templateIds distintos con status=COMPLETE
// - lastDeliveredAt      → MAX(updatedAt) de Deliverables COMPLETE
//
// La recomputación recorre todos los Deliverables de la pregunta (típicamente 1–10
// rows). Es 1 query agregada + 1 update — barato y siempre consistente. Esto se
// prefiere a incrementar/decrementar manualmente porque elimina drift cuando hay
// múltiples writes concurrentes o errores intermedios.

import { prisma } from "./prisma";

export async function syncQuestionStats(questionId: string): Promise<void> {
  // Una sola query: cuenta + lista de templates + max(updatedAt) entre los COMPLETE.
  const agg = await prisma.deliverable.findMany({
    where: { questionId, status: "COMPLETE" },
    select: { templateId: true, updatedAt: true },
  });

  const templateIds = Array.from(new Set(agg.map((d) => d.templateId))).sort();
  const lastDeliveredAt =
    agg.length > 0
      ? new Date(Math.max(...agg.map((d) => d.updatedAt.getTime())))
      : null;

  await prisma.question.update({
    where: { id: questionId },
    data: {
      deliverableCount: agg.length,
      completedTemplateIds: templateIds,
      lastDeliveredAt,
    },
  });
}

/**
 * Helper opcional para usar en flujos batch: sincroniza un set de preguntas.
 * No es transaccional — cada pregunta se actualiza independiente para no
 * bloquear el grupo si una falla.
 */
export async function syncManyQuestionStats(questionIds: string[]): Promise<void> {
  await Promise.allSettled(questionIds.map((id) => syncQuestionStats(id)));
}
