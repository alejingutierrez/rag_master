import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { getPublicArchiveStats, getRecentPublicPieces } from "@/lib/public-data";
import { getPeriodColor, periodInfo } from "@/lib/design-tokens";
import { buildMetadata } from "@/lib/seo";
import { SearchForm } from "@/components/public/search-form";
import { ArchiveFilters, type ArchiveTypeFacet } from "@/components/public/archive-filters";
import { ArchivePagination } from "@/components/public/archive-pagination";
import {
  ARCHIVE_ORDERS,
  ARCHIVE_TYPES,
  DEFAULT_ORDER,
  archiveHref,
  countByType,
  formatNumber,
  parsePage,
  sortPieces,
  typeBySlug,
  typeSlugOfLabel,
  validOrder,
  validPeriod,
} from "@/components/public/archive-filtering";
import "./archivo.css";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({
  seo: {
    metaTitle: "El archivo",
    metaDescription:
      "Todas las producciones publicadas: hechos, épocas, biografías y preguntas sobre la historia de Colombia, filtrables por tipo y por época.",
    keywords: ["archivo histórico", "historia de Colombia", "hechos", "épocas", "fuentes"],
  },
  path: "/archivo",
  type: "website",
});

/** Filas por página. Con ~330 piezas publicadas deja el archivo en 9 páginas. */
const PAGE_SIZE = 40;

export default async function ArchivoPage({
  searchParams,
}: {
  searchParams?: Promise<{
    tipo?: string | string[];
    periodo?: string | string[];
    orden?: string | string[];
    pagina?: string | string[];
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const tipo = typeBySlug(sp.tipo);
  const periodo = validPeriod(sp.periodo);
  const orden = validOrder(sp.orden);
  const ordenParam = orden === DEFAULT_ORDER ? null : orden;
  const ordenInfo = ARCHIVE_ORDERS.find((o) => o.slug === orden) ?? ARCHIVE_ORDERS[0];

  // El archivo completo: `getRecentPublicPieces` ya aplica el gate de publicación
  // y viene cacheado en memoria, así que filtrar y paginar aquí no cuesta viajes.
  const [all, stats] = await Promise.all([getRecentPublicPieces(1000), getPublicArchiveStats()]);

  const inType = (piece: { label: string }) => !tipo || typeSlugOfLabel(piece.label) === tipo.slug;
  const inPeriod = (piece: { periodCode: string | null }) => !periodo || piece.periodCode === periodo;

  // Facetas cruzadas: los tipos cuentan dentro de la época elegida y la cinta de
  // épocas muestra solo las que existen para el tipo elegido.
  const byPeriod = all.filter(inPeriod);
  const typeCounts = countByType(byPeriod);
  const typeFacets: ArchiveTypeFacet[] = ARCHIVE_TYPES.filter(
    (t) => (typeCounts.get(t.slug) ?? 0) > 0 || t.slug === tipo?.slug,
  ).map((t) => ({ slug: t.slug, plural: t.plural, count: typeCounts.get(t.slug) ?? 0 }));

  // La época elegida siempre se muestra en la cinta, aunque el tipo activo la
  // deje sin piezas: así el control refleja el filtro que está aplicado.
  const periodsPresent = [
    ...new Set([
      ...all.filter(inType).map((p) => p.periodCode).filter((c): c is string => !!c),
      ...(periodo ? [periodo] : []),
    ]),
  ];

  const filtered = all.filter((piece) => inType(piece) && inPeriod(piece));
  const sorted = sortPieces(filtered, orden);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(parsePage(sp.pagina), totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const page = sorted.slice(start, start + PAGE_SIZE);

  const hrefForPage = (n: number) =>
    archiveHref("/archivo", {
      tipo: tipo?.slug ?? null,
      periodo,
      orden: ordenParam,
      pagina: n > 1 ? n : null,
    });
  const clearHref = archiveHref("/archivo", { orden: ordenParam });

  const periodoInfo = periodo ? periodInfo(periodo) : undefined;
  const rango = [
    tipo ? tipo.plural : "Todas las piezas",
    periodoInfo ? periodoInfo.label : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PublicShell>
      <div className="ar-wrap">
        <header className="ar-head">
          <div className="ar-kicker">Archivo público · {formatNumber(stats.total)} piezas</div>
          <div className="ar-title-row">
            <h1>Todo el archivo</h1>
            <p>
              Una puerta única a las piezas publicadas. Filtra por tipo y por época, o busca
              directamente: cada entrada conduce a la historia, la biografía o la lectura que
              realmente existe.
            </p>
          </div>
          <dl className="ar-stats">
            <div><dt>{formatNumber(stats.hechos)}</dt><dd>hechos</dd></div>
            <div><dt>{formatNumber(stats.epocas)}</dt><dd>épocas</dd></div>
            <div><dt>{formatNumber(stats.biografias)}</dt><dd>biografías</dd></div>
            <div><dt>{formatNumber(stats.preguntas + stats.lecturas)}</dt><dd>lecturas</dd></div>
            <div><dt>{formatNumber(stats.documents)}</dt><dd>documentos citados</dd></div>
            <div><dt>{formatNumber(stats.fragments)}</dt><dd>fragmentos</dd></div>
          </dl>
          <div className="ar-find">
            <SearchForm
              id="archivo-buscar"
              label="Buscar en el archivo"
              placeholder="Un nombre, un lugar, un año…"
              hint="Busca en títulos, resúmenes y entidades de todo lo publicado"
            />
          </div>
        </header>

        <ArchiveFilters
          basePath="/archivo"
          tipo={tipo?.slug ?? null}
          periodo={periodo}
          orden={orden}
          typeFacets={typeFacets}
          periodsPresent={periodsPresent}
          total={filtered.length}
          totalAll={all.length}
        />

        <section className="ar-catalog" aria-labelledby="archivo-listado">
          <div className="ar-catalog-head">
            <h2 id="archivo-listado">{rango}</h2>
            <span>
              {sorted.length > 0
                ? `${formatNumber(start + 1)}–${formatNumber(start + page.length)} de ${formatNumber(sorted.length)} · ${ordenInfo.label}`
                : "Sin resultados"}
            </span>
          </div>

          {page.length === 0 ? (
            <div className="ar-empty">
              <p>Ninguna pieza publicada coincide con estos filtros.</p>
              <Link href={clearHref}>Ver todo el archivo →</Link>
            </div>
          ) : (
            <ol className="ar-list">
              {page.map((piece, index) => {
                const info = piece.periodCode ? periodInfo(piece.periodCode) : undefined;
                return (
                  <li key={piece.id}>
                    <Link href={piece.href}>
                      <span className="ar-index">{String(start + index + 1).padStart(2, "0")}</span>
                      <span
                        className="ar-type"
                        style={{ "--ar-dot": getPeriodColor(piece.periodCode ?? "TRANS") } as React.CSSProperties}
                        title={info ? `${info.label} · ${info.yearRange}` : undefined}
                      >
                        {piece.label}
                        {info ? <em>{info.short}</em> : null}
                      </span>
                      <span className="ar-copy">
                        <strong>{piece.title}</strong>
                        {piece.summary ? <small>{piece.summary}</small> : null}
                      </span>
                      <span className="ar-year">{piece.yearLabel ?? "—"}</span>
                      <span className="ar-arrow" aria-hidden>→</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}

          <ArchivePagination
            current={current}
            totalPages={totalPages}
            hrefFor={hrefForPage}
            ariaLabel="Páginas del archivo"
          />
        </section>
      </div>
    </PublicShell>
  );
}
