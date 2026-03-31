// Colores por período histórico y categoría
// Cada color tiene: bg (fondo badge), text (texto badge), border, bar (barra de grafico)
export const PERIOD_COLORS: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  PRE:     { bg: "bg-purple-500/15", text: "text-purple-200", border: "border-purple-500/40", bar: "bg-purple-400" },
  CON:     { bg: "bg-amber-500/15",  text: "text-amber-200",  border: "border-amber-500/40",  bar: "bg-amber-400" },
  COL:     { bg: "bg-orange-500/15", text: "text-orange-200", border: "border-orange-500/40", bar: "bg-orange-400" },
  PRE_IND: { bg: "bg-yellow-500/15", text: "text-yellow-200", border: "border-yellow-500/40", bar: "bg-yellow-400" },
  IND:     { bg: "bg-red-500/15",    text: "text-red-200",    border: "border-red-500/40",    bar: "bg-red-400" },
  NGR:     { bg: "bg-pink-500/15",   text: "text-pink-200",   border: "border-pink-500/40",   bar: "bg-pink-400" },
  EUC:     { bg: "bg-teal-500/15",   text: "text-teal-200",   border: "border-teal-500/40",   bar: "bg-teal-400" },
  REG:     { bg: "bg-blue-500/15",   text: "text-blue-200",   border: "border-blue-500/40",   bar: "bg-blue-400" },
  REP_LIB: { bg: "bg-green-500/15",  text: "text-green-200",  border: "border-green-500/40",  bar: "bg-green-400" },
  VIO:     { bg: "bg-rose-500/20",   text: "text-rose-200",   border: "border-rose-500/40",   bar: "bg-rose-400" },
  FN:      { bg: "bg-indigo-500/15", text: "text-indigo-200", border: "border-indigo-500/40", bar: "bg-indigo-400" },
  CNA:     { bg: "bg-orange-500/20", text: "text-orange-200", border: "border-orange-500/40", bar: "bg-orange-400" },
  C91:     { bg: "bg-violet-500/15", text: "text-violet-200", border: "border-violet-500/40", bar: "bg-violet-400" },
  SDE:     { bg: "bg-sky-500/15",    text: "text-sky-200",    border: "border-sky-500/40",    bar: "bg-sky-400" },
  POS:     { bg: "bg-emerald-500/15",text: "text-emerald-200",border: "border-emerald-500/40",bar: "bg-emerald-400" },
  TRANS:   { bg: "bg-neutral-500/15",text: "text-neutral-200",border: "border-neutral-500/40",bar: "bg-neutral-400" },
};

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  POL: { bg: "bg-blue-500/15",    text: "text-blue-200",    bar: "bg-blue-400" },
  ECO: { bg: "bg-green-500/15",   text: "text-green-200",   bar: "bg-green-400" },
  CON: { bg: "bg-red-500/15",     text: "text-red-200",     bar: "bg-red-400" },
  SOC: { bg: "bg-purple-500/15",  text: "text-purple-200",  bar: "bg-purple-400" },
  CUL: { bg: "bg-orange-500/15",  text: "text-orange-200",  bar: "bg-orange-400" },
  REL: { bg: "bg-teal-500/15",    text: "text-teal-200",    bar: "bg-teal-400" },
  TER: { bg: "bg-yellow-500/15",  text: "text-yellow-200",  bar: "bg-yellow-400" },
  MOV: { bg: "bg-pink-500/15",    text: "text-pink-200",    bar: "bg-pink-400" },
  INS: { bg: "bg-neutral-500/15", text: "text-neutral-200", bar: "bg-neutral-400" },
  HIS: { bg: "bg-amber-500/15",   text: "text-amber-200",   bar: "bg-amber-400" },
};

export function getPeriodColor(code: string) {
  return PERIOD_COLORS[code] ?? PERIOD_COLORS.TRANS;
}

export function getCategoryColor(code: string) {
  const mainCode = code.split(".")[0];
  return CATEGORY_COLORS[mainCode] ?? { bg: "bg-neutral-500/15", text: "text-neutral-200", bar: "bg-neutral-400" };
}
