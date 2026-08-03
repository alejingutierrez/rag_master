import Link from "next/link";
import { BookOpenText, FileStack, Files, Quote } from "lucide-react";
import { PublicShell } from "@/components/public/public-shell";
import { SourceApparatus } from "@/components/public/source-apparatus";
import { extractProseHeadings, renderProse } from "@/components/public/prose";
import { HomePeriodMap } from "@/components/public/home/home-period-map";
import { EditorialArrow, EditorialImage } from "@/components/public/home/primitives";
import { EpochReadingRail } from "@/components/public/epocas/epoch-reading-rail";
import { getPeriodColor, periodInfo, type PeriodCode } from "@/lib/design-tokens";
import type {
  EpochExplorerMoment,
  EpochExplorerPageData,
  ResolvedEntityChip,
  TypologyDetail,
} from "@/lib/public-data";
import type { EntityLinker } from "@/lib/entity-linker";
import "@/components/public/article.css";
import "@/components/public/home/home-redesign.css";
import "@/components/public/epocas/epoch-article.css";

const HEADING_PREFIX = "epoch-section-";
const INTRODUCTION_ID = "epoch-introduction";

function formatNumber(value: number): string {
  return value.toLocaleString("es-CO");
}

function yearLabel(year: number | null): string {
  if (year == null) return "s. f.";
  return year < 0 ? `${formatNumber(Math.abs(year))} a. C.` : formatNumber(year);
}

function metricValue(value: number): string {
  return value > 0 ? formatNumber(value) : "—";
}

function normalizedHeading(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Evita repetir como primer capítulo el mismo título que ya ocupa el hero. */
function withoutRepeatedTitle(markdown: string, titles: string[]): string {
  const lines = markdown.split("\n");
  const firstContent = lines.findIndex((line) => line.trim().length > 0);
  if (firstContent < 0) return markdown;
  const match = lines[firstContent].match(/^#{1,3}\s+(.+)$/);
  if (!match) return markdown;
  const heading = normalizedHeading(match[1]);
  const repeatsTitle = titles.some((title) => normalizedHeading(title) === heading);
  if (!repeatsTitle) return markdown;
  lines.splice(firstContent, 1);
  return lines.join("\n").replace(/^\s*\n/, "");
}

function EpochMetric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="ea-metric">
      <span aria-hidden>{icon}</span>
      <strong>{metricValue(value)}</strong>
      <small>{label}</small>
    </div>
  );
}

