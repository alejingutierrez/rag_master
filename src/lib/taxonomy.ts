// ─── Taxonomía compartida: períodos históricos y categorías ──────────────────
// Fuente única para questions-generator, question-filters, y enriquecimiento.

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

export function getPeriodByCode(code: string): PeriodOption | undefined {
  return PERIOD_OPTIONS.find((p) => p.code === code);
}

export function getCategoryByCode(code: string): CategoryOption | undefined {
  return CATEGORY_OPTIONS.find((c) => c.code === code);
}
