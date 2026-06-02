/**
 * Extracción robusta de JSON desde respuestas de Claude. Puro (sin dependencias
 * de red), para poder testearlo sin tocar Bedrock.
 *
 * Mejora sobre el `text.match(/\{[\s\S]*\}/)` del planner (deep-research-planner.ts):
 * hace balance real de llaves respetando strings escapados, así no captura de más
 * cuando el modelo añade prosa después del objeto.
 */

/** Devuelve el primer objeto JSON balanceado del texto. Lanza si no hay uno válido. */
export function extractJsonObject(text: string): string {
  // Preferir un bloque cercado ```json ... ``` si existe.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;

  const start = candidate.indexOf("{");
  if (start === -1) {
    throw new Error(`Respuesta sin objeto JSON: ${text.slice(0, 160)}`);
  }

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  throw new Error("Objeto JSON no balanceado en la respuesta");
}

/** Extrae y parsea. Lanza con mensaje claro si falla. */
export function parseJsonObject<T = unknown>(text: string): T {
  const raw = extractJsonObject(text);
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    throw new Error(`JSON inválido: ${(e as Error).message}`);
  }
}
