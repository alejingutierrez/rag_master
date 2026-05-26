"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/providers/theme-provider";

export function ThemeToggle() {
  const { mode, resolved, setMode } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Reservar el espacio para evitar layout shift sin pintar nada (hydration safe).
    return (
      <div
        aria-hidden
        style={{
          width: 78,
          height: 27,
        }}
      />
    );
  }

  const isDark = resolved === "dark";
  const next = isDark ? "light" : "dark";
  const label = isDark ? "Claro" : "Oscuro";

  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      aria-label={`Cambiar a tema ${label.toLowerCase()}`}
      title={mode === "auto" ? "Tema: sistema" : `Tema: ${mode}`}
      style={{
        appearance: "none",
        background: "transparent",
        border: "1px solid var(--line-strong)",
        padding: "5px 11px",
        fontSize: 11,
        fontFamily: "var(--font-mono)",
        color: "var(--fg-muted)",
        cursor: "pointer",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
