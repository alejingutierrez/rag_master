import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { SearchForm } from "@/components/public/search-form";
import { ArchivePagination } from "@/components/public/archive-pagination";
import { EditorialArrow, EditorialImage } from "@/components/public/home/primitives";
import {
  ARCHIVE_TYPES,
  archiveHref,
  countByType,
  firstParam,
  formatNumber,
  parsePage,
  parseYear,
  typeBySlug,
  validPeriod,
} from "@/components/public/archive-filtering";
import {
  buildSearchCorpus,
  describeMatch,
  normalizeText,
  searchDocs,
  type SearchHit,
} from "@/components/public/search-engine";
import {
  getConnectedEntityDirectory,
  getPublicArchiveStats,
  getRecentPublicPieces,
  type PublicEntity,
} from "@/lib/public-data";
import { PERIOD_ORDER, periodInfo } from "@/lib/design-tokens";
import { searchPublishedArticleRanks } from "@/lib/public-search";
import { buildMetadata } from "@/lib/seo";
import "./buscar.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...buildMetadata({
    seo: {
      metaTitle: "Buscar",
      metaDescription:
        "Busca y recorre los artículos completos publicados sobre la historia de Colombia.",
      keywords: ["buscar", "historia de Colombia", "archivo histórico", "fuentes"],
    },
    path: "/buscar",
    type: "website",
  }),
  robots: { index: false, follow: true },
};

const PAGE_SIZE = 15;

interface RelatedEntity {
  name: string;
  href: string;
  type: "Persona" | "Lugar" | "Idea";
  count: number;
}

interface ResearchThread {
  label: string;
  count: number;
}

function matchEntityHref(name: string, directory: PublicEntity[]): string | null {
  const normalized = normalizeText(name).trim();
  return directory.find((entity) => normalizeText(entity.name).trim() === normalized)?.href ?? null;
}

