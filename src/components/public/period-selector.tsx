"use client";

import type { PeriodCode } from "@/lib/design-tokens";
import { PeriodRibbon } from "@/components/public/period-ribbon";

// Orden cronológico canónico (sin TRANS), idéntico al de la línea de tiempo.
const ORDER: PeriodCode[] = [
  "PRE", "CON", "COL", "PRE_IND", "IND", "NGR", "EUC", "REG",
  "REP_LIB", "VIO", "FN", "CNA", "C91", "SDE", "POS",
];

/**
 * Filtro de época de los índices (épocas · personas · ensayos · lugares · ideas).
 * Es la cinta cronológica compartida ([[PeriodRibbon]]) en modo "filter": muestra
 * SOLO las épocas presentes en los resultados, en orden; clic en la activa la
 * quita (Todas). Misma pieza visual que la línea de tiempo → un solo sistema.
 */
export function PeriodSelector({
  present,
  selected,
  onSelect,
}: {
  present: Set<string>;
  selected: string | null;
  onSelect: (code: string | null) => void;
}) {
  const order = ORDER.filter((c) => present.has(c));
  if (order.length === 0) return null;
  return (
    <PeriodRibbon
      order={order}
      selected={selected}
      onSelect={onSelect}
      label="Filtrar por época"
      mode="filter"
    />
  );
}
