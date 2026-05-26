/**
 * Design tokens — datos de dominio (períodos, categorías) sin Ant Design.
 * Estos tokens son la fuente de verdad para componentes Crónica.
 */

export type PeriodCode =
  | "PRE"
  | "CON"
  | "COL"
  | "PRE_IND"
  | "IND"
  | "NGR"
  | "EUC"
  | "REG"
  | "REP_LIB"
  | "VIO"
  | "FN"
  | "CNA"
  | "C91"
  | "SDE"
  | "POS"
  | "TRANS";

export interface PeriodInfo {
  code: PeriodCode;
  slug: string; // kebab-case para CSS var
  label: string;
  short: string;
  yearRange: string;
}

export const PERIODS: Record<PeriodCode, PeriodInfo> = {
  PRE: { code: "PRE", slug: "pre", label: "Prehispánico", short: "PRE", yearRange: "antes 1500" },
  CON: { code: "CON", slug: "con", label: "Conquista", short: "CON", yearRange: "1500–1550" },
  COL: { code: "COL", slug: "col", label: "Colonia", short: "COL", yearRange: "1550–1810" },
  PRE_IND: { code: "PRE_IND", slug: "pre-ind", label: "Pre-independencia", short: "P.IND", yearRange: "1781–1810" },
  IND: { code: "IND", slug: "ind", label: "Independencia", short: "IND", yearRange: "1810–1830" },
  NGR: { code: "NGR", slug: "ngr", label: "Nueva Granada", short: "NGR", yearRange: "1830–1858" },
  EUC: { code: "EUC", slug: "euc", label: "Estados Unidos de Colombia", short: "EUC", yearRange: "1858–1886" },
  REG: { code: "REG", slug: "reg", label: "Regeneración", short: "REG", yearRange: "1886–1903" },
  REP_LIB: { code: "REP_LIB", slug: "rep-lib", label: "República Liberal", short: "R.LIB", yearRange: "1930–1946" },
  VIO: { code: "VIO", slug: "vio", label: "La Violencia", short: "VIO", yearRange: "1946–1958" },
  FN: { code: "FN", slug: "fn", label: "Frente Nacional", short: "FN", yearRange: "1958–1974" },
  CNA: { code: "CNA", slug: "cna", label: "Crisis y narcotráfico", short: "C.N.", yearRange: "1974–1991" },
  C91: { code: "C91", slug: "c91", label: "Constitución de 1991", short: "C91", yearRange: "1991–2002" },
  SDE: { code: "SDE", slug: "sde", label: "Seguridad Democrática", short: "S.D.", yearRange: "2002–2010" },
  POS: { code: "POS", slug: "pos", label: "Posconflicto", short: "POS", yearRange: "2010–presente" },
  TRANS: { code: "TRANS", slug: "trans", label: "Transversal", short: "TRA", yearRange: "—" },
};

export type CategoryCode =
  | "POL"
  | "ECO"
  | "CON"
  | "SOC"
  | "CUL"
  | "REL"
  | "TER"
  | "MOV"
  | "INS"
  | "HIS";

export interface CategoryInfo {
  code: CategoryCode;
  slug: string;
  label: string;
  short: string;
}

export const CATEGORIES: Record<CategoryCode, CategoryInfo> = {
  POL: { code: "POL", slug: "pol", label: "Política", short: "POL" },
  ECO: { code: "ECO", slug: "eco", label: "Economía", short: "ECO" },
  CON: { code: "CON", slug: "con", label: "Conflicto", short: "CON" },
  SOC: { code: "SOC", slug: "soc", label: "Sociedad", short: "SOC" },
  CUL: { code: "CUL", slug: "cul", label: "Cultura", short: "CUL" },
  REL: { code: "REL", slug: "rel", label: "Relaciones internacionales", short: "REL" },
  TER: { code: "TER", slug: "ter", label: "Territorio", short: "TER" },
  MOV: { code: "MOV", slug: "mov", label: "Movimientos sociales", short: "MOV" },
  INS: { code: "INS", slug: "ins", label: "Instituciones", short: "INS" },
  HIS: { code: "HIS", slug: "his", label: "Historiografía", short: "HIS" },
};

/** Convierte código de período (PRE, IND, etc.) a slug CSS (pre, ind, etc.). */
export function periodSlug(code: string): string {
  const info = PERIODS[code as PeriodCode];
  return info?.slug ?? "trans";
}

export function categorySlug(code: string): string {
  const info = CATEGORIES[code as CategoryCode];
  return info?.slug ?? "ins";
}

export function periodInfo(code: string): PeriodInfo | undefined {
  return PERIODS[code as PeriodCode];
}

export function categoryInfo(code: string): CategoryInfo | undefined {
  return CATEGORIES[code as CategoryCode];
}

/** CSS var del color de período. Ej. periodCssVar("IND") → "var(--color-period-ind)" */
export function periodCssVar(code: string): string {
  return `var(--color-period-${periodSlug(code)})`;
}

export function categoryCssVar(code: string): string {
  return `var(--color-category-${categorySlug(code)})`;
}
