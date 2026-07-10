/**
 * Color con significado: cada epoca tiene su tinta. En el repo esto vive dividido
 * (CSS `--p-*` vs `getPeriodColor()` en design-tokens.ts) y los dos sets divergen.
 * Aqui unificamos en UNA fuente autoritativa (basada en getPeriodColor, ajustada
 * para ser legible sobre blanco Y sobre negro). Al integrar (Fase C) el Director
 * leera de aqui para que el video y el sitio usen el mismo color.
 */
import type { PeriodCode, Personality, SceneBg } from "../score/schema";

const ERA_HEX: Record<PeriodCode, string> = {
  PRE: "#b45309", CON: "#9a3412", COL: "#8a3d10", PRE_IND: "#a16207",
  IND: "#1e40af", NGR: "#1d4ed8", EUC: "#2563eb", REG: "#9a3018",
  REP_LIB: "#0f766e", VIO: "#a51d1d", FN: "#4f46e5", CNA: "#7c3aed",
  C91: "#db2777", SDE: "#0891b2", POS: "#059669", TRANS: "#6b7280",
};

export const PERIOD_LABEL: Record<PeriodCode, string> = {
  PRE: "Prehispánico", CON: "Conquista", COL: "Colonia", PRE_IND: "Pre-independencia",
  IND: "Independencia", NGR: "Nueva Granada", EUC: "EE.UU. de Colombia", REG: "Regeneración",
  REP_LIB: "República Liberal", VIO: "La Violencia", FN: "Frente Nacional",
  CNA: "Crisis y narcotráfico", C91: "Constitución de 1991", SDE: "Seguridad Democrática",
  POS: "Posconflicto", TRANS: "Transversal",
};

export interface Palette {
  bg: string; bgDark: string;
  ink: string; inkOnDark: string;
  inkSoft: string; inkSoftOnDark: string;
  inkFaint: string;
  line: string; lineOnDark: string;
  era: string; accent: string;
}

export function eraColor(code: PeriodCode) {
  return ERA_HEX[code] ?? ERA_HEX.TRANS;
}

export function paletteFor(code: PeriodCode, _personality: Personality): Palette {
  const era = eraColor(code);
  return {
    bg: "#f7f6f4", bgDark: "#0a0a0a",
    ink: "#0a0a0a", inkOnDark: "#f7f6f4",
    inkSoft: "#525252", inkSoftOnDark: "#b9b6b0",
    inkFaint: "#a3a3a3",
    line: "#e4e2de", lineOnDark: "#2a2a2a",
    era, accent: era,
  };
}

export const inkFor = (p: Palette, bg: SceneBg) =>
  bg === "color" ? "#ffffff" : bg === "dark" ? p.inkOnDark : p.ink;
export const inkSoftFor = (p: Palette, bg: SceneBg) =>
  bg === "color" ? "rgba(255,255,255,0.72)" : bg === "dark" ? p.inkSoftOnDark : p.inkSoft;
export const lineFor = (p: Palette, bg: SceneBg) =>
  bg === "color" ? "rgba(255,255,255,0.34)" : bg === "dark" ? p.lineOnDark : p.line;
export const bgColorFor = (p: Palette, bg: SceneBg) =>
  bg === "color" ? p.era : bg === "dark" ? p.bgDark : p.bg;
/** Acento legible segun el fondo: en campo de color el acento es blanco (el campo ya ES el color). */
export const accentFor = (p: Palette, bg: SceneBg) => (bg === "color" ? "#ffffff" : p.accent);
