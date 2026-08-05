/**
 * Índice público de investigación.
 *
 * Se construye únicamente con piezas que ya pasaron el gate de publicación. No
 * consulta la tabla de chunks ni expone el corpus privado. Enriquece la búsqueda
 * con protagonistas, lugares, ideas, tema, categoría y contexto editorial para
 * que el resultado explique por qué apareció.
 */
import type { PublicArchivePiece, PublicEntity } from "@/lib/public-data";
import { typeSlugOfLabel } from "@/components/public/archive-filtering";

export type SearchMatchField =
  | "title"
  | "body"
  | "summary"
  | "period"
  | "people"
  | "places"
  | "ideas"
  | "topic"
  | "context"
  | "approximate";

export interface SearchDoc {
  id: string;
  href: string;
  title: string;
  summary: string;
  whyItMatters: string;
  label: string;
  typeSlug: string;
  periodCode: string | null;
  yearLabel: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
  people: string[];
  places: string[];
  ideas: string[];
  categoryName: string | null;
  theme: string | null;
  documentCount: number | null;
  wordCount: number | null;
  titleNorm: string;
  summaryNorm: string;
  contextNorm: string;
  entitiesNorm: string;
  topicNorm: string;
  periodNorm: string;
  haystack: string;
  indexTokens: string[];
}

export interface SearchHit extends SearchDoc {
  score: number;
  /** Cuántos términos significativos de la consulta aparecieron. */
  matched: number;
  matchedFields: SearchMatchField[];
}

export interface SearchOutcome {
  hits: SearchHit[];
  terms: string[];
  /** true si ninguna pieza traía todos los términos y se relajó la cobertura. */
  partial: boolean;
}

const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "en", "y", "e",
  "o", "u", "a", "al", "que", "por", "con", "para", "su", "sus", "lo", "se", "es",
  "fue", "como", "mas", "pero", "sobre", "entre", "the", "of",
]);

const ENTITY_LABEL: Record<string, string> = {
  persona: "Biografía",
  lugar: "Lugar",
  idea: "Idea",
};

const MATCH_FIELD_LABEL: Record<SearchMatchField, string> = {
  title: "título",
  body: "texto completo",
  summary: "resumen",
  period: "época",
  people: "persona",
  places: "lugar",
  ideas: "idea",
  topic: "tema",
  context: "contexto editorial",
  approximate: "término aproximado",
};

