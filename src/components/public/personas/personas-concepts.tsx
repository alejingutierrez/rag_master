"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import type { PublicEntity } from "@/lib/public-data";
import { HomePeriodSelector } from "@/components/public/home/home-period-selector";
import {
  getPeriodColor,
  HISTORICAL_PERIODS,
  PERIODS,
  type PeriodCode,
} from "@/lib/design-tokens";
import { imageAt, type ImageWidth } from "@/lib/image-url";
import "./personas-concepts.css";

type ConceptOption = 1 | 2 | 3 | 4 | 5;

const OPTIONS: Array<{ id: ConceptOption; name: string; thesis: string }> = [
  { id: 1, name: "Galería curada", thesis: "Jerarquía visual y descubrimiento" },
  { id: 2, name: "Índice biográfico", thesis: "Consulta rápida y alta densidad" },
  { id: 3, name: "Personas por época", thesis: "La época como estructura principal" },
  { id: 4, name: "Portada editorial", thesis: "Una entrada narrativa al archivo" },
  { id: 5, name: "Mosaico de protagonistas", thesis: "Impacto visual e inmersión" },
];

function norm(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function portrait(entity: PublicEntity, width: ImageWidth, className?: string) {
  return (
    <div className={className ?? "pc-photo"}>
      {entity.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageAt(entity.imageUrl, width)!} alt="" aria-hidden loading="lazy" />
      ) : (
        <span aria-hidden>{entity.name.charAt(0)}</span>
      )}
    </div>
  );
}

function periodOf(entity: PublicEntity): PeriodCode | null {
  const code = entity.periods.find((candidate) => candidate in PERIODS);
  return code ? (code as PeriodCode) : null;
}

function periodLabel(entity: PublicEntity): string {
  const code = periodOf(entity);
  return code ? PERIODS[code].label : "Trayectoria transversal";
}

function mentionLabel(value: number): string {
  if (value === 0) return "Biografía propia";
  return `${value} ${value === 1 ? "aparición" : "apariciones"}`;
}

function PersonLink({ entity, children, className }: {
  entity: PublicEntity;
  children: React.ReactNode;
  className?: string;
}) {
  return <Link href={entity.href} className={className}>{children}</Link>;
}

function ConceptIntro({ eyebrow, title, intro, count }: {
  eyebrow: string;
  title: string;
  intro: string;
  count: number;
}) {
  return (
    <header className="pc-intro">
      <div className="pc-intro-copy">
        <span className="pc-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
      <div className="pc-total"><strong>{count}</strong><span>vidas documentadas</span></div>
    </header>
  );
}

function FilterBar({
  query,
  onQuery,
  period,
  onPeriod,
  periods,
  resultCount,
  useHomeSelector = false,
}: {
  query: string;
  onQuery: (value: string) => void;
  period: string | null;
  onPeriod: (value: string | null) => void;
  periods: PeriodCode[];
  resultCount: number;
  useHomeSelector?: boolean;
}) {
  return (
    <div className={`pc-filterbar${useHomeSelector ? " is-home-selector" : ""}`}>
      <label className="pc-search">
        <span>Buscar</span>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Nombre, trayectoria o hecho…"
        />
      </label>
      {useHomeSelector ? (
        <div className="pc-home-period-selector">
          <HomePeriodSelector
            selectedPeriod={period as PeriodCode | null}
            destination="personas"
            onSelect={onPeriod}
            availablePeriods={periods}
          />
        </div>
      ) : (
        <div className="pc-periods" role="group" aria-label="Filtrar por época">
          <button type="button" className={!period ? "is-active" : ""} onClick={() => onPeriod(null)}>
            Todas
          </button>
          {periods.map((code) => (
            <button
              key={code}
              type="button"
              className={period === code ? "is-active" : ""}
              onClick={() => onPeriod(period === code ? null : code)}
              title={`${PERIODS[code].label}, ${PERIODS[code].yearRange}`}
            >
              <i style={{ background: getPeriodColor(code) }} />
              {PERIODS[code].short}
            </button>
          ))}
        </div>
      )}
      <span className="pc-result-count">{resultCount} resultados</span>
    </div>
  );
}

