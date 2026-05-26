"use client";

import type { ReactNode } from "react";

export type StatusKind = "success" | "warning" | "danger" | "info" | "muted" | "accent";

export interface StatusDotProps {
  kind?: StatusKind;
  label: ReactNode;
}

const COLORS: Record<StatusKind, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  muted: "var(--fg-faint)",
  accent: "var(--accent)",
};

export function StatusDot({ kind = "muted", label }: StatusDotProps) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: COLORS[kind],
        }}
      />
      <span style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>{label}</span>
    </span>
  );
}
