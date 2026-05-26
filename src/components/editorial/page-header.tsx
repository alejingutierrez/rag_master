"use client";

import type { ReactNode } from "react";

export interface PageHeaderProps {
  label?: string;
  title: ReactNode;
  italic?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ label, title, italic, subtitle, action }: PageHeaderProps) {
  return (
    <section style={{ padding: "72px 56px 36px", maxWidth: 1320 }}>
      {label && (
        <div className="label" style={{ marginBottom: 16 }}>
          {label}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 32,
          flexWrap: "wrap",
        }}
      >
        <h1
          className="display"
          style={{
            fontSize: "clamp(48px, 6vw, 80px)",
            margin: 0,
            color: "var(--fg)",
            maxWidth: 900,
            lineHeight: 1.0,
          }}
        >
          {title}
          {italic && (
            <>
              {" "}
              <span className="display-italic" style={{ color: "var(--fg-muted)" }}>
                {italic}
              </span>
            </>
          )}
        </h1>
        {action}
      </div>
      {subtitle && (
        <p
          className="serif"
          style={{
            fontSize: 18,
            color: "var(--fg-muted)",
            margin: "20px 0 0",
            maxWidth: 640,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      )}
    </section>
  );
}
