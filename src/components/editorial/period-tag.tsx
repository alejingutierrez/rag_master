"use client";

import { PERIODS, type PeriodCode } from "@/lib/design-tokens";

export interface PeriodTagProps {
  code: string;
  size?: "sm" | "md";
  /** Mostrar el nombre del período en lugar del rango de años. */
  showName?: boolean;
}

/**
 * PeriodTag — dot 6px + texto del período.
 * En el sistema editorial v2 los períodos nunca se rellenan; sólo el dot lleva color.
 */
export function PeriodTag({ code, size = "md", showName = false }: PeriodTagProps) {
  const p = PERIODS[code as PeriodCode];
  if (!p) return null;
  const dot = size === "sm" ? 5 : 6;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-mono)",
        fontSize: size === "sm" ? 10.5 : 11.5,
        color: "var(--fg-muted)",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: dot,
          height: dot,
          borderRadius: "50%",
          background: `var(--p-${p.slug})`,
          flexShrink: 0,
        }}
      />
      <span>{showName ? p.label : p.yearRange}</span>
    </span>
  );
}
