/**
 * Vocabulario compartido del archivo — tipos de pieza, lectura de searchParams,
 * orden y paginación.
 *
 * Lo consumen /archivo y /buscar para hablar exactamente el mismo idioma: los
 * mismos slugs en la URL (`?tipo=hechos`), las mismas etiquetas en pantalla y el
 * mismo criterio de orden. Todo vive en la URL para que un filtro se pueda
 * compartir y el botón atrás del navegador funcione.
 */
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import type { PublicArchivePiece } from "@/lib/public-data";

export interface ArchiveType {
  /** Valor en la URL: `?tipo=hechos`. */
  slug: string;
  /** Etiqueta que ya trae cada pieza en `piece.label` (fuente: public-data). */
  label: string;
  /** Rótulo plural para chips y facetas. */
  plural: string;
}

/** Las 7 etiquetas que produce `public-data`, en orden editorial. */
export const ARCHIVE_TYPES: ArchiveType[] = [
  { slug: "hechos", label: "Hecho", plural: "Hechos" },
  { slug: "epocas", label: "Época", plural: "Épocas" },
  { slug: "biografias", label: "Biografía", plural: "Biografías" },
  { slug: "lugares", label: "Lugar", plural: "Lugares" },
  { slug: "ideas", label: "Idea", plural: "Ideas" },
  { slug: "preguntas", label: "Pregunta", plural: "Preguntas" },
  { slug: "lecturas", label: "Lectura", plural: "Lecturas" },
];

const TYPE_BY_SLUG = new Map(ARCHIVE_TYPES.map((t) => [t.slug, t]));
const TYPE_BY_LABEL = new Map(ARCHIVE_TYPES.map((t) => [t.label, t]));

export interface ArchiveOrder {
  slug: string;
  label: string;
  /** Descripción corta para el rótulo del listado. */
  note: string;
}

export const ARCHIVE_ORDERS: ArchiveOrder[] = [
  { slug: "reciente", label: "Recientes", note: "Publicación más reciente primero" },
  { slug: "cronologico", label: "Cronológico", note: "Del hecho más antiguo al más nuevo" },
  { slug: "alfabetico", label: "A–Z", note: "Alfabético por título" },
];

export const DEFAULT_ORDER = ARCHIVE_ORDERS[0].slug;

/** Primer valor de un searchParam (Next puede entregar array si se repite). */
export function firstParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim() : "";
}

export function typeBySlug(raw: string | string[] | undefined): ArchiveType | null {
  return TYPE_BY_SLUG.get(firstParam(raw)) ?? null;
}

/** Etiqueta de pieza (`"Hecho"`) → slug de URL (`"hechos"`). */
export function typeSlugOfLabel(label: string): string {
  return TYPE_BY_LABEL.get(label)?.slug ?? "lecturas";
}

/** Código de época válido, o null. Mismo contrato que /personas?periodo=IND. */
export function validPeriod(raw: string | string[] | undefined): PeriodCode | null {
  const value = firstParam(raw);
  return value && value in PERIODS ? (value as PeriodCode) : null;
}

export function validOrder(raw: string | string[] | undefined): string {
  const value = firstParam(raw);
  return ARCHIVE_ORDERS.some((o) => o.slug === value) ? value : DEFAULT_ORDER;
}

/** Página ≥ 1 (los valores basura caen a la primera). */
export function parsePage(raw: string | string[] | undefined): number {
  const n = Number.parseInt(firstParam(raw), 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

/**
 * Año numérico a partir de la etiqueta que arma public-data ("1810",
 * "1810–1831", "45 a.C."). Sirve para el orden cronológico sin volver a la BD.
 */
export function parseYear(yearLabel: string | null): number | null {
  if (!yearLabel) return null;
  const m = yearLabel.match(/^(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  const tail = yearLabel.slice(m[0].length, m[0].length + 8);
  return /a\.?\s?c\.?/i.test(tail) ? -n : n;
}

/** Ordena una copia; "reciente" ya viene resuelto por `getRecentPublicPieces`. */
export function sortPieces(pieces: PublicArchivePiece[], order: string): PublicArchivePiece[] {
  const out = [...pieces];
  if (order === "alfabetico") {
    out.sort((a, b) => a.title.localeCompare(b.title, "es"));
  } else if (order === "cronologico") {
    out.sort((a, b) => {
      const ya = parseYear(a.yearLabel);
      const yb = parseYear(b.yearLabel);
      if (ya === null && yb === null) return a.title.localeCompare(b.title, "es");
      if (ya === null) return 1;
      if (yb === null) return -1;
      return ya - yb || a.title.localeCompare(b.title, "es");
    });
  }
  return out;
}

/** Construye una URL descartando los parámetros vacíos o en su valor por defecto. */
export function archiveHref(
  base: string,
  params: Record<string, string | number | null | undefined>,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

/** Ventana de páginas con elipsis: [1, null, 6, 7, 8, null, 12]. */
export function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current]);
  for (const d of [-1, 1]) {
    const p = current + d;
    if (p > 1 && p < total) pages.add(p);
  }
  if (current <= 3) for (const p of [2, 3, 4]) pages.add(p);
  if (current >= total - 2) for (const p of [total - 3, total - 2, total - 1]) pages.add(p);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push(null);
    out.push(p);
    prev = p;
  }
  return out;
}

/** Cuenta piezas por tipo conservando el orden editorial de `ARCHIVE_TYPES`. */
export function countByType(pieces: { label: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const piece of pieces) {
    const slug = typeSlugOfLabel(piece.label);
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return counts;
}

/** Formato de número en español (miles con punto). */
export function formatNumber(value: number): string {
  return value.toLocaleString("es-CO");
}
