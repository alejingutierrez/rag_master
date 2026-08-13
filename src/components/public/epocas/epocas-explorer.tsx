import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  FileText,
  Landmark,
  Lightbulb,
  MapPin,
  UsersRound,
} from "lucide-react";
import { HomePeriodMap } from "@/components/public/home/home-period-map";
import { HomePeriodSelector } from "@/components/public/home/home-period-selector";
import { SectionMasthead } from "@/components/public/section-masthead";
import {
  EditorialArrow,
  EditorialImage,
  formatEditorialNumber,
} from "@/components/public/home/primitives";
import { getPeriodColor } from "@/lib/design-tokens";
import type {
  EntityChip,
  EpochExplorerMoment,
  EpochExplorerPageData,
  EpochExplorerSummary,
  HubPiece,
} from "@/lib/public-data";

function takeAcross<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  if (limit <= 1) return items.slice(0, 1);
  return Array.from({ length: limit }, (_, index) =>
    items[Math.round((index * (items.length - 1)) / (limit - 1))],
  );
}

function yearLabel(year: number | null): string {
  if (year == null) return "s. f.";
  return year < 0 ? `${Math.abs(year)} a. C.` : String(year);
}

function valueOrDash(value: number): string {
  return value > 0 ? formatEditorialNumber(value) : "—";
}

function SelectorNeighbor({
  period,
  direction,
}: {
  period: EpochExplorerSummary;
  direction: "previous" | "next";
}) {
  return (
    <Link
      href={`/epocas?epoca=${period.code}`}
      scroll={false}
      className={`ex-neighbor ex-neighbor-${direction}`}
      aria-label={`${direction === "previous" ? "Época anterior" : "Época siguiente"}: ${period.title}`}
    >
      <EditorialImage
        src={period.imageUrl}
        alt=""
        className="ex-neighbor-image"
        width={640}
        sizes="18vw"
      />
      <span className="ex-neighbor-shade" aria-hidden />
      <span className="ex-neighbor-copy">
        <small>{direction === "previous" ? "← Anterior" : "Siguiente →"}</small>
        <strong>{period.title}</strong>
      </span>
    </Link>
  );
}

