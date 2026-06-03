// ─── Taxonomía compartida: períodos históricos y categorías ──────────────────
// Fuente única para questions-generator, question-filters, y enriquecimiento.

import { TIPOS_PREGUNTA, ESCALAS_GEOGRAFICAS } from "./questions-config";

export interface PeriodOption {
  code: string;
  nombre: string;
  rango: string;
}

export interface CategoryOption {
  code: string;
  nombre: string;
}

// ─── Períodos históricos ─────────────────────────────────────────────────────

export const PERIOD_OPTIONS: PeriodOption[] = [
  { code: "PRE", nombre: "Período Prehispánico", rango: "antes de 1499" },
  { code: "CON", nombre: "Conquista y Colonia Temprana", rango: "1499–1599" },
  { code: "COL", nombre: "Colonia Madura", rango: "1600–1780" },
  { code: "PRE_IND", nombre: "Crisis Colonial y Pre-Independencia", rango: "1780–1809" },
  { code: "IND", nombre: "Independencia y Gran Colombia", rango: "1810–1831" },
  { code: "NGR", nombre: "Nueva Granada y Reformas Liberales", rango: "1831–1862" },
  { code: "EUC", nombre: "Estados Unidos de Colombia y Radicalismo", rango: "1863–1885" },
  { code: "REG", nombre: "Regeneración y Hegemonía Conservadora", rango: "1886–1929" },
  { code: "REP_LIB", nombre: "República Liberal", rango: "1930–1946" },
  { code: "VIO", nombre: "La Violencia y Dictadura", rango: "1946–1957" },
  { code: "FN", nombre: "Frente Nacional", rango: "1958–1974" },
  { code: "CNA", nombre: "Crisis, Narcotráfico y Apertura", rango: "1974–1990" },
  { code: "C91", nombre: "Constitución del 91 y Escalamiento del Conflicto", rango: "1991–2002" },
  { code: "SDE", nombre: "Seguridad Democrática y Proceso de Paz", rango: "2002–2016" },
  { code: "POS", nombre: "Posconflicto y Colombia Contemporánea", rango: "2016–presente" },
  { code: "TRANS", nombre: "Transversal / Larga Duración", rango: "abarca 3+ períodos" },
];

// ─── Categorías y subcategorías ──────────────────────────────────────────────

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { code: "POL", nombre: "Política y Estado" },
  { code: "ECO", nombre: "Economía y Desarrollo" },
  { code: "CON", nombre: "Conflicto Armado y Violencia" },
  { code: "SOC", nombre: "Sociedad y Estructura Social" },
  { code: "CUL", nombre: "Cultura, Ideología y Producción Intelectual" },
  { code: "REL", nombre: "Relaciones Internacionales y Geopolítica" },
  { code: "TER", nombre: "Territorio, Región y Medio Ambiente" },
  { code: "MOV", nombre: "Movimientos Sociales y Acción Colectiva" },
  { code: "INS", nombre: "Instituciones, Derecho y Justicia" },
  { code: "HIS", nombre: "Historiografía y Metodología Histórica" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const PERIOD_CODES = PERIOD_OPTIONS.map((p) => p.code);
export const CATEGORY_CODES = CATEGORY_OPTIONS.map((c) => c.code);

/**
 * Índice cronológico de cada período: PRE=0, CON=1, ..., POS=14, TRANS=15.
 * Necesario porque ORDER BY periodoCode es alfabético y rompe la flecha temporal.
 * Códigos desconocidos caen a PERIOD_ORDER_FALLBACK (16).
 */
export const PERIOD_ORDER: Record<string, number> = Object.fromEntries(
  PERIOD_OPTIONS.map((p, i) => [p.code, i])
);
export const PERIOD_ORDER_FALLBACK = PERIOD_OPTIONS.length;

export function periodOrderOf(code: string): number {
  return PERIOD_ORDER[code] ?? PERIOD_ORDER_FALLBACK;
}

export function getPeriodByCode(code: string): PeriodOption | undefined {
  return PERIOD_OPTIONS.find((p) => p.code === code);
}

// ─── Rangos numéricos por período (para validación yearPrincipal vs período) ──
// Usados solo para detectar incoherencias post-generación. TRANS es comodín
// (cualquier año vale). PRE es histórico amplio (acepta cualquier año <= 1499).
export const PERIOD_YEAR_BOUNDS: Record<string, { start: number; end: number }> = {
  PRE: { start: -10000, end: 1499 },
  CON: { start: 1499, end: 1599 },
  COL: { start: 1600, end: 1780 },
  PRE_IND: { start: 1780, end: 1809 },
  IND: { start: 1810, end: 1831 },
  NGR: { start: 1831, end: 1862 },
  EUC: { start: 1863, end: 1885 },
  REG: { start: 1886, end: 1929 },
  REP_LIB: { start: 1930, end: 1946 },
  VIO: { start: 1946, end: 1957 },
  FN: { start: 1958, end: 1974 },
  CNA: { start: 1974, end: 1990 },
  C91: { start: 1991, end: 2002 },
  SDE: { start: 2002, end: 2016 },
  POS: { start: 2016, end: 2100 },
  TRANS: { start: -10000, end: 2100 },
};

/**
 * Encuentra el código de período al que pertenece un año dado.
 * Retorna "TRANS" si no hay match (no debería ocurrir con años razonables).
 */
export function periodForYear(year: number): string {
  for (const code of [
    "PRE", "CON", "COL", "PRE_IND", "IND", "NGR", "EUC", "REG",
    "REP_LIB", "VIO", "FN", "CNA", "C91", "SDE", "POS",
  ]) {
    const b = PERIOD_YEAR_BOUNDS[code];
    if (b && year >= b.start && year <= b.end) return code;
  }
  return "TRANS";
}

export function getCategoryByCode(code: string): CategoryOption | undefined {
  return CATEGORY_OPTIONS.find((c) => c.code === code);
}

// ─── Taxonomía analítica de entregables (construida o heredada) ───────────────

export interface DeliverableTaxonomy {
  periodoCode: string;
  periodoNombre: string;
  periodoRango: string;
  categoriaCode: string;
  categoriaNombre: string;
  subcategoriaCode?: string;
  subcategoriaNombre?: string;
  yearPrincipal: number | null;
  yearsSecondary: number[];
  periodosRelacionados: string[];
  entidadesPersonas: string[];
  entidadesLugares: string[];
  entidadesConceptos: string[];
  tipoPregunta: string | null;
  clusterTematico: string | null;
  escalaGeografica: string | null;
}

/**
 * Reconcilia el período con el año principal (mismo criterio que el generador de
 * preguntas): si el código es inválido o el año cae >5 años fuera del rango del
 * período, recalcula desde el año. TRANS y año nulo se respetan. Pura.
 */
export function reconcilePeriodo(periodoCode: string, yearPrincipal: number | null): string {
  const code = (periodoCode || "").toUpperCase();
  if (!PERIOD_CODES.includes(code)) {
    return yearPrincipal != null ? periodForYear(yearPrincipal) : "TRANS";
  }
  if (code === "TRANS" || yearPrincipal == null) return code;
  const b = PERIOD_YEAR_BOUNDS[code];
  if (b && (yearPrincipal < b.start - 5 || yearPrincipal > b.end + 5)) {
    return periodForYear(yearPrincipal);
  }
  return code;
}

function pickString(raw: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}
function toStrArray(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, max);
}
function toIntArray(v: unknown, max = 8): number[] {
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (const x of v) {
    const n = typeof x === "number" ? x : parseInt(String(x), 10);
    if (Number.isInteger(n)) out.push(n);
  }
  return out.slice(0, max);
}
function normEnum(v: unknown, allowed: readonly string[]): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase().replace(/\s+/g, "_");
  return allowed.includes(s) ? s : null;
}

