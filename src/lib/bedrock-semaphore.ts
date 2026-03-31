/**
 * Semáforo simple para limitar concurrencia de llamadas a Bedrock Claude.
 *
 * Bedrock tiene rate limits por modelo (tokens/min, requests/min).
 * Opus con 80KB de contexto es especialmente propenso a throttling.
 * Este semáforo serializa las llamadas para evitar que chat, deliverables
 * y batch questions compitan simultáneamente por el mismo rate limit.
 */

// Solo 1 llamada a Claude Opus a la vez.
// Embeddings (Cohere) tienen rate limits separados y no usan este semáforo.
const MAX_CONCURRENT = 1;

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
 * Returns the current queue depth (requests waiting for a slot).
 */
export function getQueueDepth(): number {
  return queue.length;
}

/**
 * Returns true if a slot is immediately available.
 */
export function isAvailable(): boolean {
  return activeCount < MAX_CONCURRENT;
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
