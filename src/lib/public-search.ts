/**
 * Retrieval público en dos capas:
 * 1) piezas editoriales completas publicadas;
 * 2) fragmentos breves de libros y documentos del corpus bibliográfico.
 *
 * Los fragmentos nunca se convierten en “artículos”: conservan obra, autor y
 * página y se muestran después de las piezas producidas.
 */
import { prisma } from "@/lib/prisma";
import { getDocumentDisplayName, type EnrichmentMetadata } from "@/lib/enrichment-types";

interface RankedArticleRow {
  id: string;
  rank: number;
}

interface RawFragmentRow {
  id: string;
  documentId: string;
  content: string;
  pageNumber: number;
  chapterTitle: string | null;
  filename: string;
  documentMetadata: unknown;
  rank: number;
}

export interface SourceFragmentHit {
  id: string;
  documentId: string;
  excerpt: string;
  pageNumber: number;
  chapterTitle: string | null;
  sourceTitle: string;
  author: string | null;
  publicationYear: number | null;
  publisher: string | null;
  rank: number;
}

let indexedArticleSearchColumn: Promise<boolean> | null = null;
let hasChunksV2: Promise<boolean> | null = null;

const FTS_STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "un", "una", "en", "y", "e", "o", "u",
  "a", "al", "que", "por", "con", "para", "su", "sus", "lo", "se", "es", "fue",
  "como", "mas", "pero", "sobre", "entre",
]);

/**
 * `spanish` stemmea “constitución” a `constitu`, pero puede dejar
 * “constitucion” sin stem. Cada término se convierte en un grupo OR con sus
 * posibles tildes/ñ; los grupos se unen con AND. Así la búsqueda pública no
 * depende de que el lector escriba los diacríticos perfectos.
 */
export function buildSpanishTsQuery(query: string): string {
  const rawTerms = query
    .toLowerCase()
    .split(/[^a-záéíóúüñ0-9]+/)
    .map((raw) => ({ raw, base: fold(raw) }))
    .filter(({ base }) => base.length > 1 && !FTS_STOPWORDS.has(base));
  const accentByVowel: Record<string, string> = {
    a: "á",
    e: "é",
    i: "í",
    o: "ó",
    u: "ú",
  };
  return rawTerms.map(({ raw, base: term }) => {
    // Si el lector ya escribió el diacrítico, no hay nada que expandir.
    if (raw !== term) return `(${raw})`;
    const variants = new Set([term]);
    // -ción / -sión concentran la ambigüedad más común y tienen una regla
    // inequívoca; evitar siete variantes absurdas reduce mucho el costo del GIN.
    if (/(cion|sion)$/.test(term)) {
      variants.add(`${term.slice(0, -2)}ó${term.slice(-1)}`);
      return `(${[...variants].join(" | ")})`;
    }
    // Para términos cortos (sobre todo apellidos) sí probamos cada diacrítico.
    // En palabras largas sin sufijo acentuable limitamos la expansión a las
    // últimas cuatro letras, donde suele vivir el acento español.
    const firstIndex = term.length <= 7 ? 0 : Math.max(0, term.length - 4);
    for (let index = firstIndex; index < term.length; index++) {
      const accented = accentByVowel[term[index]];
      if (accented) variants.add(`${term.slice(0, index)}${accented}${term.slice(index + 1)}`);
      if (term.length <= 7 && term[index] === "n") {
        variants.add(`${term.slice(0, index)}ñ${term.slice(index + 1)}`);
      }
    }
    return `(${[...variants].join(" | ")})`;
  }).join(" & ");
}

async function articleIndexAvailable(): Promise<boolean> {
  if (!indexedArticleSearchColumn) {
    indexedArticleSearchColumn = prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'deliverables' AND column_name = 'public_search_fts'
      ) AS exists
    `.then((rows) => Boolean(rows[0]?.exists)).catch(() => false);
  }
  return indexedArticleSearchColumn;
}

async function chunksV2Available(): Promise<boolean> {
  if (!hasChunksV2) {
    hasChunksV2 = prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM chunks_v2 WHERE "isParent" = false LIMIT 1
      ) AS exists
    `.then((rows) => Boolean(rows[0]?.exists)).catch(() => false);
  }
  return hasChunksV2;
}

