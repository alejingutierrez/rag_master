/**
 * Inline button styles — minimal editorial.
 *
 * El diseño no usa border-radius en botones (sólo pills).
 * Estos estilos se aplican vía `style={primaryBtn}` para evitar
 * pelearse con el sistema legacy de variantes.
 */

import type { CSSProperties } from "react";

export const primaryBtn: CSSProperties = {
  appearance: "none",
  background: "var(--fg)",
  color: "var(--bg)",
  border: 0,
  padding: "11px 20px",
  fontSize: 13.5,
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  cursor: "pointer",
  letterSpacing: "-0.005em",
};

export const ghostBtn: CSSProperties = {
  appearance: "none",
  background: "transparent",
  color: "var(--fg)",
  border: "1px solid var(--line-strong)",
  padding: "11px 20px",
  fontSize: 13.5,
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  cursor: "pointer",
  letterSpacing: "-0.005em",
};

export const linkBtn: CSSProperties = {
  appearance: "none",
  background: "transparent",
  color: "var(--fg-muted)",
  border: 0,
  padding: 0,
  fontSize: 13,
  fontFamily: "var(--font-sans)",
  cursor: "pointer",
};

export const smallBtn: CSSProperties = {
  appearance: "none",
  background: "transparent",
  color: "var(--fg-muted)",
  border: "1px solid var(--line-strong)",
  padding: "5px 11px",
  fontSize: 11.5,
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.04em",
  cursor: "pointer",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

export const disabledStyle = (base: CSSProperties): CSSProperties => ({
  ...base,
  opacity: 0.4,
  cursor: "default",
});
