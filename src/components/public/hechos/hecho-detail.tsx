import Link from "next/link";
import { EditorialArrow, EditorialImage } from "@/components/public/home/primitives";
import { PublicShell } from "@/components/public/public-shell";
import { extractProseHeadings, renderProse, type ProseHeading } from "@/components/public/prose";
import { getPeriodColor, periodInfo } from "@/lib/design-tokens";
import type {
  MapPoint,
  ResolvedEntityChip,
  TypologyCard,
  TypologyDetail,
} from "@/lib/public-data";
import type { EntityLinker } from "@/lib/entity-linker";
import { HechoMapPreview } from "./hecho-map-preview";
import { HechoReadingRail } from "./hecho-reading-rail";
import { SourceBibliography, groupEssaySources } from "./source-bibliography";
import "./hecho-detail.css";

export interface HechoEntityContext {
  protagonistas: ResolvedEntityChip[];
  lugares: ResolvedEntityChip[];
  ideas: ResolvedEntityChip[];
}

function EntityLinks({ items }: { items: ResolvedEntityChip[] }) {
  if (!items.length) return <span>—</span>;
  return (
    <span className="hd-entity-links">
      {items.map((item, index) => (
        <span key={`${item.type}:${item.name}`}>
          {index ? ", " : ""}
          {item.href ? <Link href={item.href}>{item.name}</Link> : item.name}
        </span>
      ))}
    </span>
  );
}

function CausalList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="hd-causal-list">
      <h3>{title}</h3>
      {items.length ? (
        <ol>
          {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
        </ol>
      ) : <p>No se registraron elementos separados en la ficha.</p>}
    </div>
  );
}

function EntityCard({ entity }: { entity: ResolvedEntityChip }) {
  const content = (
    <>
      {entity.imageUrl ? (
        <EditorialImage src={entity.imageUrl} alt="" width={320} sizes="160px" />
      ) : <span className="hd-entity-monogram" aria-hidden>{entity.name.charAt(0)}</span>}
      <span>
        <small>{entity.type === "persona" ? "Persona" : entity.type === "lugar" ? "Lugar" : "Idea"}</small>
        <strong>{entity.name}</strong>
      </span>
    </>
  );
  return entity.href ? <Link href={entity.href} className="hd-entity-card">{content}</Link> : <div className="hd-entity-card">{content}</div>;
}

function PeriodTimeline({ facts, currentId }: { facts: TypologyCard[]; currentId: string }) {
  if (!facts.length) return null;
  return (
    <section className="hd-period-timeline" aria-label="Hechos cercanos de la misma época">
      <div className="hd-period-line" aria-hidden />
      {facts.map((fact) => (
        <article key={fact.id} className={fact.id === currentId ? "is-current" : ""}>
          <Link href={fact.href}>
            <EditorialImage src={fact.imageUrl} alt="" width={480} sizes="220px" />
            <span>{fact.meta ?? fact.anio ?? "—"}</span>
            <strong>{fact.titulo}</strong>
          </Link>
        </article>
      ))}
    </section>
  );
}

function Neighbor({ fact, direction }: { fact: TypologyCard | null; direction: "previous" | "next" }) {
  if (!fact) return <span />;
  return (
    <Link href={fact.href} className={`hd-neighbor is-${direction}`}>
      <EditorialImage src={fact.imageUrl} alt="" width={320} sizes="120px" />
      <span>
        <small>{direction === "previous" ? "← Hecho anterior" : "Hecho siguiente →"}</small>
        <strong>{fact.titulo}</strong>
        <em>{fact.meta}</em>
      </span>
    </Link>
  );
}

