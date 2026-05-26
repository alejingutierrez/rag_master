"use client";

import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, hint, action }: EmptyStateProps) {
  return (
    <div
      style={{
        padding: "80px 24px",
        textAlign: "center",
        border: "1px dashed var(--line-strong)",
      }}
    >
      <div className="display" style={{ fontSize: 28, color: "var(--fg)", marginBottom: 8 }}>
        {title}
      </div>
      {hint && <div style={{ fontSize: 14, color: "var(--fg-muted)", marginBottom: 18 }}>{hint}</div>}
      {action}
    </div>
  );
}
