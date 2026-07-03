/**
 * EL ANCLA — terna común que ordena y wikifica todo el sitio público.
 *
 * Cada pieza publicada puede anclarse a: ÉPOCA (periodoCode + rango),
 * AÑO(S) relevante(s), y ENTIDADES segmentadas (personas / lugares / ideas).
 *
 * Este dato YA se computa por pieza y vive en `metadata.atelier.taxonomy`
 * (DeliverableTaxonomy). Aquí lo resolvemos en TIEMPO DE LECTURA, con el mismo
 * criterio que `getSeo`: preferimos lo que ya está en `structuredData`, y si no,
 * caemos a la taxonomía / a la pregunta origen. NO se escribe en prod.
 *
 * Con el ancla resuelta, el orden cronológico (época→año), los filtros y las
 * relaciones entidad↔pieza salen todos del mismo lugar. Módulo puro, sin red.
 */
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import type { StructuredData } from "@/lib/typology-schemas";
import type { DeliverableTaxonomy } from "@/lib/taxonomy";

export interface ContentAnchor {
  /** Código de período canónico (PRE…TRANS) o null. */
  periodCode: string | null;
  /** Rango del período en el orden declarado (0=PRE … 15=TRANS; 98 si desconocido). */
  periodoOrden: number;
  /** Año representativo para el orden cronológico (inicio). Puede ser negativo (a.C.). */
  anio: number | null;
  /** Año de fin, si la pieza cubre un rango. */
  anioFin: number | null;
  /** Entidades segmentadas — la base de la wikización. */
  personas: string[];
  lugares: string[];
  ideas: string[];
}

/** Orden canónico de los períodos, tal como se declaran en PERIODS. */
const PERIOD_ORDER: string[] = Object.keys(PERIODS);

/** Rango de un período para orden cronológico. Desconocido/null → 98 (al final). */
export function periodRank(code?: string | null): number {
  if (!code) return 98;
  const i = PERIOD_ORDER.indexOf(code);
  return i === -1 ? 98 : i;
}

/** Primer año de 3–4 dígitos dentro de un string ("1863–1885" → 1863). */
function firstYear(s?: string | null): number | null {
  if (!s) return null;
  const m = s.match(/-?\d{3,4}/);
  return m ? parseInt(m[0], 10) : null;
}

/** Par [inicio, fin] a partir de un rango legible ("1863–1885", "2016–presente"). */
function rangeYears(r?: string | null): [number | null, number | null] {
  if (!r) return [null, null];
  const m = r.match(/-?\d{3,4}/g);
  if (!m || m.length === 0) return [null, null];
  return [parseInt(m[0], 10), m[1] ? parseInt(m[1], 10) : null];
}

/** Año de inicio del período (para desempatar piezas sin año propio). */
export function periodStartYear(code?: string | null): number | null {
  if (!code) return null;
  return firstYear(PERIODS[code as PeriodCode]?.yearRange);
}

function nonEmpty(...lists: Array<string[] | undefined | null>): string[] {
  for (const l of lists) {
    if (Array.isArray(l) && l.length > 0) return l;
  }
  return [];
}

/**
 * Resuelve el ancla de una pieza combinando (en orden de preferencia):
 * su `structuredData`, su `taxonomy` (metadata.atelier.taxonomy) y, para ensayos
 * ligados a una pregunta del batch, el período/año de esa pregunta.
 */
export function resolveAnchor(args: {
  structured?: StructuredData | null;
  taxonomy?: DeliverableTaxonomy | null;
  fallbackPeriodo?: string | null;
  fallbackYear?: number | null;
}): ContentAnchor {
  const s = args.structured ?? null;
  const tax = args.taxonomy ?? null;

  const periodCode =
    s?.periodoCode ?? tax?.periodoCode ?? args.fallbackPeriodo ?? null;

  // ── Año(s) ──
  let anio: number | null = null;
  let anioFin: number | null = null;
  if (s?.typology === "hecho") {
    anio = s.anioInicio ?? null;
    anioFin = s.anioFin ?? null;
  } else if (s?.typology === "epoca") {
    const [a, b] = rangeYears(s.rango);
    anio = a;
    anioFin = b;
  }
  if (anio == null) {
    anio = tax?.yearPrincipal ?? args.fallbackYear ?? periodStartYear(periodCode);
  }

  // ── Entidades segmentadas (la taxonomía es la fuente rica; la ficha completa) ──
  const selfPersona =
    s?.typology === "entidad" && s.tipo === "Persona" ? [s.titulo] : [];
  const selfLugar =
    s?.typology === "entidad" && s.tipo === "Lugar" ? [s.titulo] : [];
  const selfIdea =
    s?.typology === "entidad" && (s.tipo === "Concepto" || s.tipo === "Institución")
      ? [s.titulo]
      : [];

  const personas = nonEmpty(
    tax?.entidadesPersonas,
    s?.typology === "hecho" ? s.protagonistas : undefined,
    selfPersona,
  );
  const lugares = nonEmpty(
    tax?.entidadesLugares,
    s?.typology === "hecho" ? s.lugares : undefined,
    selfLugar,
  );
  const ideas = nonEmpty(tax?.entidadesConceptos, selfIdea);

  return {
    periodCode,
    periodoOrden: periodRank(periodCode),
    anio,
    anioFin,
    personas,
    lugares,
    ideas,
  };
}

/**
 * Comparador cronológico canónico: primero por época (orden declarado), luego por
 * año de inicio, luego alfabético. Úsalo para ordenar cualquier lista pública.
 */
export function byChronology<T extends { anchor: ContentAnchor; titulo: string }>(
  a: T,
  b: T,
): number {
  if (a.anchor.periodoOrden !== b.anchor.periodoOrden) {
    return a.anchor.periodoOrden - b.anchor.periodoOrden;
  }
  const ay = a.anchor.anio ?? periodStartYear(a.anchor.periodCode) ?? 9999;
  const by = b.anchor.anio ?? periodStartYear(b.anchor.periodCode) ?? 9999;
  if (ay !== by) return ay - by;
  return a.titulo.localeCompare(b.titulo, "es");
}