/** Ranking de texto completo; el mapa se fusiona con título y metadata en memoria. */
export async function searchPublishedArticleRanks(
  query: string,
  limit = 1000,
): Promise<Map<string, number>> {
  const clean = query.trim().slice(0, 120);
  if (!clean) return new Map();
  const tsQuery = buildSpanishTsQuery(clean);
  if (!tsQuery) return new Map();
  try {
    const indexed = await articleIndexAvailable();
    const rows = indexed
      ? await prisma.$queryRawUnsafe<RankedArticleRow[]>(
          `WITH q AS (SELECT to_tsquery('spanish', $1) AS query)
           SELECT d.id, ts_rank_cd(d.public_search_fts, q.query, 32)::float AS rank
           FROM deliverables d, q
           WHERE d.status = 'COMPLETE'
             AND d.source IN ('atelier', 'master')
             AND d."publishedAt" IS NOT NULL
             AND d.public_search_fts @@ q.query
           ORDER BY rank DESC
           LIMIT $2`,
          tsQuery,
          limit,
        )
      : await prisma.$queryRawUnsafe<RankedArticleRow[]>(
          `WITH q AS (SELECT to_tsquery('spanish', $1) AS query),
                dsearch AS (
                  SELECT d.id,
                         to_tsvector('spanish',
                           coalesce(d.answer, '') || ' ' ||
                           coalesce(d."structuredData"->>'titulo', '') || ' ' ||
                           coalesce(d."structuredData"->>'resumen', '')
                         ) AS document
                  FROM deliverables d
                  WHERE d.status = 'COMPLETE'
                    AND d.source IN ('atelier', 'master')
                    AND d."publishedAt" IS NOT NULL
                )
           SELECT dsearch.id, ts_rank_cd(dsearch.document, q.query, 32)::float AS rank
           FROM dsearch, q
           WHERE dsearch.document @@ q.query
           ORDER BY rank DESC
           LIMIT $2`,
          tsQuery,
          limit,
        );
    return new Map(rows.map((row) => [row.id, Number(row.rank)]));
  } catch (error) {
    console.error("[public-search] full article search failed:", error);
    return new Map();
  }
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function focusedExcerpt(content: string, query: string, max = 520): string {
  const text = content.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const terms = fold(query).split(/[^a-z0-9]+/).filter((term) => term.length > 2);
  const normalized = fold(text);
  const positions = terms.map((term) => normalized.indexOf(term)).filter((index) => index >= 0);
  const hit = positions.length ? Math.min(...positions) : 0;
  const startTarget = Math.max(0, hit - Math.floor(max * .32));
  const startSpace = text.lastIndexOf(" ", startTarget);
  const start = startSpace > 0 ? startSpace + 1 : 0;
  const endTarget = Math.min(text.length, start + max);
  const endSpace = text.lastIndexOf(" ", endTarget);
  const end = endSpace > start + max * .65 ? endSpace : endTarget;
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

async function searchFragmentTable(
  table: "chunks" | "chunks_v2",
  tsQuery: string,
  limit: number,
): Promise<RawFragmentRow[]> {
  const v2 = table === "chunks_v2";
  const parentClause = v2 ? `AND c."isParent" = false` : "";
  const chapterSelect = v2 ? `c."chapterTitle"` : `NULL::text`;
  // `ts_rank_cd + ORDER BY` sobre cada match de un término muy común puede
  // ordenar decenas de miles de chunks. El GIN primero acota un pool amplio y
  // solo ese pool se puntúa; 1.600 candidatos alcanzan para 10 recortes diversos.
  const candidateLimit = Math.max(1600, limit * 60);
  return prisma.$queryRawUnsafe<RawFragmentRow[]>(
    `WITH q AS (SELECT to_tsquery('spanish', $1) AS query),
          candidates AS MATERIALIZED (
            SELECT c.id,
                   c."documentId",
                   c.content,
                   c."pageNumber",
                   ${chapterSelect} AS "chapterTitle",
                   c.content_fts,
                   d.filename,
                   d.metadata AS "documentMetadata"
            FROM ${table} c
            JOIN documents d ON d.id = c."documentId", q
            WHERE d.status = 'READY'
              ${parentClause}
              AND c.content_fts @@ q.query
            LIMIT $3
          )
     SELECT candidates.id,
            candidates."documentId",
            candidates.content,
            candidates."pageNumber",
            candidates."chapterTitle",
            candidates.filename,
            candidates."documentMetadata",
            ts_rank_cd(candidates.content_fts, q.query, 32)::float AS rank
     FROM candidates, q
     ORDER BY rank DESC
     LIMIT $2`,
    tsQuery,
    limit,
    candidateLimit,
  );
}

/** Fragmentos del corpus, con deduplicación por obra y página para evitar solapamientos. */
export async function searchSourceFragments(
  query: string,
  limit = 10,
): Promise<SourceFragmentHit[]> {
  const clean = query.trim().slice(0, 120);
  if (!clean) return [];
  const tsQuery = buildSpanishTsQuery(clean);
  if (!tsQuery) return [];
  try {
    const useV2 = await chunksV2Available();
    const [v1, v2] = await Promise.all([
      searchFragmentTable("chunks", tsQuery, Math.max(24, limit * 3)),
      useV2
        ? searchFragmentTable("chunks_v2", tsQuery, Math.max(24, limit * 3))
        : Promise.resolve([]),
    ]);
    const merged = [...v2, ...v1].sort((a, b) => Number(b.rank) - Number(a.rank));
    const seenPages = new Set<string>();
    const hits: SourceFragmentHit[] = [];

    for (const row of merged) {
      const pageKey = `${row.documentId}:${row.pageNumber}`;
      if (seenPages.has(pageKey)) continue;
      seenPages.add(pageKey);
      const metadata = (row.documentMetadata ?? null) as EnrichmentMetadata | null;
      hits.push({
        id: row.id,
        documentId: row.documentId,
        excerpt: focusedExcerpt(row.content, clean),
        pageNumber: row.pageNumber,
        chapterTitle: row.chapterTitle,
        sourceTitle: getDocumentDisplayName({ filename: row.filename, metadata }),
        author: metadata?.author?.trim() || null,
        publicationYear:
          typeof metadata?.publicationYear === "number" ? metadata.publicationYear : null,
        publisher: metadata?.publisher?.trim() || null,
        rank: Number(row.rank),
      });
      if (hits.length === limit) break;
    }
    return hits;
  } catch (error) {
    console.error("[public-search] source fragment search failed:", error);
    return [];
  }
}
