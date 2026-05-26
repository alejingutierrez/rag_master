"use client";

import type { ReactNode } from "react";

export interface PillProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
}

export function Pill({ active, onClick, children, disabled }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        appearance: "none",
        background: active ? "var(--fg)" : "transparent",
        color: active ? "var(--bg)" : "var(--fg-muted)",
        border: "1px solid " + (active ? "var(--fg)" : "var(--line-strong)"),
        borderRadius: 999,
        padding: "5px 12px",
        fontSize: 11.5,
        fontFamily: "var(--font-mono)",
        cursor: disabled ? "default" : "pointer",
        letterSpacing: "0.02em",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        whiteSpace: "nowrap",
        opacity: disabled ? 0.5 : 1,
        transition: "background 140ms var(--ease-out-custom), color 140ms var(--ease-out-custom), border-color 140ms var(--ease-out-custom)",
      }}
    >
      {children}
    </button>
  );
}
