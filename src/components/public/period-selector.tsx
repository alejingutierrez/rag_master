"use client";

import { PERIODS, type PeriodCode } from "@/lib/design-tokens";

// Mismo orden y años de inicio que la línea de tiempo (sin TRANS).
const ORDER: PeriodCode[] = [
  "PRE", "CON", "COL", "PRE_IND", "IND", "NGR", "EUC", "REG",
  "REP_LIB", "VIO", "FN", "CNA", "C91", "SDE", "POS",
];
const YEAR_START: Record<string, number> = {
  PRE: 1480, CON: 1499, COL: 1600, PRE_IND: 1780, IND: 1810, NGR: 1831,
  EUC: 1863, REG: 1886, REP_LIB: 1930, VIO: 1946, FN: 1958, CNA: 1974,
  C91: 1991, SDE: 2002, POS: 2016,
};

/**
 * Selector de época IDÉNTICO al de la línea de tiempo (etiquetas de año + barras
 * + pills), usado como filtro en los índices. Muestra el espectro completo; las
 * épocas sin resultados quedan atenuadas y no clicables. Click en la activa =
 * quitar el filtro (Todas).
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
  const sel = selected && ORDER.includes(selected as PeriodCode) ? (selected as PeriodCode) : null;
  const selInfo = sel ? PERIODS[sel] : null;

  const click = (code: PeriodCode) => {
    if (!present.has(code)) return;
    onSelect(selected === code ? null : code);
  };

  return (
    <div className="ps-wrap">
      <div className="ps-head">
        <div className="label">Filtrar por época</div>
        <div
          className="mono"
          style={{ fontSize: 12, color: selInfo ? `var(--p-${selInfo.slug})` : "var(--fg-muted)", letterSpacing: "0.04em", fontWeight: 600 }}
        >
          {selInfo
            ? `${String(ORDER.indexOf(sel!) + 1).padStart(2, "0")} · ${selInfo.label} · ${selInfo.yearRange}`
            : "Todas las épocas"}
        </div>
      </div>

      {/* Etiquetas de año */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        {ORDER.map((code) => {
          const active = code === selected;
          const has = present.has(code);
          return (
            <div
              key={code}
              className="mono num"
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 10,
                color: active ? `var(--p-${PERIODS[code].slug})` : has ? "var(--fg-subtle)" : "var(--fg-faint)",
                fontWeight: active ? 600 : 400,
                opacity: has ? 1 : 0.4,
              }}
            >
              {YEAR_START[code]}
            </div>
          );
        })}
      </div>

      {/* Barras */}
      <div style={{ display: "flex", gap: 4, alignItems: "flex-start", marginBottom: 14 }}>
        {ORDER.map((code) => {
          const p = PERIODS[code];
          const active = code === selected;
          const has = present.has(code);
          return (
            <button
              key={code}
              type="button"
              onClick={() => click(code)}
              disabled={!has}
              title={has ? `${p.label} · ${p.yearRange}` : `${p.label} · sin resultados`}
              aria-label={p.label}
              style={{
                flex: 1,
                height: active ? 28 : 12,
                background: active ? `var(--p-${p.slug})` : has ? "var(--bg-muted)" : "var(--line)",
                border: 0,
                padding: 0,
                cursor: has ? "pointer" : "default",
                opacity: has ? 1 : 0.5,
                transition: "all 200ms var(--ease-out-custom)",
              }}
              onMouseEnter={(e) => {
                if (has && !active) e.currentTarget.style.background = "var(--fg-faint)";
              }}
              onMouseLeave={(e) => {
                if (has && !active) e.currentTarget.style.background = "var(--bg-muted)";
              }}
            />
          );
        })}
      </div>

      {/* Pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" onClick={() => onSelect(null)} style={pillStyle(selected === null)}>
          Todas
        </button>
        {ORDER.filter((c) => present.has(c)).map((code) => {
          const p = PERIODS[code];
          return (
            <button key={code} type="button" onClick={() => click(code)} style={pillStyle(code === selected)}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: `var(--p-${p.slug})` }} />
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    appearance: "none",
    background: active ? "var(--fg)" : "transparent",
    color: active ? "var(--bg)" : "var(--fg-muted)",
    border: "1px solid " + (active ? "var(--fg)" : "var(--line-strong)"),
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
  };
}
