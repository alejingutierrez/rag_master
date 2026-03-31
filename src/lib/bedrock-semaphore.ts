/**
 * Semáforo simple para limitar concurrencia de llamadas a Bedrock Claude.
 *
 * Bedrock tiene rate limits por modelo (tokens/min, requests/min).
 * Opus con 80KB de contexto es especialmente propenso a throttling.
 * Este semáforo serializa las llamadas para evitar que chat, deliverables
 * y batch questions compitan simultáneamente por el mismo rate limit.
 */

// 2 concurrent: permite 1 embedding + 1 Claude simultáneamente,
// pero no 3+ requests compitiendo por rate limit
const MAX_CONCURRENT = 2;

let activeCount = 0;
const queue: Array<() => void> = [];

/**
 * Adquiere un slot en el semáforo. Espera si no hay slots disponibles.
 */
function acquire(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++;
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    queue.push(() => {
      activeCount++;
      resolve();
    });
  });
}

/**
 * Libera un slot en el semáforo.
 */
function release(): void {
  activeCount--;
  const next = queue.shift();
  if (next) next();
}

/**
 * Ejecuta una función con el semáforo adquirido.
 * Agrega jitter aleatorio (0-3s) antes de ejecutar para evitar
 * que requests encolados golpeen Bedrock todos al mismo instante.
 */
export async function withBedrockSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();

  // Jitter aleatorio para desacoplar requests concurrentes
  const jitter = Math.random() * 3000;
  await new Promise((r) => setTimeout(r, jitter));

  try {
    return await fn();
  } finally {
    release();
  }
}