function GalleryConcept({ entities, allCount }: { entities: PublicEntity[]; allCount: number }) {
  const hero = entities.slice(0, 5);
  const more = entities.slice(5);
  const routes = [
    {
      number: "01",
      title: "Fundar la República",
      description: "Independencia, leyes y disputas por la forma del nuevo Estado.",
      period: "IND" as PeriodCode,
      people: entities.filter((entity) => ["IND", "NGR", "EUC"].some((code) => entity.periods.includes(code))),
    },
    {
      number: "02",
      title: "Gobernar el siglo XX",
      description: "Reformas, partidos y proyectos de país en una sociedad que se transforma.",
      period: "REP_LIB" as PeriodCode,
      people: entities.filter((entity) => ["REG", "REP_LIB", "VIO", "FN"].some((code) => entity.periods.includes(code))),
    },
    {
      number: "03",
      title: "Guerra, paz y democracia",
      description: "Las vidas que atravesaron el conflicto contemporáneo y sus salidas políticas.",
      period: "C91" as PeriodCode,
      people: entities.filter((entity) => ["CNA", "C91", "SDE", "POS"].some((code) => entity.periods.includes(code))),
    },
  ].filter((route) => route.people.length > 0);
  if (hero.length === 0) return <EmptyConcept />;

  return (
    <div className="pc-concept pc-gallery" data-testid="concept-1">
      <ConceptIntro
        eyebrow="Quién hizo la historia"
        title="Personas"
        intro="Una galería curada de las vidas que cambiaron el rumbo de Colombia. Entre por un rostro; siga por sus decisiones, conflictos y legados."
        count={allCount}
      />

      <section className="pc-gallery-lead" aria-label="Personas destacadas">
        <PersonLink entity={hero[0]} className="pc-gallery-main">
          {portrait(hero[0], 1400)}
          <div className="pc-gallery-caption">
            <span>{periodLabel(hero[0])}</span>
            <h2>{hero[0].name}</h2>
            <p>{hero[0].resumen}</p>
          </div>
        </PersonLink>
        <div className="pc-gallery-side">
          {hero.slice(1).map((entity) => (
            <PersonLink key={entity.slug} entity={entity} className="pc-gallery-tile">
              {portrait(entity, 640)}
              <div><span>{periodLabel(entity)}</span><h3>{entity.name}</h3></div>
            </PersonLink>
          ))}
        </div>
      </section>

      {routes.length > 0 && (
        <section className="pc-gallery-routes" aria-labelledby="pc-gallery-routes-title">
          <div className="pc-section-label">
            <span id="pc-gallery-routes-title">Tres recorridos para entrar</span>
            <span>Selecciones editoriales</span>
          </div>
          <div className="pc-route-grid">
            {routes.map((route) => (
              <Link key={route.number} href={`/personas?periodo=${route.period}`} className="pc-route-card">
                <div className="pc-route-head">
                  <b>{route.number}</b>
                  <span>{route.people.length} biografías</span>
                </div>
                <div className="pc-route-portraits" aria-hidden>
                  {route.people.slice(0, 3).map((entity) => (
                    <div key={entity.slug}>{portrait(entity, 320)}</div>
                  ))}
                </div>
                <h2>{route.title}</h2>
                <p>{route.description}</p>
                <em>Recorrer este capítulo <b>→</b></em>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="pc-gallery-directory" data-testid="gallery-person-directory" aria-labelledby="pc-gallery-directory-title">
        <div className="pc-section-label">
          <span id="pc-gallery-directory-title">Todas las biografías</span>
          <span>{entities.length} personas · ordenadas por presencia en el archivo</span>
        </div>
        <div className="pc-gallery-more">
        {more.map((entity) => (
          <PersonLink key={entity.slug} entity={entity}>
            {portrait(entity, 480)}
            <span>{mentionLabel(entity.mentions)}</span>
            <h3>{entity.name}</h3>
          </PersonLink>
        ))}
        </div>
      </section>

      <footer className="pc-gallery-close">
        <span>El archivo sigue creciendo</span>
        <p>Cada biografía conecta una vida con sus fuentes, sus épocas y los hechos donde dejó huella.</p>
        <Link href="/como-trabajamos">Cómo construimos las biografías <b>→</b></Link>
      </footer>
    </div>
  );
}

function IndexConcept({ entities, allCount }: { entities: PublicEntity[]; allCount: number }) {
  const alphabet = [...new Set(entities.map((entity) => norm(entity.name).charAt(0).toUpperCase()))].sort();
  return (
    <div className="pc-concept pc-index" data-testid="concept-2">
      <ConceptIntro
        eyebrow="Directorio razonado"
        title="Índice biográfico"
        intro="Un directorio preciso para consultar el archivo por nombre, época y relevancia documental."
        count={allCount}
      />
      <div className="pc-index-layout">
        <aside className="pc-index-rail">
          <span className="pc-rail-label">Navegar por inicial</span>
          <div className="pc-alphabet" aria-hidden>
            {alphabet.map((letter) => <span key={letter}>{letter}</span>)}
          </div>
          <div className="pc-index-note">
            <strong>{entities.length}</strong>
            <span>biografías en esta selección</span>
          </div>
        </aside>
        <ol className="pc-index-list">
          {entities.map((entity, index) => {
            const code = periodOf(entity);
            return (
              <li key={entity.slug}>
                <PersonLink entity={entity}>
                  <span className="pc-index-number">{String(index + 1).padStart(3, "0")}</span>
                  {portrait(entity, 320, "pc-index-photo")}
                  <div className="pc-index-name">
                    <h2>{entity.name}</h2>
                    <p>{entity.resumen}</p>
                  </div>
                  <div className="pc-index-meta">
                    {code && <i style={{ background: getPeriodColor(code) }} />}
                    <span>{periodLabel(entity)}</span>
                    <small>{mentionLabel(entity.mentions)}</small>
                  </div>
                  <b aria-hidden>↗</b>
                </PersonLink>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function TimelineConcept({ entities, allCount }: { entities: PublicEntity[]; allCount: number }) {
  const groups = HISTORICAL_PERIODS.map((code) => ({
    code,
    people: entities.filter(
      (entity) => HISTORICAL_PERIODS.find((candidate) => entity.periods.includes(candidate)) === code,
    ),
  })).filter((group) => group.people.length > 0);
  const assigned = new Set(groups.flatMap((group) => group.people.map((entity) => entity.slug)));
  const transversal = entities.filter((entity) => !assigned.has(entity.slug));

  return (
    <div className="pc-concept pc-timeline" data-testid="concept-3">
      <ConceptIntro
        eyebrow="Quiénes hicieron la historia"
        title="Personas"
        intro="Cada biografía ocupa su lugar dentro de la época que ayudó a transformar. Los grandes protagonistas abren el recorrido; el archivo completo permanece a la vista."
        count={allCount}
      />
      <div className="pc-timeline-key">
        <span><b>01</b>Cada persona aparece una sola vez, en su época histórica principal.</span>
        <span><b>02</b>Los retratos grandes distinguen las figuras centrales; las demás conservan una presencia visual compacta.</span>
        <span><b>03</b>Las trayectorias sin un único anclaje temporal cierran el recorrido.</span>
      </div>
      <div className="pc-era-groups" data-testid="timeline-person-directory">
        {groups.map(({ code, people }) => (
          <section key={code} className="pc-era-group">
            <header style={{ borderColor: getPeriodColor(code) }}>
              <span>{PERIODS[code].short}</span>
              <div><h2>{PERIODS[code].label}</h2><p>{PERIODS[code].yearRange}</p></div>
              <small>{people.length} {people.length === 1 ? "vida" : "vidas"}</small>
            </header>
            <div className="pc-era-content">
              <div
                className="pc-era-people"
                style={{ "--pc-era-columns": Math.min(people.length, 4) } as CSSProperties}
              >
                {people.slice(0, 4).map((entity) => (
                  <PersonLink key={entity.slug} entity={entity}>
                    {portrait(entity, 480)}
                    <span>{mentionLabel(entity.mentions)}</span>
                    <h3>{entity.name}</h3>
                  </PersonLink>
                ))}
              </div>
              {people.length > 4 && (
                <div className="pc-era-rest" aria-label={`Más personas de ${PERIODS[code].label}`}>
                  {people.slice(4).map((entity, index) => (
                    <PersonLink key={entity.slug} entity={entity}>
                      <b>{String(index + 5).padStart(2, "0")}</b>
                      {portrait(entity, 320, "pc-era-mini-photo")}
                      <span><strong>{entity.name}</strong><small>{mentionLabel(entity.mentions)}</small></span>
                      <em aria-hidden>↗</em>
                    </PersonLink>
                  ))}
                </div>
              )}
            </div>
          </section>
        ))}
        {transversal.length > 0 && (
          <section className="pc-era-group pc-era-transversal">
            <header style={{ borderColor: getPeriodColor("TRANS") }}>
              <span>{PERIODS.TRANS.short}</span>
              <div><h2>Trayectorias transversales</h2><p>Más de una época</p></div>
              <small>{transversal.length} {transversal.length === 1 ? "vida" : "vidas"}</small>
            </header>
            <div className="pc-era-content">
              <div className="pc-era-rest">
                {transversal.map((entity, index) => (
                  <PersonLink key={entity.slug} entity={entity}>
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    {portrait(entity, 320, "pc-era-mini-photo")}
                    <span><strong>{entity.name}</strong><small>{mentionLabel(entity.mentions)}</small></span>
                    <em aria-hidden>↗</em>
                  </PersonLink>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
      <footer className="pc-timeline-close">
        <span>Quince épocas, un archivo conectado</span>
        <h2>Una vida explica un momento.<br />Juntas explican un país.</h2>
        <Link href="/linea-de-tiempo">Explorar ahora la línea de tiempo <b>→</b></Link>
      </footer>
    </div>
  );
}

function CoverConcept({ entities, allCount }: { entities: PublicEntity[]; allCount: number }) {
  const [lead, ...rest] = entities;
  if (!lead) return <EmptyConcept />;
  const secondary = rest.slice(0, 2);
  const index = rest.slice(2, 10);

  return (
    <div className="pc-concept pc-cover" data-testid="concept-4">
      <div className="pc-cover-mast">
        <span>Edición biográfica · Archivo público</span>
        <strong>{allCount} vidas para leer la historia de Colombia</strong>
      </div>
      <PersonLink entity={lead} className="pc-cover-lead">
        <div className="pc-cover-copy">
          <span>Figura de portada · {periodLabel(lead)}</span>
          <h1>{lead.name}</h1>
          <p>{lead.resumen}</p>
          <em>Leer la biografía <b>→</b></em>
        </div>
        {portrait(lead, 1400, "pc-cover-photo")}
      </PersonLink>
      <div className="pc-cover-deck">
        <section>
          <span className="pc-eyebrow">Dos vidas, dos momentos</span>
          <div className="pc-cover-secondary">
            {secondary.map((entity) => (
              <PersonLink key={entity.slug} entity={entity}>
                {portrait(entity, 640)}
                <span>{periodLabel(entity)}</span>
                <h2>{entity.name}</h2>
                <p>{entity.resumen}</p>
              </PersonLink>
            ))}
          </div>
        </section>
        <aside>
          <span className="pc-eyebrow">Esenciales del archivo</span>
          <ol>
            {index.map((entity, itemIndex) => (
              <li key={entity.slug}>
                <PersonLink entity={entity}>
                  <b>{String(itemIndex + 1).padStart(2, "0")}</b>
                  <span>{entity.name}<small>{periodLabel(entity)}</small></span>
                </PersonLink>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

function MosaicConcept({ entities, allCount }: { entities: PublicEntity[]; allCount: number }) {
  return (
    <div className="pc-concept pc-mosaic" data-testid="concept-5">
      <header className="pc-mosaic-intro">
        <span>Un atlas humano de Colombia</span>
        <h1>Personas</h1>
        <p>{allCount} vidas. Cinco siglos. Una historia hecha de decisiones individuales y consecuencias colectivas.</p>
        <div><strong>{allCount}</strong><small>biografías publicadas</small></div>
      </header>
      <div className="pc-mosaic-grid">
        {entities.slice(0, 18).map((entity, index) => (
          <PersonLink key={entity.slug} entity={entity} className={`pc-mosaic-card pc-mosaic-card-${index % 7}`}>
            {portrait(entity, index % 7 === 0 ? 960 : 640)}
            <div>
              <span>{periodLabel(entity)}</span>
              <h2>{entity.name}</h2>
              {(index % 7 === 0 || index % 7 === 4) && <p>{entity.resumen}</p>}
            </div>
          </PersonLink>
        ))}
      </div>
    </div>
  );
}

function EmptyConcept() {
  return <div className="pc-empty">No hay personas que coincidan con esta búsqueda.</div>;
}

export function PersonasByPeriod({
  entities,
  initialPeriod = null,
}: {
  entities: PublicEntity[];
  initialPeriod?: PeriodCode | null;
}) {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<PeriodCode | null>(initialPeriod);
  const periods = useMemo(
    () => HISTORICAL_PERIODS.filter((code) => entities.some((entity) => entity.periods.includes(code))),
    [entities],
  );
  const filtered = useMemo(() => {
    const needle = norm(query.trim());
    return entities.filter((entity) => {
      if (period && !entity.periods.includes(period)) return false;
      if (needle && !norm(`${entity.name} ${entity.resumen ?? ""}`).includes(needle)) return false;
      return true;
    });
  }, [entities, period, query]);

  const choosePeriod = (next: string | null) => {
    const nextPeriod = next as PeriodCode | null;
    setPeriod(nextPeriod);
    window.history.replaceState(
      null,
      "",
      nextPeriod ? `/personas?periodo=${nextPeriod}` : "/personas",
    );
  };

  return (
    <div className="pc-page pc-option-3 pc-production">
      <div className="pc-filter-shell">
        <FilterBar
          query={query}
          onQuery={setQuery}
          period={period}
          onPeriod={choosePeriod}
          periods={periods}
          resultCount={filtered.length}
          useHomeSelector
        />
      </div>
      {filtered.length > 0 ? (
        <TimelineConcept entities={filtered} allCount={entities.length} />
      ) : (
        <EmptyConcept />
      )}
    </div>
  );
}

export function PersonasConcepts({ entities, initialOption }: {
  entities: PublicEntity[];
  initialOption: number;
}) {
  const [option, setOption] = useState<ConceptOption>(initialOption as ConceptOption);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<string | null>(null);

  const periods = useMemo(
    () => HISTORICAL_PERIODS.filter((code) => entities.some((entity) => entity.periods.includes(code))),
    [entities],
  );
  const filtered = useMemo(() => {
    const needle = norm(query.trim());
    return entities.filter((entity) => {
      if (period && !entity.periods.includes(period)) return false;
      if (needle && !norm(`${entity.name} ${entity.resumen ?? ""}`).includes(needle)) return false;
      return true;
    });
  }, [entities, period, query]);
  const selected = OPTIONS.find((item) => item.id === option) ?? OPTIONS[0];

  const choose = (next: ConceptOption) => {
    setOption(next);
    window.history.replaceState(null, "", `/personas/opciones?opcion=${next}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  return (
    <div className={`pc-page pc-option-${option}`}>
      <div className="pc-labbar">
        <div className="pc-lab-intro">
          <span>Exploración de diseño</span>
          <strong>{selected.name}</strong>
          <small>{selected.thesis}</small>
        </div>
        <div className="pc-option-tabs" role="tablist" aria-label="Opciones de rediseño">
          {OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={option === item.id}
              data-testid={`option-${item.id}`}
              className={option === item.id ? "is-active" : ""}
              onClick={() => choose(item.id)}
            >
              <b>0{item.id}</b><span>{item.name}</span>
            </button>
          ))}
        </div>
      </div>

      {option !== 4 && option !== 5 && (
        <div className="pc-filter-shell">
          <FilterBar
            query={query}
            onQuery={setQuery}
            period={period}
            onPeriod={setPeriod}
            periods={periods}
            resultCount={filtered.length}
            useHomeSelector={option === 3}
          />
        </div>
      )}

      {option === 1 && <GalleryConcept entities={filtered} allCount={entities.length} />}
      {option === 2 && <IndexConcept entities={filtered} allCount={entities.length} />}
      {option === 3 && (
        filtered.length > 0
          ? <TimelineConcept entities={filtered} allCount={entities.length} />
          : <EmptyConcept />
      )}
      {option === 4 && <CoverConcept entities={filtered} allCount={entities.length} />}
      {option === 5 && <MosaicConcept entities={filtered} allCount={entities.length} />}
    </div>
  );
}
