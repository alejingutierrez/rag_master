export interface HistoricalNonLikenessPolicy {
  isPerson: boolean;
  allow?: boolean;
  force?: boolean;
  identityVerified: number;
  identityRequired: number;
}

/** Decide de forma auditable cuándo una portada debe evitar afirmar un rostro. */
export function shouldUseHistoricalNonLikeness(
  policy: HistoricalNonLikenessPolicy,
): boolean {
  if (!policy.isPerson) return false;
  if (policy.force) return true;
  return Boolean(
    policy.allow && policy.identityVerified < policy.identityRequired,
  );
}
