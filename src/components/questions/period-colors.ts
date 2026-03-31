// Colores por período histórico y categoría
// Usan clases que funcionan bien tanto en dark como en light mode:
// - bg: fondos con opacidad que se adaptan al contexto
// - text: colores que mantienen contraste en ambos modos
// - border: bordes sutiles
// - bar: barras sólidas para gráficos

export const PERIOD_COLORS: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  PRE:     { bg: "bg-purple-500/15", text: "text-purple-700 dark:text-purple-300", border: "border-purple-500/30", bar: "bg-purple-500" },
  CON:     { bg: "bg-amber-500/15",  text: "text-amber-700 dark:text-amber-300",  border: "border-amber-500/30",  bar: "bg-amber-500" },
  COL:     { bg: "bg-orange-500/15", text: "text-orange-700 dark:text-orange-300", border: "border-orange-500/30", bar: "bg-orange-500" },
  PRE_IND: { bg: "bg-yellow-500/15", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-500/30", bar: "bg-yellow-500" },
  IND:     { bg: "bg-red-500/15",    text: "text-red-700 dark:text-red-300",    border: "border-red-500/30",    bar: "bg-red-500" },
  NGR:     { bg: "bg-pink-500/15",   text: "text-pink-700 dark:text-pink-300",   border: "border-pink-500/30",   bar: "bg-pink-500" },
  EUC:     { bg: "bg-teal-500/15",   text: "text-teal-700 dark:text-teal-300",   border: "border-teal-500/30",   bar: "bg-teal-500" },
  REG:     { bg: "bg-blue-500/15",   text: "text-blue-700 dark:text-blue-300",   border: "border-blue-500/30",   bar: "bg-blue-500" },
  REP_LIB: { bg: "bg-green-500/15",  text: "text-green-700 dark:text-green-300",  border: "border-green-500/30",  bar: "bg-green-500" },
  VIO:     { bg: "bg-rose-500/15",   text: "text-rose-700 dark:text-rose-300",   border: "border-rose-500/30",   bar: "bg-rose-500" },
  FN:      { bg: "bg-indigo-500/15", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-500/30", bar: "bg-indigo-500" },
  CNA:     { bg: "bg-orange-500/20", text: "text-orange-700 dark:text-orange-300", border: "border-orange-500/30", bar: "bg-orange-500" },
  C91:     { bg: "bg-violet-500/15", text: "text-violet-700 dark:text-violet-300", border: "border-violet-500/30", bar: "bg-violet-500" },
  SDE:     { bg: "bg-sky-500/15",    text: "text-sky-700 dark:text-sky-300",    border: "border-sky-500/30",    bar: "bg-sky-500" },
  POS:     { bg: "bg-emerald-500/15",text: "text-emerald-700 dark:text-emerald-300",border: "border-emerald-500/30",bar: "bg-emerald-500" },
  TRANS:   { bg: "bg-neutral-500/15",text: "text-neutral-700 dark:text-neutral-300",border: "border-neutral-500/30",bar: "bg-neutral-500" },
};

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  POL: { bg: "bg-blue-500/15",    text: "text-blue-700 dark:text-blue-300",    bar: "bg-blue-500" },
  ECO: { bg: "bg-green-500/15",   text: "text-green-700 dark:text-green-300",   bar: "bg-green-500" },
  CON: { bg: "bg-red-500/15",     text: "text-red-700 dark:text-red-300",     bar: "bg-red-500" },
  SOC: { bg: "bg-purple-500/15",  text: "text-purple-700 dark:text-purple-300",  bar: "bg-purple-500" },
  CUL: { bg: "bg-orange-500/15",  text: "text-orange-700 dark:text-orange-300",  bar: "bg-orange-500" },
  REL: { bg: "bg-teal-500/15",    text: "text-teal-700 dark:text-teal-300",    bar: "bg-teal-500" },
  TER: { bg: "bg-yellow-500/15",  text: "text-yellow-700 dark:text-yellow-300",  bar: "bg-yellow-500" },
  MOV: { bg: "bg-pink-500/15",    text: "text-pink-700 dark:text-pink-300",    bar: "bg-pink-500" },
  INS: { bg: "bg-neutral-500/15", text: "text-neutral-700 dark:text-neutral-300", bar: "bg-neutral-500" },
  HIS: { bg: "bg-amber-500/15",   text: "text-amber-700 dark:text-amber-300",   bar: "bg-amber-500" },
};

export function getPeriodColor(code: string) {
  return PERIOD_COLORS[code] ?? PERIOD_COLORS.TRANS;
}

export function getCategoryColor(code: string) {
  const mainCode = code.split(".")[0];
  return CATEGORY_COLORS[mainCode] ?? { bg: "bg-neutral-500/15", text: "text-neutral-700 dark:text-neutral-300", bar: "bg-neutral-500" };
}
