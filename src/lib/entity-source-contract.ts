import type { SourceRef } from "@/lib/source-ref";
import type { StructuredData } from "@/lib/typology-schemas";

const EXPECTED_STRUCTURED_TYPES: Record<string, string[]> = {
  person: ["Persona"],
  place: ["Lugar"],
  concept: ["Concepto", "Institución"],
};

function foldedTokens(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !["de", "del", "la", "las", "los", "y"].includes(token));
}

function compatibleNames(expected: string, actual: string): boolean {
  const a = new Set(foldedTokens(expected));
  const b = new Set(foldedTokens(actual));
  if (!a.size || !b.size) return false;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap++;
  const coverage = overlap / Math.min(a.size, b.size);
  return overlap >= Math.min(2, a.size, b.size) && coverage >= 0.75;
}

export interface SourceContractResult {
  ok: boolean;
  error?: string;
}

/**
 * Evita que una producción pedida para una entidad termine creando otra
 * persona/lugar por deriva del modelo o por evidencia ambigua.
 */
export function validateEntitySourceContract(
  ref: SourceRef | null,
  structured: StructuredData | null | undefined,
): SourceContractResult {
  if (!ref || ref.kind !== "entidad") return { ok: true };
  if (!structured || structured.typology !== "entidad") {
    return { ok: false, error: `La ficha de "${ref.label}" no produjo una entidad estructurada.` };
  }
  const sourceType = ref.key.split(":")[0];
  const allowed = EXPECTED_STRUCTURED_TYPES[sourceType];
  if (!allowed) return { ok: false, error: `Tipo de entidad de origen desconocido: ${sourceType}.` };
  if (!allowed.includes(structured.tipo)) {
    return {
      ok: false,
      error: `La ficha solicitada para "${ref.label}" (${sourceType}) derivó en ${structured.tipo}: "${structured.titulo}".`,
    };
  }
  if (!compatibleNames(ref.label, structured.titulo)) {
    return {
      ok: false,
      error: `La ficha solicitada para "${ref.label}" derivó en otra identidad: "${structured.titulo}".`,
    };
  }
  return { ok: true };
}
