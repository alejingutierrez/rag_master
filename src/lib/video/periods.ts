/**
 * Épocas para el Director: etiqueta + rango de años, para que el LLM elija
 * `periodCode` con criterio y para armar `periodLabel`. Orden cronológico
 * (el alfabético rompería la flecha del tiempo).
 */
import type { PeriodCode } from "./score";

export interface PeriodInfo {
  code: PeriodCode;
  label: string;
  years: string;
}

export const PERIODS: PeriodInfo[] = [
  { code: "PRE", label: "Prehispánico", years: "hasta 1499" },
  { code: "CON", label: "Conquista", years: "1499–1599" },
  { code: "COL", label: "Colonia", years: "1600–1780" },
  { code: "PRE_IND", label: "Pre-independencia", years: "1780–1809" },
  { code: "IND", label: "Independencia", years: "1810–1831" },
  { code: "NGR", label: "Nueva Granada", years: "1831–1862" },
  { code: "EUC", label: "EE.UU. de Colombia", years: "1863–1885" },
  { code: "REG", label: "Regeneración", years: "1886–1929" },
  { code: "REP_LIB", label: "República Liberal", years: "1930–1946" },
  { code: "VIO", label: "La Violencia", years: "1946–1957" },
  { code: "FN", label: "Frente Nacional", years: "1958–1974" },
  { code: "CNA", label: "Crisis y narcotráfico", years: "1974–1990" },
  { code: "C91", label: "Constitución de 1991", years: "1991–2002" },
  { code: "SDE", label: "Seguridad Democrática", years: "2002–2016" },
  { code: "POS", label: "Posconflicto", years: "2016–presente" },
  { code: "TRANS", label: "Transversal", years: "varias épocas" },
];

const BY_CODE = new Map<PeriodCode, PeriodInfo>(PERIODS.map((p) => [p.code, p]));

export function periodLabel(code: PeriodCode): string {
  return BY_CODE.get(code)?.label ?? "Transversal";
}

export function isPeriodCode(x: unknown): x is PeriodCode {
  return typeof x === "string" && BY_CODE.has(x as PeriodCode);
}

/** Lista compacta para el prompt del compositor. */
export const PERIOD_MENU = PERIODS.map((p) => `${p.code} — ${p.label} (${p.years})`).join("\n");
