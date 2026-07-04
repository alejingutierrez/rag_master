/**
 * AUTO-ENLACE de entidades en prosa (tiempo de lectura).
 *
 * Convierte menciones de entidades (personas / lugares / ideas) dentro del texto
 * de una pieza en enlaces a su página. Es lo que teje el sitio como una wiki: no
 * hace falta que la ficha de la entidad esté producida — su página se computa del
 * registro + lo publicado, así que el enlace SIEMPRE resuelve (o 404 si no hay
 * presencia publicada, pero el diccionario ya se limita a entidades publicadas).
 *
 * Diccionario = entidades PUBLICADAS (registro ∩ piezas publicadas). Coincidencia
 * por superficie (nombre + variantes del corpus), sin acentos-insensible pero sí
 * mayúscula-insensible, con límites de palabra unicode y match más largo primero.
 * Dedupe: solo la PRIMERA mención de cada entidad por pieza se enlaza (convención
 * wiki, evita saturar). No auto-enlaza la entidad de la propia página.
 */
import type React from "react";

export type LinkEntityType = "persona" | "lugar" | "idea";

export interface LinkableEntity {
  key: string; // `${type}:${slug}`
  type: LinkEntityType;
  slug: string;
  href: string;
  /** Grafías a reconocer en el texto: nombre canónico + variantes. */
  surfaces: string[];
}

export interface EntityLinker {
  regex: RegExp | null;
  /** superficie normalizada → entidad. */
  bySurface: Map<string, LinkableEntity>;
}

export interface LinkCtx {
  linked: Set<string>;
  selfKey?: string;
  counter: { n: number };
  cap: number;
}

/** Longitud mínima de una superficie para auto-enlazar (evita ruido de siglas cortas). */
const MIN_SURFACE_LEN = 4;

/**
 * Términos demasiado genéricos para enlazar cada mención aunque sean entidades.
 * El gate de solo-publicado ya filtra casi todo; esto es un cinturón extra para
 * palabras-función que aparecen sueltas. Normalizados (sin acento, minúscula).
 */
const STOP = new Set<string>([
  "estado", "gobierno", "nacion", "pais", "pueblo", "guerra", "iglesia", "ejercito",
  "region", "partido", "congreso", "historia", "sociedad", "politica", "economia",
]);

function normalizeSurface(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Construye el matcher desde las entidades enlazables (pásalas por prominencia desc). */
export function buildEntityLinker(entities: LinkableEntity[]): EntityLinker {
  const bySurface = new Map<string, LinkableEntity>();
  const patterns: string[] = [];
  for (const e of entities) {
    for (const raw of e.surfaces) {
      const norm = normalizeSurface(raw);
      if (norm.length < MIN_SURFACE_LEN) continue;
      if (STOP.has(norm)) continue;
      if (!/[a-záéíóúüñ]/i.test(raw)) continue; // debe tener al menos una letra
      if (bySurface.has(norm)) continue; // primera (más prominente) gana
      bySurface.set(norm, e);
      patterns.push(raw.trim());
    }
  }
  if (!patterns.length) return { regex: null, bySurface };
  // Match más largo primero: "Simón Bolívar" antes que "Bolívar".
  patterns.sort((a, b) => b.length - a.length);
  const alt = patterns.map(escapeRegex).join("|");
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt})(?![\\p{L}\\p{N}])`, "giu");
  return { regex, bySurface };
}

/**
 * Divide `text` en nodos, envolviendo cada PRIMERA mención de una entidad en un
 * enlace. Muta `ctx.linked` / `ctx.counter`. Devuelve string original si no hay
 * matcher o no hay enlaces. Los tramos no enlazados salen como texto plano.
 */
export function linkText(text: string, linker: EntityLinker, ctx: LinkCtx): React.ReactNode {
  const re = linker.regex;
  if (!re) return text;
  re.lastIndex = 0;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let linkedHere = false;
  while ((m = re.exec(text)) !== null) {
    if (m.index === re.lastIndex) re.lastIndex++; // guardia anti-bucle
    if (ctx.counter.n >= ctx.cap) break;
    const matched = m[0];
    const ent = linker.bySurface.get(normalizeSurface(matched));
    if (!ent) continue;
    if (ent.key === ctx.selfKey) continue;
    if (ctx.linked.has(ent.key)) continue;
    ctx.linked.add(ent.key);
    ctx.counter.n++;
    linkedHere = true;
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <a key={`wl-${ctx.counter.n}`} className="wikilink" href={ent.href}>
        {matched}
      </a>,
    );
    last = m.index + matched.length;
  }
  if (!linkedHere) return text;
  if (last < text.length) out.push(text.slice(last));
  return out;
}
