"use client";

export interface StatProps {
  label: string;
  value: string | number;
  hint?: string;
  delta?: string | number;
}

export function Stat({ label, value, hint, delta }: StatProps) {
  const display = typeof value === "number" ? value.toLocaleString("es-CO") : value;
  return (
    <div style={{ paddingTop: 4 }}>
      <div className="label" style={{ marginBottom: 14 }}>
        {label}
      </div>
      <div
        className="display num"
        style={{
          fontSize: 56,
          lineHeight: 1.0,
          letterSpacing: "-0.03em",
          color: "var(--fg)",
        }}
      >
        {display}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          marginTop: 12,
        }}
      >
        {hint && <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>{hint}</div>}
        {delta != null && delta !== "" && (
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              color: "var(--accent)",
              letterSpacing: "0.04em",
              whiteSpace: "nowrap",
            }}
          >
            +{delta}/7d
          </div>
        )}
      </div>
    </div>
  );
}