function MomentStrip({ moments }: { moments: EpochExplorerMoment[] }) {
  const featured = takeAcross(moments, 4);
  return (
    <ol className="ex-orientation-moments" aria-label="Momentos de orientación">
      {featured.map((moment, index) => (
        <li key={`${moment.year ?? "nd"}:${moment.title}`}>
          <span className="ex-moment-dot" aria-hidden />
          <div>
            <strong>{yearLabel(moment.year)}</strong>
            <span>{moment.title}</span>
          </div>
          {index < featured.length - 1 ? <i aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}

function Metric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="ex-metric">
      <span aria-hidden>{icon}</span>
      <strong>{formatEditorialNumber(value)}</strong>
      <small>{label}</small>
    </div>
  );
}

function SectionHeading({
  number,
  eyebrow,
  title,
  description,
  id,
}: {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  id: string;
}) {
  return (
    <header className="ex-section-heading">
      <span className="ex-section-number">{number}</span>
      <div>
        <p>{eyebrow}</p>
        <h2 id={id}>{title}</h2>
        <span>{description}</span>
      </div>
    </header>
  );
}

function MomentGrid({ moments }: { moments: EpochExplorerMoment[] }) {
  const visible = takeAcross(moments, 8);
  return (
    <ol className="ex-moments-grid">
      {visible.map((moment, index) => (
        <li key={`${moment.year ?? "nd"}:${moment.title}`}>
          <div className="ex-moment-index">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <i aria-hidden />
          </div>
          <time>{yearLabel(moment.year)}</time>
          <h3>{moment.title}</h3>
          {moment.detail ? <p>{moment.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}

function FactCard({ fact, index }: { fact: HubPiece; index: number }) {
  return (
    <Link href={fact.href} className={`ex-fact-card ex-fact-${index + 1}`}>
      <div className="ex-fact-media">
        <EditorialImage
          src={fact.imageUrl}
          alt=""
          className="ex-fact-image"
          width={960}
          sizes="(max-width: 760px) 100vw, 50vw"
        />
        <span className="ex-fact-number">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="ex-fact-copy">
        <span>{fact.yearLabel ?? yearLabel(fact.anio)}</span>
        <h3>{fact.titulo}</h3>
        <p>{fact.resumen}</p>
        <small>Leer el hecho <EditorialArrow /></small>
      </div>
    </Link>
  );
}

function ReadingFeature({ reading }: { reading: HubPiece }) {
  return (
    <Link href={reading.href} className="ex-reading-feature">
      <EditorialImage
        src={reading.imageUrl}
        alt=""
        className="ex-reading-feature-image"
        width={960}
        sizes="(max-width: 760px) 100vw, 58vw"
      />
      <div>
        <span>Lectura central</span>
        <h3>{reading.titulo}</h3>
        <p>{reading.resumen}</p>
        <small>Abrir lectura <EditorialArrow /></small>
      </div>
    </Link>
  );
}

function ReadingIndex({ readings }: { readings: HubPiece[] }) {
  return (
    <ol className="ex-reading-index">
      {readings.map((reading, index) => (
        <li key={reading.href}>
          <span>{String(index + 2).padStart(2, "0")}</span>
          <Link href={reading.href}>
            <small>{reading.kind === "pregunta" ? "Pregunta" : "Ensayo"}</small>
            <strong>{reading.titulo}</strong>
          </Link>
          <EditorialArrow />
        </li>
      ))}
    </ol>
  );
}

function PersonCard({ person, index }: { person: EntityChip; index: number }) {
  return (
    <Link href={person.href} className="ex-person-card">
      <EditorialImage
        src={person.imageUrl}
        alt={person.name}
        className="ex-person-image"
        width={480}
        sizes="(max-width: 760px) 50vw, 16vw"
      />
      <span>{String(index + 1).padStart(2, "0")}</span>
      <h3>{person.name}</h3>
      <small>{person.count} {person.count === 1 ? "pieza conectada" : "piezas conectadas"}</small>
    </Link>
  );
}

function EntityList({
  title,
  icon,
  entities,
  total,
  href,
}: {
  title: string;
  icon: React.ReactNode;
  entities: EntityChip[];
  total: number;
  href: string;
}) {
  return (
    <section className="ex-entity-list">
      <header>
        <span aria-hidden>{icon}</span>
        <h3>{title}</h3>
        <strong>{total}</strong>
      </header>
      {entities.length ? (
        <ol>
          {entities.slice(0, 6).map((entity, index) => (
            <li key={entity.href}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <Link href={entity.href}>{entity.name}</Link>
              <small>{entity.count}</small>
            </li>
          ))}
        </ol>
      ) : (
        <p>Aún no hay entradas publicadas en este directorio.</p>
      )}
      <Link href={href}>Abrir directorio <EditorialArrow /></Link>
    </section>
  );
}

export function EpocasExplorer({ data }: { data: EpochExplorerPageData }) {
  const currentIndex = data.periods.findIndex((period) => period.code === data.selected.code);
  const previous = data.periods[(currentIndex - 1 + data.periods.length) % data.periods.length];
  const next = data.periods[(currentIndex + 1) % data.periods.length];
  const featuredFacts = takeAcross(data.facts, 4);
  const visibleMoments = takeAcross(data.moments, 8);
  const readings = data.readings.slice(0, 5);
  const centralReading = readings[0];
  const otherReadings = readings.slice(1);
  const accent = getPeriodColor(data.selected.code);

  return (
    <div
      className="hc-home ex-page"
      data-mode="light"
      style={{ "--epoch-accent": accent } as React.CSSProperties}
    >
      <div className="ex-selector-wrap">
        <SectionMasthead
          eyebrow="02 · Tiempo histórico"
          title="Épocas"
          summary="Quince períodos para recorrer el archivo en orden y comprender qué cambia de uno al siguiente."
          meta={`${String(data.selected.index).padStart(2, "0")} de ${data.periods.length} · ${data.selected.title}`}
        >
          <HomePeriodSelector selectedPeriod={data.selected.code} destination="epocas" />
        </SectionMasthead>
      </div>

      <main>
        <section className="ex-hero" aria-labelledby="ex-title">
          <div className="ex-window">
            <SelectorNeighbor period={previous} direction="previous" />
            <article className="ex-current">
              <EditorialImage
                src={data.selected.imageUrl}
                alt=""
                className="ex-current-image"
                eager
                width={1400}
                sizes="(max-width: 760px) 100vw, 68vw"
              />
              <span className="ex-current-shade" aria-hidden />
              <div className="ex-current-copy">
                <span>{String(data.selected.index).padStart(2, "0")} de {data.periods.length}</span>
                <h2 id="ex-title">{data.selected.title}<small>{data.selected.range}</small></h2>
                <i aria-hidden />
                <p>{data.selected.summary}</p>
                {data.selected.articlePublished ? (
                  <Link href={data.selected.href}>Entrar en la época <EditorialArrow /></Link>
                ) : null}
              </div>
            </article>
            <SelectorNeighbor period={next} direction="next" />
          </div>

          <nav className="ex-window-controls" aria-label="Navegar entre épocas">
            <Link href={`/epocas?epoca=${previous.code}`} scroll={false}>← {previous.title}</Link>
            <div aria-hidden>
              <span style={{ width: `${((currentIndex + 1) / data.periods.length) * 100}%` }} />
              <i style={{ left: `${(currentIndex / (data.periods.length - 1)) * 100}%` }} />
            </div>
            <Link href={`/epocas?epoca=${next.code}`} scroll={false}>{next.title} →</Link>
          </nav>

          <div className="ex-orientation">
            <MomentStrip moments={data.moments} />
            <div className="ex-orientation-summary">
              <div className="ex-metrics">
                <Metric icon={<FileText />} value={data.counts.pieces} label="piezas" />
                <Metric icon={<CalendarDays />} value={data.counts.facts} label="hechos" />
                <Metric icon={<BookOpen />} value={data.counts.readings} label="lecturas" />
                <Metric icon={<UsersRound />} value={data.counts.people} label="personas" />
              </div>
              <Link href="#hechos">Explorar los {data.counts.pieces} contenidos <EditorialArrow /></Link>
            </div>
          </div>
        </section>

        <nav className="ex-local-nav" aria-label="Secciones de esta época">
          <span>En esta época</span>
          <Link href="#comprender">Comprender</Link>
          <Link href="#momentos">Momentos</Link>
          <Link href="#hechos">Hechos</Link>
          <Link href="#lecturas">Lecturas</Link>
          <Link href="#conexiones">Conexiones</Link>
        </nav>

        <section className="ex-section ex-understand" aria-labelledby="ex-understand-title" id="comprender">
          <SectionHeading
            number="01"
            eyebrow="Comprender el período"
            title="La época, antes de sus episodios"
            description="Una vista panorámica para entender qué cambió, quiénes actuaron y qué quedó abierto."
            id="ex-understand-title"
          />

          <div className="ex-panorama">
            <div className="ex-panorama-copy">
              <span>Panorama</span>
              <p>{data.panorama}</p>
              {data.transformations.length ? (
                <ul>
                  {data.transformations.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
              {data.selected.articlePublished ? (
                <Link href={data.selected.href}>Leer el artículo completo <EditorialArrow /></Link>
              ) : null}
            </div>

            <aside className="ex-article-proof">
              <span>La síntesis de esta época</span>
              <h3>{data.selected.articleTitle}</h3>
              <p>{data.legacy}</p>
              <dl>
                <div><dt>{valueOrDash(data.evidence.words)}</dt><dd>palabras</dd></div>
                <div><dt>{valueOrDash(data.evidence.documents)}</dt><dd>documentos</dd></div>
                <div><dt>{valueOrDash(data.evidence.fragments)}</dt><dd>fragmentos citados</dd></div>
              </dl>
            </aside>
          </div>

          <div className="ex-moments" id="momentos">
            <header>
              <span>Secuencia canónica</span>
              <h3>{visibleMoments.length} momentos que ordenan la época</h3>
              <p>Una columna vertebral temporal antes de abrir cada hecho en detalle.</p>
            </header>
            {visibleMoments.length ? <MomentGrid moments={visibleMoments} /> : (
              <p className="ex-empty">Esta época aún no tiene momentos estructurados.</p>
            )}
          </div>
        </section>

        <section className="ex-section ex-facts" aria-labelledby="ex-facts-title" id="hechos">
          <SectionHeading
            number="02"
            eyebrow="Explorar los acontecimientos"
            title={`${data.counts.facts} hechos para entrar en la historia`}
            description="Cuatro puertas de entrada distribuidas a lo largo del período; el archivo conserva la lista completa."
            id="ex-facts-title"
          />
          {featuredFacts.length ? (
            <div className="ex-facts-grid">
              {featuredFacts.map((fact, index) => <FactCard key={fact.href} fact={fact} index={index} />)}
            </div>
          ) : (
            <p className="ex-empty">Aún no hay hechos publicados para esta época.</p>
          )}
          <Link href={`/hechos?periodo=${data.selected.code}`} className="ex-all-link">
            Ver los {data.counts.facts} hechos de {data.selected.title} <EditorialArrow />
          </Link>
        </section>

        <section className="ex-section ex-readings" aria-labelledby="ex-readings-title" id="lecturas">
          <SectionHeading
            number="03"
            eyebrow="Interpretar y discutir"
            title={`${data.counts.readings} lecturas para ir más hondo`}
            description="Ensayos y preguntas que no solo narran: comparan, discuten y proponen una interpretación."
            id="ex-readings-title"
          />
          {centralReading ? (
            <div className="ex-readings-layout">
              <ReadingFeature reading={centralReading} />
              <ReadingIndex readings={otherReadings} />
            </div>
          ) : (
            <p className="ex-empty">Aún no hay lecturas publicadas para esta época.</p>
          )}
          <Link href={`/ensayos?periodo=${data.selected.code}`} className="ex-all-link">
            Abrir todas las lecturas <EditorialArrow />
          </Link>
        </section>

        <section className="ex-section ex-connections" aria-labelledby="ex-connections-title" id="conexiones">
          <SectionHeading
            number="04"
            eyebrow="Conectar el archivo"
            title="Protagonistas, territorio e ideas"
            description="Cada nombre y cada lugar conduce a una pieza publicada: aquí no hay vínculos vacíos."
            id="ex-connections-title"
          />

          <div className="ex-people-heading">
            <h3>Protagonistas de {data.selected.title}</h3>
            <Link href={`/personas?periodo=${data.selected.code}`}>{data.counts.people} personas <EditorialArrow /></Link>
          </div>
          {data.people.length ? (
            <div className="ex-people-grid">
              {data.people.slice(0, 6).map((person, index) => (
                <PersonCard key={person.href} person={person} index={index} />
              ))}
            </div>
          ) : (
            <p className="ex-empty">Aún no hay protagonistas con ficha publicada.</p>
          )}

          <div className="ex-geography">
            <div className="ex-map-wrap">
              <header>
                <span><MapPin aria-hidden /> El archivo sobre el territorio</span>
                <Link href="/mapa">Mapa completo <EditorialArrow /></Link>
              </header>
              <HomePeriodMap
                key={data.selected.code}
                periodCode={data.selected.code}
                editionLabel={data.selected.title}
              />
            </div>
            <aside>
              <EntityList
                title="Lugares clave"
                icon={<Landmark />}
                entities={data.places}
                total={data.counts.places}
                href="/lugares"
              />
              <EntityList
                title="Ideas en circulación"
                icon={<Lightbulb />}
                entities={data.ideas}
                total={data.counts.ideas}
                href={`/ideas?periodo=${data.selected.code}`}
              />
            </aside>
          </div>
        </section>

        <section className="ex-evidence" aria-labelledby="ex-evidence-title">
          <div>
            <span>05 · Método y fuentes</span>
            <h2 id="ex-evidence-title">Una síntesis con el archivo a la vista</h2>
            <p>
              El panorama de {data.selected.title} se construyó con documentos y fragmentos
              trazables. El artículo conserva las citas para que pueda verificarse.
            </p>
            {data.selected.articlePublished ? (
              <Link href={data.selected.href}>Abrir artículo y fuentes <EditorialArrow /></Link>
            ) : null}
          </div>
          <dl>
            <div><dt>{valueOrDash(data.evidence.documents)}</dt><dd>documentos</dd></div>
            <div><dt>{valueOrDash(data.evidence.fragments)}</dt><dd>fragmentos</dd></div>
            <div><dt>{valueOrDash(data.evidence.words)}</dt><dd>palabras</dd></div>
            <div><dt>{valueOrDash(data.evidence.readingMinutes)}</dt><dd>minutos de lectura</dd></div>
          </dl>
        </section>

        <section className="ex-next" aria-labelledby="ex-next-title">
          <EditorialImage
            src={next.imageUrl}
            alt=""
            className="ex-next-image"
            width={1400}
            sizes="100vw"
          />
          <span className="ex-next-shade" aria-hidden />
          <div>
            <span>La historia continúa · {String(next.index).padStart(2, "0")} de {data.periods.length}</span>
            <h2 id="ex-next-title">{next.title}<small>{next.range}</small></h2>
            <p>{next.summary}</p>
            <Link href={`/epocas?epoca=${next.code}`} scroll={false}>
              Explorar la siguiente época <EditorialArrow />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