function MomentTimeline({ moments }: { moments: EpochExplorerMoment[] }) {
  const visible = moments.slice(0, 8);
  if (!visible.length) return null;
  return (
    <section className="ea-moments" aria-labelledby="ea-moments-title">
      <p className="ea-aside-heading" id="ea-moments-title">
        {visible.length === 8 ? "Ocho momentos" : `${visible.length} momentos`}
      </p>
      <ol>
        {visible.map((moment, index) => (
          <li key={`${moment.year ?? "nd"}:${moment.title}:${index}`}>
            <i aria-hidden />
            <div>
              <time>{yearLabel(moment.year)}</time>
              <strong>{moment.title}</strong>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

type ActorItem = Pick<ResolvedEntityChip, "name" | "href" | "imageUrl">;

function ActorIndex({ actors }: { actors: ActorItem[] }) {
  if (!actors.length) return null;
  return (
    <section className="ea-actors" aria-labelledby="ea-actors-title">
      <header>
        <p>Personas conectadas</p>
        <h2 id="ea-actors-title">Actores de la época</h2>
      </header>
      <div className="ea-actor-grid">
        {actors.map((actor, index) => {
          const contents = (
            <>
              <span className="ea-actor-index">{String(index + 1).padStart(2, "0")}</span>
              <EditorialImage
                src={actor.imageUrl}
                alt={actor.imageUrl ? actor.name : ""}
                className="ea-actor-image"
                width={320}
                sizes="(max-width: 760px) 64px, 82px"
              />
              <strong>{actor.name}</strong>
              {actor.href ? <EditorialArrow /> : null}
            </>
          );
          return actor.href ? (
            <Link key={actor.name} href={actor.href} className="ea-actor is-linked">
              {contents}
            </Link>
          ) : (
            <div key={actor.name} className="ea-actor">
              {contents}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EraNavigation({ data }: { data: EpochExplorerPageData }) {
  const currentIndex = data.periods.findIndex((period) => period.code === data.selected.code);
  const previous = currentIndex > 0 ? data.periods[currentIndex - 1] : null;
  const next = currentIndex < data.periods.length - 1 ? data.periods[currentIndex + 1] : null;
  const hrefFor = (period: EpochExplorerPageData["periods"][number]) =>
    period.articlePublished ? period.href : `/epocas?epoca=${period.code}`;

  return (
    <nav className="ea-era-navigation" aria-label="Navegación entre épocas">
      {previous ? (
        <Link href={hrefFor(previous)} className="ea-era-previous">
          <small>← Época anterior</small>
          <strong>{previous.title}</strong>
          <span>{previous.range}</span>
        </Link>
      ) : (
        <span />
      )}
      <Link href={`/epocas?epoca=${data.selected.code}`} className="ea-era-index">
        Explorar la edición de {data.selected.title}
      </Link>
      {next ? (
        <Link href={hrefFor(next)} className="ea-era-next">
          <small>Época siguiente →</small>
          <strong>{next.title}</strong>
          <span>{next.range}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function EpochArticle({
  detail,
  data,
  linker,
  actors,
  periodCode,
}: {
  detail: TypologyDetail;
  data: EpochExplorerPageData;
  linker: EntityLinker | null;
  actors: ResolvedEntityChip[];
  periodCode: PeriodCode;
}) {
  const structured = detail.structured;
  if (structured.typology !== "epoca") return null;

  const accent = getPeriodColor(periodCode);
  const period = periodInfo(periodCode);
  const bodyMarkdown = withoutRepeatedTitle(detail.answer, [
    structured.titulo,
    data.selected.title,
    `${data.selected.title} (${structured.rango ?? data.selected.range})`,
  ]);
  const headings = extractProseHeadings(bodyMarkdown, HEADING_PREFIX);
  const readerSections = [
    { id: INTRODUCTION_ID, level: 2 as const, text: "Introducción" },
    ...headings,
  ];
  const moments = data.moments.slice(0, 8);
  const connectedActors: ActorItem[] = actors.length
    ? actors
    : data.people.slice(0, 6).map((person) => ({
        name: person.name,
        href: person.href,
        imageUrl: person.imageUrl,
      }));
  const sourceDocumentCount = data.evidence.documents || new Set(
    detail.sources.map((source) => source.documentId).filter(Boolean),
  ).size;

  return (
    <PublicShell>
      <article
        className="ea-page hc-home"
        style={{ "--epoch-accent": accent } as React.CSSProperties}
      >
        <div className="ea-layout">
          <EpochReadingRail sections={readerSections} />

          <main className="ea-main">
            <div className="ea-breadcrumb">
              <Link href={`/epocas?epoca=${periodCode}`}>Épocas</Link>
              <span>/</span>
              <span>{period?.label ?? structured.titulo}</span>
            </div>

            <header className="ea-hero">
              <div className="ea-hero-copy">
                <p>{period?.label ?? "Época histórica"}</p>
                <h1>{data.selected.title}</h1>
                {(structured.rango || detail.yearRange || period?.yearRange) ? (
                  <strong>{structured.rango || detail.yearRange || period?.yearRange}</strong>
                ) : null}
                <div className="ea-deck">{structured.resumen}</div>
                <div className="ea-byline">
                  <span>Alejandro Gutiérrez</span>
                  <span>{detail.dateLabel}</span>
                  {data.evidence.readingMinutes > 0 ? (
                    <span>{data.evidence.readingMinutes} min de lectura</span>
                  ) : null}
                </div>
              </div>
              <figure className="ea-hero-media">
                <EditorialImage
                  src={detail.imageUrl}
                  alt={detail.imageUrl ? structured.titulo : ""}
                  className="ea-hero-image"
                  eager
                  width={1400}
                  sizes="(max-width: 920px) 100vw, 58vw"
                />
              </figure>
            </header>

            <section className="ea-metrics" aria-label="Dimensión documental del ensayo">
              <EpochMetric icon={<BookOpenText />} value={detail.wordCount} label="palabras" />
              <EpochMetric icon={<Quote />} value={moments.length} label="momentos" />
              <EpochMetric icon={<Files />} value={sourceDocumentCount} label="documentos" />
              <EpochMetric
                icon={<FileStack />}
                value={data.evidence.fragments || detail.sources.length}
                label="fragmentos citados"
              />
            </section>

            <EpochReadingRail sections={readerSections} variant="mobile" />

            <section className="ea-prose-section" data-epoch-reader>
              <span className="ea-reader-anchor" id={INTRODUCTION_ID} aria-hidden />
              <div className="prose">
                {renderProse(bodyMarkdown, {
                  linker,
                  headingPrefix: HEADING_PREFIX,
                })}
              </div>
            </section>
          </main>

          <aside className="ea-context" aria-label="Cronología y fuentes">
            <MomentTimeline moments={moments} />
            <div className="ea-sources">
              <SourceApparatus sources={detail.sources} />
            </div>
          </aside>
        </div>

        <div className="ea-afterword">
          {structured.transformaciones.length ? (
            <section className="ea-transformations" aria-labelledby="ea-transformations-title">
              <header>
                <p>Procesos de fondo</p>
                <h2 id="ea-transformations-title">Qué cambió</h2>
              </header>
              <ol>
                {structured.transformaciones.map((transformation, index) => (
                  <li key={`${index}:${transformation}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{transformation}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <ActorIndex actors={connectedActors} />

          {structured.legado ? (
            <section className="ea-legacy" aria-labelledby="ea-legacy-title">
              <p>Una lectura hacia el presente</p>
              <h2 id="ea-legacy-title">El legado de la época</h2>
              <blockquote>{structured.legado}</blockquote>
            </section>
          ) : null}

          <section className="ea-map-section" aria-labelledby="ea-map-title">
            <header>
              <div>
                <p>Historia situada</p>
                <h2 id="ea-map-title">La época sobre el territorio</h2>
              </div>
              <Link href={`/mapa?epoca=${periodCode}`}>
                Abrir mapa completo <EditorialArrow />
              </Link>
            </header>
            <HomePeriodMap periodCode={periodCode} editionLabel={period?.label ?? structured.titulo} />
          </section>

          <EraNavigation data={data} />
        </div>
      </article>
    </PublicShell>
  );
}
