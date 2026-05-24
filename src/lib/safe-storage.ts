/**
 * Wrapper seguro sobre localStorage:
 * - try/catch en read/write (Safari ITP, modo privado, QuotaExceeded)
 * - JSON parse/stringify
 * - SSR-safe
 * - genera ids únicos resistentes a colisiones
 */

export function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeSet(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    // QuotaExceededError o storage bloqueado
    console.warn(`[safeStorage] no se pudo guardar ${key}:`, err);
    return false;
  }
}

export function safeRemove(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * ID corto y razonablemente único: timestamp base36 + random.
 * Mejor que Math.random().toString(36).slice(2) para colisiones cross-tab.
 */
export function uid(prefix = ""): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${t}${r}` : `${t}${r}`;
}