function relatedEntities(
  hits: SearchHit[],
  personas: PublicEntity[],
  lugares: PublicEntity[],
  ideas: PublicEntity[],
): RelatedEntity[] {
  const counts = new Map<string, RelatedEntity>();
  const add = (name: string, type: RelatedEntity["type"], directory: PublicEntity[]) => {
    const href = matchEntityHref(name, directory);
    if (!href) return;
    const key = `${type}:${href}`;
    const current = counts.get(key);
    counts.set(key, { name, href, type, count: (current?.count ?? 0) + 1 });
  };
  for (const hit of hits.slice(0, 120)) {
    for (const name of hit.people) add(name, "Persona", personas);
    for (const name of hit.places) add(name, "Lugar", lugares);
    for (const name of hit.ideas) add(name, "Idea", ideas);
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"))
    .slice(0, 8);
}

function researchThreads(hits: SearchHit[]): ResearchThread[] {
  const counts = new Map<string, number>();
  for (const hit of hits.slice(0, 160)) {
    for (const value of [hit.theme, hit.categoryName]) {
      const clean = value?.trim();
      if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"))
    .slice(0, 4);
}

function chronology(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  return hits
    .slice(0, 80)
    .filter((hit) => parseYear(hit.yearLabel) !== null)
    .sort((a, b) => (parseYear(a.yearLabel) ?? 0) - (parseYear(b.yearLabel) ?? 0))
    .filter((hit) => {
      const key = `${hit.yearLabel}:${hit.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function highlight(text: string, query: string) {
  const terms = query
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 2)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!terms.length) return text;
  const parts = text.split(new RegExp(`(${terms.join("|")})`, "giu"));
  return parts.map((part, index) =>
    terms.some((term) => new RegExp(`^${term}$`, "iu").test(part))
      ? <mark key={`${part}:${index}`}>{part}</mark>
      : part,
  );
}

function EvidenceLine({ hit }: { hit: SearchHit }) {
  return (
    <div className="sr-evidence-line">
      <span>{describeMatch(hit)}</span>
      {hit.documentCount ? <span>{formatNumber(hit.documentCount)} fuentes</span> : null}
    </div>
  );
}

function LeadArticle({ hit, query }: { hit: SearchHit; query: string }) {
  const period = hit.periodCode ? periodInfo(hit.periodCode) : undefined;
  return (
    <article className="sr-lead">
      <div className="sr-crop sr-crop-tl" aria-hidden />
      <div className="sr-crop sr-crop-br" aria-hidden />
      <div className="sr-lead-copy">
        <div className="sr-result-meta">
          <span>Artículo completo</span>
          <span>{hit.label}</span>
          {period ? <span>{period.label}</span> : null}
          {hit.yearLabel ? <span>{hit.yearLabel}</span> : null}
        </div>
        <h2>{highlight(hit.title, query)}</h2>
        {hit.summary ? <p>{highlight(hit.summary, query)}</p> : null}
        <EvidenceLine hit={hit} />
        <Link href={hit.href} className="sr-open-link">
          Abrir pieza completa <EditorialArrow />
        </Link>
      </div>
      <Link href={hit.href} className="sr-lead-image" aria-label={`Abrir ${hit.title}`}>
        {hit.imageUrl ? (
          <EditorialImage
            src={hit.imageUrl}
            alt=""
            eager
            width={640}
            sizes="(max-width: 760px) 100vw, 38vw"
          />
        ) : (
          <span className="sr-lead-document" aria-hidden>
            <small>Archivo publicado</small>
            <strong>{hit.title}</strong>
            <em>{hit.label}</em>
          </span>
        )}
        <span aria-hidden>{hit.yearLabel ?? hit.label}</span>
      </Link>
    </article>
  );
}

function ArticleRow({ hit, query, index }: { hit: SearchHit; query: string; index: number }) {
  const period = hit.periodCode ? periodInfo(hit.periodCode) : undefined;
  return (
    <li className={`sr-article ${hit.imageUrl ? "has-image" : ""}`}>
      <span className="sr-article-index">{String(index).padStart(2, "0")}</span>
      {hit.imageUrl ? (
        <Link href={hit.href} className="sr-article-image" tabIndex={-1} aria-hidden>
          <EditorialImage src={hit.imageUrl} alt="" width={320} sizes="180px" />
        </Link>
      ) : null}
      <div className="sr-article-copy">
        <div className="sr-result-meta">
          <span>{hit.label}</span>
          {period ? <span>{period.short}</span> : null}
          {hit.yearLabel ? <span>{hit.yearLabel}</span> : null}
        </div>
        <h3><Link href={hit.href}>{highlight(hit.title, query)}</Link></h3>
        {hit.summary ? <p>{highlight(hit.summary, query)}</p> : null}
        <EvidenceLine hit={hit} />
      </div>
      <Link href={hit.href} className="sr-row-arrow" aria-label={`Abrir ${hit.title}`}>
        <EditorialArrow />
      </Link>
    </li>
  );
}

function EmptyEntry({ total }: { total: number }) {
  return (
    <section className="sr-entry" aria-labelledby="sr-entry-title">
      <div>
        <span className="sr-entry-number">{formatNumber(total)}</span>
        <p>piezas completas publicadas y conectadas con sus fuentes.</p>
      </div>
      <nav aria-labelledby="sr-entry-title">
        <h2 id="sr-entry-title">También puedes empezar por</h2>
        <Link href="/epocas">Recorrer las épocas <EditorialArrow /></Link>
        <Link href="/linea-de-tiempo">Seguir la cronología <EditorialArrow /></Link>
        <Link href="/personas">Investigar una persona <EditorialArrow /></Link>
        <Link href="/archivo">Abrir todo el archivo <EditorialArrow /></Link>
      </nav>
    </section>
  );
}

export default async function BuscarPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string | string[];
    tipo?: string | string[];
    periodo?: string | string[];
    pagina?: string | string[];
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const query = firstParam(sp.q).slice(0, 120);
  const type = typeBySlug(sp.tipo);
  const period = validPeriod(sp.periodo);

  const [pieces, personas, lugares, ideas, stats, articleRanks] = await Promise.all([
    getRecentPublicPieces(5000),
    getConnectedEntityDirectory("persona"),
    getConnectedEntityDirectory("lugar"),
    getConnectedEntityDirectory("idea"),
    getPublicArchiveStats(),
    query ? searchPublishedArticleRanks(query) : Promise.resolve(new Map<string, number>()),
  ]);

  const corpus = buildSearchCorpus(pieces, [...personas, ...lugares, ...ideas]);
  const outcome = query
    ? searchDocs(corpus, query, articleRanks)
    : { hits: [] as SearchHit[], terms: [], partial: false };
  const allHits = outcome.hits;
  const typeCounts = countByType(allHits);
  const periodCounts = new Map<string, number>();
  for (const hit of allHits) {
    if (hit.periodCode) periodCounts.set(hit.periodCode, (periodCounts.get(hit.periodCode) ?? 0) + 1);
  }

  const filtered = allHits.filter(
    (hit) => (!type || hit.typeSlug === type.slug) && (!period || hit.periodCode === period),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(parsePage(sp.pagina), totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);
  const lead = current === 1 ? page[0] : undefined;
  const rows = lead ? page.slice(1) : page;
  const connections = relatedEntities(allHits, personas, lugares, ideas);
  const threads = researchThreads(allHits);
  const timeTrail = chronology(allHits);

  const hrefForPage = (pageNumber: number) => archiveHref("/buscar", {
    q: query,
    tipo: type?.slug,
    periodo: period,
    pagina: pageNumber > 1 ? pageNumber : null,
  });
  return (
    <PublicShell>
      <div className="sr-page">
        <header className="sr-workbench">
          <h1>La búsqueda empieza aquí</h1>
          <div className="sr-search-box">
            <SearchForm
              id="buscar-q"
              defaultValue={query}
              label="Buscar en todo lo publicado"
              placeholder="Una persona, un lugar, un año, una pregunta…"
              hint="Explora únicamente las piezas completas que ya publicamos en el archivo."
              variant="workbench"
            />
          </div>
        </header>

        {!query ? <EmptyEntry total={stats.total} /> : (
          <>
            <div className="sr-summary-bar">
              <div>
                <strong>{formatNumber(filtered.length)}</strong>
                <span>{filtered.length === 1 ? "pieza completa" : "piezas completas"}</span>
                <span>para «{query}»</span>
              </div>
              <p>
                {outcome.partial
                  ? "No hay una pieza con todos los términos; mostramos las coincidencias parciales más útiles."
                  : "Ordenadas por relevancia en el título, el texto completo y su contexto documental."}
              </p>
            </div>

            <div className="sr-investigation">
              <aside className="sr-filters" aria-label="Refinar resultados">
                <div className="sr-rail-title">Refinar</div>
                <section>
                  <h2>Tipo de pieza</h2>
                  <Link
                    href={archiveHref("/buscar", { q: query, periodo: period })}
                    aria-current={!type ? "page" : undefined}
                  >
                    <span>Todo</span><b>{allHits.length}</b>
                  </Link>
                  {ARCHIVE_TYPES.filter((item) => (typeCounts.get(item.slug) ?? 0) > 0).map((item) => (
                    <Link
                      key={item.slug}
                      href={archiveHref("/buscar", { q: query, tipo: item.slug, periodo: period })}
                      aria-current={type?.slug === item.slug ? "page" : undefined}
                    >
                      <span>{item.plural}</span><b>{typeCounts.get(item.slug) ?? 0}</b>
                    </Link>
                  ))}
                </section>
                <section>
                  <h2>Época</h2>
                  <Link
                    href={archiveHref("/buscar", { q: query, tipo: type?.slug })}
                    aria-current={!period ? "page" : undefined}
                  >
                    <span>Todas</span><b>{allHits.length}</b>
                  </Link>
                  {PERIOD_ORDER.filter((code) => (periodCounts.get(code) ?? 0) > 0).map((code) => {
                    const info = periodInfo(code)!;
                    return (
                      <Link
                        key={code}
                        href={archiveHref("/buscar", { q: query, tipo: type?.slug, periodo: code })}
                        aria-current={period === code ? "page" : undefined}
                      >
                        <span>{info.label}</span><b>{periodCounts.get(code)}</b>
                      </Link>
                    );
                  })}
                </section>
                {(type || period) ? (
                  <Link href={archiveHref("/buscar", { q: query })} className="sr-clear">Limpiar filtros</Link>
                ) : null}
              </aside>

              <section className="sr-results" aria-label="Resultados de la búsqueda">
                {page.length === 0 ? (
                  <div className="sr-empty">
                    <h2>No encontramos una pieza completa con esos filtros.</h2>
                  </div>
                ) : (
                  <>
                    {lead ? <LeadArticle hit={lead} query={query} /> : null}
                    {rows.length ? (
                      <section className="sr-complete-list" aria-labelledby="sr-complete-title">
                        <div className="sr-section-head">
                          <h2 id="sr-complete-title">Más piezas completas</h2>
                          <span>{formatNumber(filtered.length)} hallazgos editoriales</span>
                        </div>
                        <ol>
                          {rows.map((hit, index) => (
                            <ArticleRow
                              key={hit.href}
                              hit={hit}
                              query={query}
                              index={start + index + (lead ? 2 : 1)}
                            />
                          ))}
                        </ol>
                      </section>
                    ) : null}
                  </>
                )}

                <ArchivePagination
                  current={current}
                  totalPages={totalPages}
                  hrefFor={hrefForPage}
                  ariaLabel="Páginas de piezas completas"
                />
              </section>

              <aside className="sr-connections" aria-label="Conexiones para continuar investigando">
                {threads.length ? (
                  <section>
                    <div className="sr-rail-title">Hilos para seguir</div>
                    {threads.map((thread) => (
                      <Link key={thread.label} href={archiveHref("/buscar", { q: thread.label })}>
                        <span><strong>{thread.label}</strong><small>{thread.count} piezas relacionadas</small></span>
                        <EditorialArrow />
                      </Link>
                    ))}
                  </section>
                ) : null}
                {timeTrail.length ? (
                  <section className="sr-time-trail">
                    <div className="sr-rail-title">Rastro en el tiempo</div>
                    <ol>
                      {timeTrail.map((hit) => (
                        <li key={`${hit.href}:${hit.yearLabel}`}>
                          <span>{hit.yearLabel}</span>
                          <Link href={hit.href}>{hit.title}</Link>
                        </li>
                      ))}
                    </ol>
                    <Link href="/linea-de-tiempo" className="sr-rail-more">Ver línea de tiempo</Link>
                  </section>
                ) : null}
                {connections.length ? (
                  <section className="sr-related">
                    <div className="sr-rail-title">Entidades conectadas</div>
                    {connections.map((entity) => (
                      <Link key={`${entity.type}:${entity.href}`} href={entity.href}>
                        <span><strong>{entity.name}</strong><small>{entity.type} · {entity.count} coincidencias</small></span>
                        <EditorialArrow />
                      </Link>
                    ))}
                  </section>
                ) : null}
              </aside>
            </div>
          </>
        )}
      </div>
    </PublicShell>
  );
}