/**
 * Normaliza el JSON crudo de un clasificador a una `DeliverableTaxonomy` válida.
 * Tolera camelCase y snake_case. Pura y testeable (sin red).
 */
export function normalizeTaxonomy(raw: Record<string, unknown>): DeliverableTaxonomy {
  const yRaw = raw.yearPrincipal ?? raw.anio_principal ?? raw.year_principal;
  let yearPrincipal: number | null = null;
  if (typeof yRaw === "number" && Number.isInteger(yRaw)) yearPrincipal = yRaw;
  else if (typeof yRaw === "string" && /^\d{3,4}$/.test(yRaw.trim())) yearPrincipal = parseInt(yRaw, 10);

  const periodoInput = pickString(raw, "periodoCode", "periodo_code", "periodo") ?? "";
  const periodoCode = reconcilePeriodo(periodoInput, yearPrincipal);
  const period = getPeriodByCode(periodoCode);

  let categoriaCode = (pickString(raw, "categoriaCode", "categoria_code", "categoria") ?? "").toUpperCase();
  if (!CATEGORY_CODES.includes(categoriaCode)) {
    const nombre = pickString(raw, "categoriaNombre", "categoria_nombre");
    const byName = nombre
      ? CATEGORY_OPTIONS.find((c) => c.nombre.toLowerCase() === nombre.toLowerCase())
      : undefined;
    categoriaCode = byName?.code ?? "HIS";
  }
  const category = getCategoryByCode(categoriaCode);

  const ent = (raw.entidades ?? {}) as Record<string, unknown>;

  return {
    periodoCode,
    periodoNombre: period?.nombre ?? "Transversal / Larga Duración",
    periodoRango: period?.rango ?? "abarca 3+ períodos",
    categoriaCode,
    categoriaNombre: category?.nombre ?? categoriaCode,
    subcategoriaCode: pickString(raw, "subcategoriaCode", "subcategoria_code"),
    subcategoriaNombre: pickString(raw, "subcategoriaNombre", "subcategoria_nombre"),
    yearPrincipal,
    yearsSecondary: toIntArray(raw.yearsSecondary ?? raw.anios_secundarios),
    periodosRelacionados: toStrArray(raw.periodosRelacionados ?? raw.periodos_relacionados)
      .map((c) => c.toUpperCase())
      .filter((c) => PERIOD_CODES.includes(c) && c !== periodoCode),
    entidadesPersonas: toStrArray(ent.personas ?? raw.entidadesPersonas),
    entidadesLugares: toStrArray(ent.lugares ?? raw.entidadesLugares),
    entidadesConceptos: toStrArray(ent.conceptos ?? raw.entidadesConceptos),
    tipoPregunta: normEnum(raw.tipoPregunta ?? raw.tipo_pregunta, TIPOS_PREGUNTA),
    clusterTematico: pickString(raw, "clusterTematico", "cluster_tematico") ?? null,
    escalaGeografica: normEnum(raw.escalaGeografica ?? raw.escala_geografica, ESCALAS_GEOGRAFICAS),
  };
}
