// Configuración isomorfa para generación de preguntas (segura para el cliente).
// Sin imports de AWS SDK ni Prisma — usable tanto en client components como
// en route handlers / server actions.

export const MIN_QUESTIONS_COUNT = 20;
export const MAX_QUESTIONS_COUNT = 100;

/**
 * Calcula cuántas preguntas generar para un libro según su número de chunks.
 *
 * Curva (chunks → N):
 *   ≤ 50 chunks  → 20
 *   100 chunks   → 29
 *   200 chunks   → 47
 *   300 chunks   → 64
 *   400 chunks   → 82
 *   ≥ 500 chunks → 100
 */
export function computeTargetCount(chunkCount: number): number {
  const LOWER_BAND = 50;
  const UPPER_BAND = 500;
  if (chunkCount <= LOWER_BAND) return MIN_QUESTIONS_COUNT;
  if (chunkCount >= UPPER_BAND) return MAX_QUESTIONS_COUNT;
  const fraction = (chunkCount - LOWER_BAND) / (UPPER_BAND - LOWER_BAND);
  return Math.round(
    MIN_QUESTIONS_COUNT + fraction * (MAX_QUESTIONS_COUNT - MIN_QUESTIONS_COUNT)
  );
}
