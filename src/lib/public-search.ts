/** Ranking de texto completo para las piezas editoriales publicadas. */
import { prisma } from "@/lib/prisma";

interface RankedArticleRow {
  id: string;
  rank: number;
}

let indexedArticleSearchColumn: Promise<boolean> | null = null;

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
