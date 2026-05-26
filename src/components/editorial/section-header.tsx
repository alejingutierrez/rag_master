"use client";

import type { ReactNode } from "react";

export interface SectionHeaderProps {
  index?: string | number;
  title: ReactNode;
  caption?: ReactNode;
  action?: ReactNode;
}

export function SectionHeader({ index, title, caption, action }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 24,
        marginBottom: 28,
        paddingBottom: 16,
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
        {index != null && (
          <span
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--fg-faint)",
              letterSpacing: "0.04em",
            }}
          >
            {index}
          </span>
        )}
        <div>
          <h3
            className="display"
            style={{
              fontSize: 28,
              margin: 0,
              color: "var(--fg)",
              lineHeight: 1.1,
            }}
          >
            {title}
          </h3>
          {caption && (
            <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 4 }}>{caption}</div>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
