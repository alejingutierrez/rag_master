import { periodOrderOf } from "@/lib/taxonomy";

export type EntityTemporalType = "persona" | "lugar" | "idea";

/**
 * Evidencia temporal aportada por una pregunta para una entidad.
 *
 * Las ideas sí heredan `periodosRelacionados`: son procesos e instituciones que
 * suelen atravesar más de una época. Personas y lugares conservan únicamente el
 * período principal para evitar que una mención contextual ensucie sus filtros.
 */
export function entityPeriodEvidence(
  type: EntityTemporalType,
  primaryPeriod: string | null | undefined,
  relatedPeriods: readonly string[],
): string[] {
  return [
    ...new Set(
      type === "idea"
        ? [primaryPeriod, ...relatedPeriods]
        : [primaryPeriod],
    ),
  ].filter((period): period is string => Boolean(period));
}

/**
 * Selecciona hasta seis épocas sustentadas. La principal siempre entra; una
 * secundaria exige al menos dos preguntas y evidencia equivalente al 25% de la
 * moda principal. Así se conserva transversalidad real sin convertir cada
 * mención incidental en una época del concepto.
 */
export function selectDenoisedEntityPeriods(input: {
  primaryPeriod: string | null;
  primaryCount: number;
  evidenceCounts: ReadonlyMap<string, number>;
  maxPeriods?: number;
}): string[] {
  const maxPeriods = Math.max(1, input.maxPeriods ?? 6);
  const threshold = Math.max(2, Math.ceil(0.25 * input.primaryCount));
  const secondary = [...input.evidenceCounts.entries()]
    .filter(
      ([period, count]) =>
        period !== "TRANS" &&
        period !== input.primaryPeriod &&
        count >= threshold,
    )
    .sort((a, b) => b[1] - a[1] || periodOrderOf(a[0]) - periodOrderOf(b[0]))
    .slice(0, input.primaryPeriod ? maxPeriods - 1 : maxPeriods)
    .map(([period]) => period);

  return [...(input.primaryPeriod ? [input.primaryPeriod] : []), ...secondary]
    .sort((a, b) => periodOrderOf(a) - periodOrderOf(b));
}

/** Conserva el override curado como principal sin superar el máximo público. */
export function applyPrimaryPeriodOverride(
  periods: readonly string[],
  primaryPeriod: string | null,
  maxPeriods = 6,
): string[] {
  if (!primaryPeriod) return [...periods].slice(0, maxPeriods);
  return [primaryPeriod, ...periods.filter((period) => period !== primaryPeriod)]
    .slice(0, maxPeriods)
    .sort((a, b) => periodOrderOf(a) - periodOrderOf(b));
}
