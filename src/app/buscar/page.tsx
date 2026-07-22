import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import {
  getConnectedEntityDirectory,
  getPublicArchiveStats,
  getRecentPublicPieces,
} from "@/lib/public-data";
import { periodInfo } from "@/lib/design-tokens";
import { buildMetadata } from "@/lib/seo";
import { SearchForm } from "@/components/public/search-form";
import { ArchiveChips, type ArchiveChip } from "@/components/public/archive-chips";
import { ArchivePagination } from "@/components/public/archive-pagination";
import {
  ARCHIVE_TYPES,
  archiveHref,
  countByType,
  firstParam,
  formatNumber,
  parsePage,
  typeBySlug,
} from "@/components/public/archive-filtering";
import { buildSearchCorpus, searchDocs, type SearchHit } from "@/components/public/search-engine";
import "./buscar.css";

export const dynamic = "force-dynamic";

// Las páginas de resultados no se indexan (contenido combinatorio, sin valor
// propio): el canónico del archivo ya cubre lo publicado.
export const metadata: Metadata = {
  ...buildMetadata({
    seo: {
      metaTitle: "Buscar",
      metaDescription:
        "Busca entre las piezas publicadas del archivo: hechos, épocas, biografías, lugares, ideas y lecturas sobre la historia de Colombia.",
      keywords: ["buscar", "historia de Colombia", "archivo histórico"],
    },
    path: "/buscar",
    type: "website",
  }),
  robots: { index: false, follow: true },
};

/** Resultados por página. */
const PAGE_SIZE = 25;

/** Caminos alternos cuando la búsqueda no lleva a ninguna parte. */
function Puertas({ note }: { note: string }) {
  const doors = [
    { href: "/epocas", label: "Recorrer las épocas", note: "De lo prehispánico al posconflicto" },
    { href: "/linea-de-tiempo", label: "Línea de tiempo", note: "Los hechos en orden" },
    { href: "/archivo", label: "Todo el archivo", note: "Filtrar por tipo y por época" },
    { href: "/personas", label: "Personas", note: "Quién hizo la historia" },
  ];
  return (
    <div className="sr-doors">
      <div className="sr-doors-note">{note}</div>
      <ul>
        {doors.map((door) => (
          <li key={door.href}>
            <Link href={door.href}>
              <strong>{door.label}</strong>
              <small>{door.note}</small>
              <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultRow({ hit }: { hit: SearchHit }) {
  const info = hit.periodCode ? periodInfo(hit.periodCode) : undefined;
  return (
    <li className="sr-item">
      <Link href={hit.href}>
        <span className="sr-meta">
          <span className="sr-label">{hit.label}</span>
          {info && (
            <span className="sr-epoca" style={{ color: `var(--p-${info.slug})` }}>
              {info.label}
            </span>
          )}
          {hit.yearLabel && <span className="sr-year">{hit.yearLabel}</span>}
        </span>
        <strong>{hit.title}</strong>
        {hit.summary && <small>{hit.summary}</small>}
      </Link>
    </li>
  );
}

export default async function BuscarPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string | string[];
    tipo?: string | string[];
    pagina?: string | string[];
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const q = firstParam(sp.q).slice(0, 120);
  const tipo = typeBySlug(sp.tipo);

  // Todo el índice de búsqueda sale de lo PUBLICADO (mismo gate del archivo) y
  // ya viene cacheado en memoria: la consulta se resuelve sin tocar la BD.
  const [pieces, personas, lugares, ideas, stats] = await Promise.all([
    getRecentPublicPieces(1000),
    getConnectedEntityDirectory("persona"),
    getConnectedEntityDirectory("lugar"),
    getConnectedEntityDirectory("idea"),
    getPublicArchiveStats(),
  ]);

  const corpus = buildSearchCorpus(pieces, [...personas, ...lugares, ...ideas]);
  const { hits, partial } = q
    ? searchDocs(corpus, q)
    : { hits: [] as SearchHit[], partial: false };

  const counts = countByType(hits);
  const facets: ArchiveChip[] = [
    {
      href: archiveHref("/buscar", { q }),
      label: "Todo",
      count: hits.length,
      active: tipo === null,
    },
    ...ARCHIVE_TYPES.filter(
      (t) => (counts.get(t.slug) ?? 0) > 0 || t.slug === tipo?.slug,
    ).map((t) => ({
      href: archiveHref("/buscar", { q, tipo: t.slug }),
      label: t.plural,
      count: counts.get(t.slug) ?? 0,
      active: tipo?.slug === t.slug,
    })),
  ];

  const filtered = tipo ? hits.filter((hit) => hit.typeSlug === tipo.slug) : hits;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(parsePage(sp.pagina), totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);

  const hrefForPage = (n: number) =>
    archiveHref("/buscar", { q, tipo: tipo?.slug ?? null, pagina: n > 1 ? n : null });

  const destacadas = personas.slice(0, 8);

  return (
    <PublicShell>
      <div className="sr-wrap">
        <header className="sr-head">
          <div className="sr-kicker">
            Búsqueda · {formatNumber(stats.total)} piezas publicadas
          </div>
          <h1>{q ? "Resultados" : "Buscar en el archivo"}</h1>
          <div className="sr-form">
            <SearchForm
              id="buscar-q"
              defaultValue={q}
              label={q ? "Nueva búsqueda" : "Qué quieres encontrar"}
              placeholder="Un nombre, un lugar, un año…"
              hint="Busca por título, resumen y entidades de las piezas publicadas"
            />
          </div>
        </header>

        {!q ? (
          <section className="sr-body" aria-label="Sugerencias">
            <Puertas note="También puedes entrar por aquí" />
            {destacadas.length > 0 && (
              <div className="sr-suggest">
                <div className="sr-suggest-title">Empieza por una figura</div>
                <ArchiveChips
                  ariaLabel="Personas con biografía publicada"
                  items={destacadas.map((persona) => ({
                    href: persona.href,
                    label: persona.name,
                    active: false,
                  }))}
                />
              </div>
            )}
          </section>
        ) : (
          <section className="sr-body" aria-label="Resultados de la búsqueda">
            <div className="sr-summary">
              <span className="sr-count">
                {filtered.length === 0
                  ? `Sin resultados para «${q}»`
                  : `${formatNumber(filtered.length)} ${filtered.length === 1 ? "resultado" : "resultados"} para «${q}»`}
              </span>
              {partial && filtered.length > 0 && (
                <span className="sr-note">Coincidencias parciales: no hay piezas con todos los términos.</span>
              )}
            </div>

            {hits.length > 0 && (
              <ArchiveChips items={facets} label="Tipo" ariaLabel="Filtrar resultados por tipo" />
            )}

            {page.length === 0 ? (
              <div className="sr-empty">
                <p>
                  Nada en el archivo publicado coincide con esa búsqueda. Prueba con menos
                  palabras, con un nombre propio o con un año.
                </p>
                <Puertas note="Otras formas de encontrar lo que buscas" />
              </div>
            ) : (
              <ol className="sr-list">
                {page.map((hit) => (
                  <ResultRow key={hit.href} hit={hit} />
                ))}
              </ol>
            )}

            <ArchivePagination
              current={current}
              totalPages={totalPages}
              hrefFor={hrefForPage}
              ariaLabel="Páginas de resultados"
            />
          </section>
        )}
      </div>
    </PublicShell>
  );
}
