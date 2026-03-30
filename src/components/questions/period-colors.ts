// Colores por período histórico y categoría
export const PERIOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PRE:     { bg: "bg-purple-900/30", text: "text-purple-300", border: "border-purple-700" },
  CON:     { bg: "bg-amber-900/30",  text: "text-amber-300",  border: "border-amber-700" },
  COL:     { bg: "bg-orange-900/30", text: "text-orange-300", border: "border-orange-700" },
  PRE_IND: { bg: "bg-yellow-900/30", text: "text-yellow-300", border: "border-yellow-700" },
  IND:     { bg: "bg-red-900/30",    text: "text-red-300",    border: "border-red-700" },
  NGR:     { bg: "bg-pink-900/30",   text: "text-pink-300",   border: "border-pink-700" },
  EUC:     { bg: "bg-teal-900/30",   text: "text-teal-300",   border: "border-teal-700" },
  REG:     { bg: "bg-blue-900/30",   text: "text-blue-300",   border: "border-blue-700" },
  REP_LIB: { bg: "bg-green-900/30",  text: "text-green-300",  border: "border-green-700" },
  VIO:     { bg: "bg-rose-900/40",   text: "text-rose-300",   border: "border-rose-700" },
  FN:      { bg: "bg-indigo-900/30", text: "text-indigo-300", border: "border-indigo-700" },
  CNA:     { bg: "bg-orange-900/40", text: "text-orange-300", border: "border-orange-700" },
  C91:     { bg: "bg-violet-900/30", text: "text-violet-300", border: "border-violet-700" },
  SDE:     { bg: "bg-sky-900/30",    text: "text-sky-300",    border: "border-sky-700" },
  POS:     { bg: "bg-emerald-900/30",text: "text-emerald-300",border: "border-emerald-700" },
  TRANS:   { bg: "bg-neutral-800",   text: "text-neutral-300",border: "border-neutral-600" },
};

export const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  POL: { bg: "bg-blue-500/20",    text: "text-blue-300" },
  ECO: { bg: "bg-green-500/20",   text: "text-green-300" },
  CON: { bg: "bg-red-500/20",     text: "text-red-300" },
  SOC: { bg: "bg-purple-500/20",  text: "text-purple-300" },
  CUL: { bg: "bg-orange-500/20",  text: "text-orange-300" },
  REL: { bg: "bg-teal-500/20",    text: "text-teal-300" },
  TER: { bg: "bg-yellow-500/20",  text: "text-yellow-300" },
  MOV: { bg: "bg-pink-500/20",    text: "text-pink-300" },
  INS: { bg: "bg-neutral-500/20", text: "text-neutral-300" },
  HIS: { bg: "bg-amber-500/20",   text: "text-amber-300" },
};

export function getPeriodColor(code: string) {
  return PERIOD_COLORS[code] ?? PERIOD_COLORS.TRANS;
}

export function getCategoryColor(code: string) {
  const mainCode = code.split(".")[0];
  return CATEGORY_COLORS[mainCode] ?? { bg: "bg-neutral-500/20", text: "text-neutral-300" };
}
