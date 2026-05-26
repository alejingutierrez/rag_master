"use client";

import { PERIODS, type PeriodCode } from "@/lib/design-tokens";

export interface PeriodCoverageDatum {
  code: string;
  count: number;
}

export interface PeriodCoverageListProps {
  data: PeriodCoverageDatum[];
  onPeriod?: (code: string) => void;
}

/** Orden canónico de los 15 períodos (excluye TRANS). */
const ORDER: PeriodCode[] = [
  "PRE",
  "CON",
  "COL",
  "PRE_IND",
  "IND",
  "NGR",
  "EUC",
  "REG",
  "REP_LIB",
  "VIO",
  "FN",
  "CNA",
  "C91",
  "SDE",
  "POS",
];

export function PeriodCoverageList({ data, onPeriod }: PeriodCoverageListProps) {
  const byCode = new Map(data.map((d) => [d.code, d.count]));
  const counts = ORDER.map((c) => byCode.get(c) ?? 0);
  const max = Math.max(1, ...counts);

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {ORDER.map((code, i) => {
        const p = PERIODS[code];
        const c = counts[i];
        const pct = (c / max) * 100;
        const n = String(i + 1).padStart(2, "0");
        return (
          <li
            key={code}
            style={{ borderTop: i === 0 ? 0 : "1px solid var(--line)" }}
          >
            <button
              type="button"
              onClick={() => onPeriod?.(code)}
              style={{
                width: "100%",
                appearance: "none",
                background: "transparent",
                border: 0,
                padding: "12px 0",
                cursor: "pointer",
                textAlign: "left",
                display: "grid",
                gridTemplateColumns: "28px 1fr 140px 40px",
                gap: 18,
                alignItems: "center",
                transition: "background 120ms var(--ease-out-custom)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-muted)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--fg-faint)", paddingLeft: 4 }}
              >
                {n}
              </span>
              <div>
                <div style={{ fontSize: 14, color: "var(--fg)", lineHeight: 1.2 }}>
                  {p.label}
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 10.5, color: "var(--fg-subtle)", marginTop: 2 }}
                >
                  {p.yearRange}
                </div>
              </div>
              <div
                style={{
                  height: 2,
                  background: "var(--bg-muted)",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${pct}%`,
                    background: `var(--p-${p.slug})`,
                    transition: "width 500ms var(--ease-out-custom)",
                  }}
                />
              </div>
              <div
                className="mono num"
                style={{
                  fontSize: 13,
                  color: "var(--fg)",
                  textAlign: "right",
                  paddingRight: 4,
                }}
              >
                {c}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
