/**
 * Buscador público — sobre lo PUBLICADO, en el servidor y en memoria.
 *
 * No toca el corpus ni los embeddings: el índice se arma con las piezas que ya
 * pasaron el gate de publicación (título, resumen, época, año) más las entidades
 * con artículo propio. Comparación por texto normalizado (sin acentos ni
 * mayúsculas), con puntuación por dónde aparece el término: título exacto,
 * comienzo de palabra, resumen. Es barato — el corpus público cabe holgado en
 * memoria y ya viene cacheado por public-data.
 */
import type { PublicArchivePiece, PublicEntity } from "@/lib/public-data";
import { typeSlugOfLabel } from "@/components/public/archive-filtering";

export interface SearchDoc {
  href: string;
  title: string;
  summary: string;
  /** Etiqueta editorial de la pieza ("Hecho", "Biografía"…). */
  label: string;
  typeSlug: string;
  periodCode: string | null;
  yearLabel: string | null;
  imageUrl: string | null;
  /** Título normalizado (sin acentos, minúsculas). */
  titleNorm: string;
  /** Título + resumen + etiqueta + año, normalizado. */
  haystack: string;
}

export interface SearchHit extends SearchDoc {
  score: number;
  /** Cuántos términos de la consulta aparecieron en la pieza. */
  matched: number;
}

export interface SearchOutcome {
  hits: SearchHit[];
  /** Los términos que se buscaron (ya limpios). */
  terms: string[];
  /** true si ninguna pieza traía todos los términos y se relajó a coincidencias parciales. */
  partial: boolean;
}

/** Palabras vacías que no deberían obligar a una coincidencia. */
const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "en", "y", "e",
  "o", "u", "a", "al", "que", "por", "con", "para", "su", "sus", "lo", "se", "es",
  "fue", "como", "mas", "pero", "sobre", "entre", "the", "of",
]);

/** Minúsculas sin diacríticos: "Bogotá" y "bogota" son la misma consulta. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Consulta → frase normalizada + términos significativos. */
export function queryTerms(query: string): { phrase: string; terms: string[] } {
  const phrase = normalizeText(query).replace(/\s+/g, " ").trim();
  const raw = phrase
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length > 0);
  const meaningful = raw.filter((t) => t.length > 1 && !STOPWORDS.has(t));
  return { phrase, terms: meaningful.length > 0 ? meaningful : raw };
}

function entityYearLabel(anio: number | null): string | null {
  if (anio == null) return null;
  return anio < 0 ? `${Math.abs(anio)} a.C.` : String(anio);
}

const ENTITY_LABEL: Record<string, string> = {
  persona: "Biografía",
  lugar: "Lugar",
  idea: "Idea",
};

function makeDoc(input: Omit<SearchDoc, "titleNorm" | "haystack" | "typeSlug">): SearchDoc {
  const titleNorm = normalizeText(input.title);
  const haystack = normalizeText(
    [input.title, input.summary, input.label, input.yearLabel ?? ""].join(" · "),
  );
  return { ...input, typeSlug: typeSlugOfLabel(input.label), titleNorm, haystack };
}

/**
 * Índice de búsqueda: piezas publicadas + entidades con artículo propio que no
 * estén ya representadas por su ficha (se deduplica por ruta, así nunca aparece
 * dos veces la misma página).
 */
export function buildSearchCorpus(
  pieces: PublicArchivePiece[],
  entities: PublicEntity[],
): SearchDoc[] {
  const seen = new Set<string>();
  const docs: SearchDoc[] = [];

  for (const piece of pieces) {
    if (seen.has(piece.href)) continue;
    seen.add(piece.href);
    docs.push(
      makeDoc({
        href: piece.href,
        title: piece.title,
        summary: piece.summary,
        label: piece.label,
        periodCode: piece.periodCode,
        yearLabel: piece.yearLabel,
        imageUrl: piece.imageUrl,
      }),
    );
  }

  for (const entity of entities) {
    if (seen.has(entity.href)) continue;
    seen.add(entity.href);
    docs.push(
      makeDoc({
        href: entity.href,
        title: entity.name,
        summary: entity.resumen ?? "",
        label: ENTITY_LABEL[entity.type] ?? "Lectura",
        periodCode: entity.periods[0] ?? null,
        yearLabel: entityYearLabel(entity.anio),
        imageUrl: entity.imageUrl,
      }),
    );
  }

  return docs;
}

/** ¿El término aparece al comienzo de alguna palabra del texto? */
function startsWord(haystack: string, term: string): boolean {
  const index = haystack.indexOf(term);
  if (index < 0) return false;
  if (index === 0) return true;
  return !/[a-z0-9]/.test(haystack[index - 1]);
}

function scoreDoc(doc: SearchDoc, phrase: string, terms: string[]): { score: number; matched: number } {
  let score = 0;

  if (doc.titleNorm === phrase) score += 300;
  else if (startsWord(doc.titleNorm, phrase)) score += 170;
  else if (doc.titleNorm.includes(phrase)) score += 100;
  else if (doc.haystack.includes(phrase)) score += 45;

  let matched = 0;
  for (const term of terms) {
    const inTitle = doc.titleNorm.includes(term);
    if (inTitle) score += startsWord(doc.titleNorm, term) ? 30 : 16;
    if (doc.haystack.includes(term)) {
      matched++;
      if (!inTitle) score += startsWord(doc.haystack, term) ? 8 : 4;
    }
  }
  if (matched === terms.length && terms.length > 1) score += 20;

  return { score, matched };
}

/**
 * Busca y ordena por relevancia. Exige TODOS los términos; si nada los reúne,
 * relaja a coincidencias parciales antes que devolver la nada (y lo avisa con
 * `partial` para que la página lo diga).
 */
export function searchDocs(docs: SearchDoc[], query: string): SearchOutcome {
  const { phrase, terms } = queryTerms(query);
  if (!phrase || terms.length === 0) return { hits: [], terms: [], partial: false };

  const scored: SearchHit[] = [];
  for (const doc of docs) {
    const { score, matched } = scoreDoc(doc, phrase, terms);
    if (matched === 0 && score === 0) continue;
    scored.push({ ...doc, score, matched });
  }

  const complete = scored.filter((hit) => hit.matched === terms.length);
  const partial = complete.length === 0 && scored.length > 0;
  const hits = partial ? scored : complete;

  hits.sort(
    (a, b) =>
      b.matched - a.matched ||
      b.score - a.score ||
      a.title.length - b.title.length ||
      a.title.localeCompare(b.title, "es"),
  );

  return { hits, terms, partial };
}