export function HechoDetail({
  detail,
  linker,
  entities,
  periodCard,
  periodFacts,
  previous,
  next,
  mapPoint,
}: {
  detail: TypologyDetail;
  linker: EntityLinker | null;
  entities: HechoEntityContext;
  periodCard: TypologyCard | null;
  periodFacts: TypologyCard[];
  previous: TypologyCard | null;
  next: TypologyCard | null;
  mapPoint: MapPoint | null;
}) {
  const s = detail.structured;
  if (s.typology !== "hecho") return null;
  const period = s.periodoCode ? periodInfo(s.periodoCode) : null;
  const periodColor = getPeriodColor(s.periodoCode ?? "TRANS");
  const documentCount = groupEssaySources(detail.sources).length;
  const articleHeadings = extractProseHeadings(detail.answer, "lectura-");
  const railHeadings: ProseHeading[] = [
    { id: "sintesis", level: 2, text: "Síntesis" },
    { id: "causalidad", level: 2, text: "Causas y consecuencias" },
    { id: "importancia", level: 2, text: "Por qué importa" },
    { id: "lectura", level: 2, text: "Desarrollo histórico" },
    ...articleHeadings.map((heading) => ({ ...heading, level: 3 as const })),
    { id: "contexto", level: 2, text: "Contexto relacionado" },
    { id: "fuentes", level: 2, text: "Documentos" },
  ];

  return (
    <PublicShell>
      <article className="hd-wrap" data-hecho-article>
        <nav className="hd-crumb" aria-label="Miga de pan">
          <Link href="/hechos">Hechos</Link>
          <span>/</span>
          {periodCard ? <Link href={periodCard.href}>{period?.label ?? periodCard.titulo}</Link> : <span>{period?.label ?? "Historia de Colombia"}</span>}
          <span>/</span>
          <span aria-current="page">{s.titulo}</span>
        </nav>

        <header className="hd-hero">
          <div className="hd-kicker">
            <span style={{ background: periodColor }} />
            Hecho histórico{period ? ` · ${period.label}` : ""}{detail.yearRange ? ` · ${detail.yearRange}` : ""}
          </div>
          <h1>{s.titulo}</h1>
          <p>{s.resumen}</p>
          <div className="hd-byline">
            <span>Por <strong>Alejandro Gutiérrez</strong></span>
            <span>{detail.wordCount.toLocaleString("es-CO")} palabras</span>
            <span>{documentCount.toLocaleString("es-CO")} documentos</span>
            <span>Actualizado {detail.dateLabel}</span>
          </div>
        </header>

        <figure className="hd-cover">
          <EditorialImage src={detail.imageUrl} alt={s.titulo} eager width={1400} sizes="(max-width: 1360px) 100vw, 1288px" />
          <figcaption>{s.fecha ?? (period ? `${period.label} · ${period.yearRange}` : "Archivo histórico colombiano")}</figcaption>
        </figure>

        <div className="hd-reading-grid">
          <HechoReadingRail headings={railHeadings} />
          <div className="hd-main">
            <section className="hd-synthesis" id="sintesis" aria-labelledby="hd-synthesis-title">
              <header className="hd-section-head">
                <span>01</span>
                <div><p>Ficha del acontecimiento</p><h2 id="hd-synthesis-title">Síntesis</h2></div>
              </header>
              <dl>
                <div><dt>Cuándo</dt><dd>{s.fecha ?? "Fecha no separada en la ficha"}</dd></div>
                <div><dt>Dónde</dt><dd><EntityLinks items={entities.lugares} /></dd></div>
                <div><dt>Protagonistas</dt><dd><EntityLinks items={entities.protagonistas} /></dd></div>
              </dl>
            </section>

            <section className="hd-causality" id="causalidad" aria-labelledby="hd-causality-title">
              <header className="hd-section-head">
                <span>02</span>
                <div><p>Lectura causal</p><h2 id="hd-causality-title">Causas, hecho y consecuencias</h2></div>
              </header>
              <div className="hd-causal-grid">
                <CausalList title="Causas" items={s.causas} />
                <div className="hd-causal-event" style={{ "--event-color": periodColor } as React.CSSProperties}>
                  <span>{s.fecha ?? s.anioInicio ?? "—"}</span>
                  <strong>{s.titulo}</strong>
                </div>
                <CausalList title="Consecuencias" items={s.consecuencias} />
              </div>
            </section>

            <section className="hd-importance" id="importancia" aria-labelledby="hd-importance-title">
              <span>03</span>
              <div>
                <p>La clave interpretativa</p>
                <h2 id="hd-importance-title">Por qué importa</h2>
                <blockquote>{s.porQueImporta || s.resumen}</blockquote>
              </div>
            </section>

            <section className="hd-article" id="lectura" aria-labelledby="hd-article-title">
              <header className="hd-section-head">
                <span>04</span>
                <div><p>Desarrollo histórico</p><h2 id="hd-article-title">La historia completa</h2></div>
              </header>
              <div className="prose">
                {renderProse(detail.answer, { linker, headingPrefix: "lectura-" })}
              </div>
            </section>
          </div>
        </div>

        <section className="hd-context" id="contexto" aria-labelledby="hd-context-title">
          <header className="hd-section-head">
            <span>05</span>
            <div><p>La época alrededor</p><h2 id="hd-context-title">Este hecho no ocurrió solo</h2></div>
          </header>
          <PeriodTimeline facts={periodFacts} currentId={detail.id} />
        </section>

        <section className="hd-related" aria-labelledby="hd-related-title">
          <header className="hd-section-head">
            <span>06</span>
            <div><p>Conexiones del archivo</p><h2 id="hd-related-title">Personas, lugares e ideas</h2></div>
          </header>
          <div className="hd-related-grid">
            <div>
              <h3>Protagonistas</h3>
              <div className="hd-entity-grid">{entities.protagonistas.slice(0, 6).map((entity) => <EntityCard key={`${entity.type}:${entity.name}`} entity={entity} />)}</div>
            </div>
            <div className="hd-related-lists">
              <section><h3>Lugares</h3><EntityLinks items={entities.lugares} /></section>
              <section><h3>Ideas y conceptos</h3><EntityLinks items={entities.ideas} /></section>
            </div>
          </div>
          {mapPoint ? <HechoMapPreview point={mapPoint} /> : null}
        </section>

        <SourceBibliography sources={detail.sources} />

        <nav className="hd-neighbors" aria-label="Continuar en la cronología">
          <Neighbor fact={previous} direction="previous" />
          <Link href={periodCard?.href ?? "/hechos"} className="hd-period-return">
            <span>{period ? `Volver a ${period.label}` : "Volver a Hechos"}</span>
            <EditorialArrow />
          </Link>
          <Neighbor fact={next} direction="next" />
        </nav>
      </article>
    </PublicShell>
  );
}