/** Minúsculas sin diacríticos: “Bogotá” y “bogota” son la misma consulta. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function compact(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  const normalized = compact(value);
  return normalized ? normalized.split(" ") : [];
}

/** Consulta → frase normalizada + términos significativos. */
export function queryTerms(query: string): { phrase: string; terms: string[] } {
  const phrase = compact(query.replace(/[“”"]/g, " "));
  const raw = phrase.split(" ").filter(Boolean);
  const meaningful = raw.filter((term) => term.length > 1 && !STOPWORDS.has(term));
  return { phrase, terms: meaningful.length > 0 ? meaningful : raw };
}

function entityYearLabel(year: number | null): string | null {
  if (year == null) return null;
  return year < 0 ? `${Math.abs(year)} a.C.` : String(year);
}

type SearchDocInput = Omit<
  SearchDoc,
  | "typeSlug"
  | "titleNorm"
  | "summaryNorm"
  | "contextNorm"
  | "entitiesNorm"
  | "topicNorm"
  | "periodNorm"
  | "haystack"
  | "indexTokens"
>;

function makeDoc(input: SearchDocInput): SearchDoc {
  const titleNorm = compact(input.title);
  const summaryNorm = compact(input.summary);
  const contextNorm = compact(input.whyItMatters);
  const entitiesNorm = compact([...input.people, ...input.places, ...input.ideas].join(" "));
  const topicNorm = compact([input.categoryName ?? "", input.theme ?? ""].join(" "));
  const periodNorm = compact([input.label, input.yearLabel ?? "", input.periodCode ?? ""].join(" "));
  const haystack = [
    titleNorm,
    summaryNorm,
    contextNorm,
    entitiesNorm,
    topicNorm,
    periodNorm,
  ].filter(Boolean).join(" ");
  return {
    ...input,
    typeSlug: typeSlugOfLabel(input.label),
    titleNorm,
    summaryNorm,
    contextNorm,
    entitiesNorm,
    topicNorm,
    periodNorm,
    haystack,
    indexTokens: [...new Set(tokenize([titleNorm, entitiesNorm, topicNorm, periodNorm].join(" ")))],
  };
}

/** Piezas publicadas + entidades con página propia, deduplicadas por ruta. */
export function buildSearchCorpus(
  pieces: PublicArchivePiece[],
  entities: PublicEntity[],
): SearchDoc[] {
  const seen = new Set<string>();
  const docs: SearchDoc[] = [];

  for (const piece of pieces) {
    if (seen.has(piece.href)) continue;
    seen.add(piece.href);
    docs.push(makeDoc({
      href: piece.href,
      id: piece.id,
      title: piece.title,
      summary: piece.summary,
      whyItMatters: piece.whyItMatters,
      label: piece.label,
      periodCode: piece.periodCode,
      yearLabel: piece.yearLabel,
      imageUrl: piece.imageUrl,
      publishedAt: piece.publishedAt,
      people: piece.people,
      places: piece.places,
      ideas: piece.ideas,
      categoryName: piece.categoryName,
      theme: piece.theme,
      documentCount: piece.documentCount,
      wordCount: piece.wordCount,
    }));
  }

  for (const entity of entities) {
    if (seen.has(entity.href)) continue;
    seen.add(entity.href);
    docs.push(makeDoc({
      href: entity.href,
      id: entity.href,
      title: entity.name,
      summary: entity.resumen ?? "",
      whyItMatters: "",
      label: ENTITY_LABEL[entity.type] ?? "Lectura",
      periodCode: entity.periods[0] ?? null,
      yearLabel: entityYearLabel(entity.anio),
      imageUrl: entity.imageUrl,
      publishedAt: null,
      people: entity.type === "persona" ? [entity.name] : [],
      places: entity.type === "lugar" ? [entity.name] : [],
      ideas: entity.type === "idea" ? [entity.name] : [],
      categoryName: null,
      theme: null,
      documentCount: null,
      wordCount: null,
    }));
  }

  return docs;
}

function startsWord(haystack: string, term: string): boolean {
  const index = haystack.indexOf(term);
  if (index < 0) return false;
  return index === 0 || !/[a-z0-9]/.test(haystack[index - 1]);
}

/** Distancia Levenshtein acotada: se corta en cuanto la fila supera el umbral. */
function withinEditDistance(a: string, b: string, limit: number): boolean {
  if (Math.abs(a.length - b.length) > limit) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j++) {
      const value = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return false;
    previous = current;
  }
  return previous[b.length] <= limit;
}

function fuzzyMatch(doc: SearchDoc, term: string): boolean {
  if (term.length < 5) return false;
  const limit = term.length >= 9 ? 2 : 1;
  return doc.indexTokens.some((token) => withinEditDistance(token, term, limit));
}

function addField(set: Set<SearchMatchField>, field: SearchMatchField, matched: boolean): number {
  if (!matched) return 0;
  set.add(field);
  return 1;
}

function scoreDoc(
  doc: SearchDoc,
  phrase: string,
  terms: string[],
  fullTextRank = 0,
): { score: number; matched: number; matchedFields: SearchMatchField[] } {
  let score = 0;
  let matched = 0;
  const fields = new Set<SearchMatchField>();

  if (fullTextRank > 0) {
    // FTS confirma que todos los lexemas de la consulta aparecen en el artículo.
    score += 84 + Math.min(90, Math.log1p(fullTextRank * 1000) * 14);
    fields.add("body");
  }

  if (doc.titleNorm === phrase) {
    score += 360;
    fields.add("title");
  } else if (startsWord(doc.titleNorm, phrase)) {
    score += 220;
    fields.add("title");
  } else if (doc.titleNorm.includes(phrase)) {
    score += 140;
    fields.add("title");
  } else if (doc.entitiesNorm.includes(phrase)) {
    score += 105;
  } else if (doc.topicNorm.includes(phrase)) {
    score += 75;
  } else if (doc.summaryNorm.includes(phrase)) {
    score += 55;
  } else if (doc.contextNorm.includes(phrase)) {
    score += 42;
  }

  for (const term of terms) {
    const inTitle = doc.titleNorm.includes(term);
    const inSummary = doc.summaryNorm.includes(term);
    const inContext = doc.contextNorm.includes(term);
    const inPeople = compact(doc.people.join(" ")).includes(term);
    const inPlaces = compact(doc.places.join(" ")).includes(term);
    const inIdeas = compact(doc.ideas.join(" ")).includes(term);
    const inTopic = doc.topicNorm.includes(term);
    const inPeriod = doc.periodNorm.includes(term);
    const exact = inTitle || inSummary || inContext || inPeople || inPlaces || inIdeas || inTopic || inPeriod;
    const approximate = !exact && fuzzyMatch(doc, term);

    if (!exact && !approximate) continue;
    matched++;
    score += inTitle ? (startsWord(doc.titleNorm, term) ? 42 : 27) : 0;
    score += addField(fields, "summary", inSummary) * 10;
    score += addField(fields, "context", inContext) * 8;
    score += addField(fields, "people", inPeople) * 23;
    score += addField(fields, "places", inPlaces) * 21;
    score += addField(fields, "ideas", inIdeas) * 21;
    score += addField(fields, "topic", inTopic) * 18;
    score += addField(fields, "period", inPeriod) * 14;
    if (inTitle) fields.add("title");
    if (approximate) {
      fields.add("approximate");
      score += 5;
    }
  }

  if (fullTextRank > 0) matched = terms.length;
  if (matched === terms.length && terms.length > 1) score += 34;
  if (doc.imageUrl) score += 1;
  return { score, matched, matchedFields: [...fields] };
}

/**
 * Busca y ordena por relevancia. Exige todos los términos; solo si ninguna pieza
 * los reúne devuelve coincidencias parciales, avisándolo a la interfaz.
 */
export function searchDocs(
  docs: SearchDoc[],
  query: string,
  fullTextRanks: ReadonlyMap<string, number> = new Map(),
): SearchOutcome {
  const { phrase, terms } = queryTerms(query);
  if (!phrase || terms.length === 0) return { hits: [], terms: [], partial: false };

  const scored: SearchHit[] = [];
  for (const doc of docs) {
    const result = scoreDoc(doc, phrase, terms, fullTextRanks.get(doc.id) ?? 0);
    if (result.matched === 0 && result.score === 0) continue;
    scored.push({ ...doc, ...result });
  }

  const complete = scored.filter((hit) => hit.matched === terms.length);
  const partial = complete.length === 0 && scored.length > 0;
  const hits = partial ? scored : complete;
  hits.sort(
    (a, b) =>
      b.matched - a.matched ||
      b.score - a.score ||
      (b.documentCount ?? 0) - (a.documentCount ?? 0) ||
      a.title.length - b.title.length ||
      a.title.localeCompare(b.title, "es"),
  );

  return { hits, terms, partial };
}

/** Explicación breve, derivada del ranking real, para cada hallazgo. */
export function describeMatch(hit: SearchHit): string {
  const labels = hit.matchedFields
    .filter((field) => field !== "approximate")
    .slice(0, 3)
    .map((field) => MATCH_FIELD_LABEL[field]);
  if (labels.length === 0 && hit.matchedFields.includes("approximate")) {
    return "Coincidencia aproximada con la consulta";
  }
  if (labels.length === 1) return `Coincide en ${labels[0]}`;
  if (labels.length === 2) return `Coincide en ${labels[0]} y ${labels[1]}`;
  return `Coincide en ${labels.slice(0, -1).join(", ")} y ${labels.at(-1)}`;
}
