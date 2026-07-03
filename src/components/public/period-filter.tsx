"use client";

import { PERIODS, getPeriodColor, type PeriodCode } from "@/lib/design-tokens";

/**
 * Filtro de época con el mismo lenguaje que el selector de la línea de tiempo:
 * pills mono con punto de color por período, activo relleno. Compartido por los
 * índices (fichas + entidades + ensayos) para una sola gramática visual.
 */
export function PeriodFilter({
  periods,
  active,
  onSelect,
}: {
  periods: string[];
  active: string | null;
  onSelect: (code: string | null) => void;
}) {
  const pill = (code: string | null, label: string, dot: string | null) => {
    const isActive = active === code;
    return (
      <button
        key={code ?? "__all"}
        type="button"
        onClick={() => onSelect(code)}
        style={{
          appearance: "none",
          background: isActive ? "var(--fg)" : "transparent",
          color: isActive ? "var(--bg)" : "var(--fg-muted)",
          border: "1px solid " + (isActive ? "var(--fg)" : "var(--line-strong)"),
          borderRadius: 999,
          padding: "5px 11px",
          fontSize: 11.5,
          fontFamily: "var(--font-mono)",
          cursor: "pointer",
          letterSpacing: "0.02em",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          whiteSpace: "nowrap",
          transition: "border-color 120ms var(--ease-out-custom)",
        }}
      >
        {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot }} />}
        {label}
      </button>
    );
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {pill(null, "Todas", null)}
      {periods.map((code) => pill(code, PERIODS[code as PeriodCode]?.label ?? code, getPeriodColor(code)))}
    </div>
  );
}
