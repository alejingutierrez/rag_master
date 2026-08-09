"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import { HISTORICAL_PERIODS, PERIODS, getPeriodColor, type PeriodCode } from "@/lib/design-tokens";
import { imageAt } from "@/lib/image-url";
import type { PublicEntity } from "@/lib/public-data";
import { useUrlFilters } from "@/lib/use-url-state";
import "@/components/public/ideas/ideas-explorer.css";

type IdeasView = "temas" | "epocas" | "az";

const DEFAULT_PERIOD: PeriodCode = "FN";
const VALID_VIEWS = new Set<IdeasView>(["temas", "epocas", "az"]);

const FN_MAIN_PREFERENCES = [
  "Reforma agraria",
  "Doctrina de Seguridad Nacional",
  "Foquismo",
  "Alianza para el Progreso",
  "ANUC",
];

const FN_CROSS_PERIOD_PREFERENCES = ["Bipartidismo", "Centralismo", "Frontera agraria"];

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function initialOf(value: string): string {
  const initial = normalize(value.trim()).charAt(0).toUpperCase();
  return initial >= "A" && initial <= "Z" ? initial : "#";
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </svg>
  );
}

function ArrowIcon({ direction = "right" }: { direction?: "left" | "right" }) {
  return (
    <svg className={direction === "left" ? "is-left" : ""} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15M14 7l5 5-5 5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="1" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </svg>
  );
}

function AlphabetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="m6 16 2.5-8 2.5 8M7 13h3M13 9h5l-5 7h5" />
    </svg>
  );
}

function IdeaImage({
  idea,
  width,
  eager = false,
}: {
  idea: PublicEntity;
  width: 160 | 320 | 480 | 640 | 960;
  eager?: boolean;
}) {
  const src = imageAt(idea.imageUrl, width);
  if (!src) {
    return <span className="ix-image-fallback" aria-hidden>{idea.name.charAt(0)}</span>;
  }
  // El nombre se anuncia en el mismo enlace; la portada funciona como apoyo visual.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden loading={eager ? "eager" : "lazy"} />;
}

function sortByProminence(ideas: PublicEntity[]): PublicEntity[] {
  return [...ideas].sort(
    (a, b) =>
      b.mentions - a.mentions ||
      b.corpusMentions - a.corpusMentions ||
      Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl)) ||
      a.name.localeCompare(b.name, "es"),
  );
}

function selectPreferred(
  ideas: PublicEntity[],
  preferredNames: string[],
  limit: number,
  exclude = new Set<string>(),
): PublicEntity[] {
  const selected: PublicEntity[] = [];
  const byName = new Map(ideas.map((idea) => [normalize(idea.name), idea]));
  for (const name of preferredNames) {
    const idea = byName.get(normalize(name));
    if (idea && !exclude.has(idea.slug) && !selected.some((item) => item.slug === idea.slug)) {
      selected.push(idea);
    }
  }
  for (const idea of sortByProminence(ideas)) {
    if (selected.length >= limit) break;
    if (!exclude.has(idea.slug) && !selected.some((item) => item.slug === idea.slug)) selected.push(idea);
  }
  return selected.slice(0, limit);
}

function FeaturedIdea({ idea }: { idea: PublicEntity }) {
  return (
    <Link href={idea.href} className="ix-featured">
      <span className="ix-featured-image">
        <IdeaImage idea={idea} width={960} eager />
      </span>
      <span className="ix-featured-copy">
        <span className="ix-featured-label"><i />Idea destacada</span>
        <strong>{idea.name}</strong>
        {idea.resumen ? <span>{idea.resumen}</span> : null}
      </span>
    </Link>
  );
}

function MainIdeaRow({ idea }: { idea: PublicEntity }) {
  return (
    <li className="ix-main-row">
      <Link href={idea.href}>
        <span className="ix-main-thumb"><IdeaImage idea={idea} width={320} /></span>
        <span className="ix-main-copy">
          <strong>{idea.name}</strong>
          {idea.resumen ? <span>{idea.resumen}</span> : null}
        </span>
        <span className="ix-row-arrow"><ArrowIcon /></span>
      </Link>
    </li>
  );
}

function PeriodTrail({ idea, selected }: { idea: PublicEntity; selected: PeriodCode }) {
  const periods = HISTORICAL_PERIODS.filter((code) => idea.periods.includes(code));
  return (
    <span className="ix-period-trail" aria-label={`Atraviesa ${periods.length} épocas`}>
      {periods.map((code) => (
        <i
          key={code}
          className={code === selected ? "is-current" : ""}
          style={{ backgroundColor: getPeriodColor(code) }}
          title={`${PERIODS[code].label}, ${PERIODS[code].yearRange}`}
        />
      ))}
    </span>
  );
}

function CrossPeriodRow({ idea, selected }: { idea: PublicEntity; selected: PeriodCode }) {
  return (
    <li className="ix-cross-row">
      <Link href={idea.href}>
        <span className="ix-cross-thumb"><IdeaImage idea={idea} width={320} /></span>
        <span className="ix-cross-copy">
          <strong>{idea.name}</strong>
          {idea.resumen ? <span>{idea.resumen}</span> : null}
          <PeriodTrail idea={idea} selected={selected} />
        </span>
        <span className="ix-row-arrow"><ArrowIcon /></span>
      </Link>
    </li>
  );
}

function Timeline({
  periods,
  selected,
  onSelect,
}: {
  periods: PeriodCode[];
  selected: PeriodCode;
  onSelect: (period: PeriodCode) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const selectedIndex = periods.indexOf(selected);
  const previous = periods[(selectedIndex - 1 + periods.length) % periods.length];
  const next = periods[(selectedIndex + 1) % periods.length];

  useEffect(() => {
    const strip = stripRef.current;
    const active = activeRef.current;
    if (!strip || !active || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({
      left: active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [selected]);

  return (
    <section className="ix-timeline" aria-labelledby="ix-timeline-title">
      <div id="ix-timeline-title" className="ix-timeline-label">Explorar por época</div>
      <div className="ix-timeline-controls">
        <button type="button" className="ix-timeline-arrow" onClick={() => onSelect(previous)} aria-label="Época anterior">
          <ArrowIcon direction="left" />
        </button>
        <div
          className="ix-periods"
          role="group"
          aria-label="Seleccionar época"
          ref={stripRef}
          style={{ "--period-count": periods.length } as React.CSSProperties}
        >
          {periods.map((code) => {
            const period = PERIODS[code];
            const active = code === selected;
            return (
              <button
                key={code}
                type="button"
                ref={active ? activeRef : undefined}
                className={active ? "is-active" : ""}
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(code)}
                style={{ "--period-color": getPeriodColor(code) } as React.CSSProperties}
              >
                <span>{period.label}</span>
                <small>{period.yearRange}</small>
                {active ? <i aria-hidden /> : null}
              </button>
            );
          })}
        </div>
        <button type="button" className="ix-timeline-arrow" onClick={() => onSelect(next)} aria-label="Época siguiente">
          <ArrowIcon />
        </button>
      </div>
    </section>
  );
}

function EmptyResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="ix-empty">
      <strong>No encontramos una idea con esos filtros.</strong>
      <button type="button" onClick={onClear}>Limpiar búsqueda</button>
    </div>
  );
}

function AlphabeticalView({ ideas }: { ideas: PublicEntity[] }) {
  const groups = useMemo(() => {
    const grouped = new Map<string, PublicEntity[]>();
    for (const idea of [...ideas].sort((a, b) => a.name.localeCompare(b.name, "es"))) {
      const initial = initialOf(idea.name);
      grouped.set(initial, [...(grouped.get(initial) ?? []), idea]);
    }
    return [...grouped.entries()];
  }, [ideas]);

  return (
    <section className="ix-alt-view" aria-labelledby="ix-az-title">
      <header className="ix-alt-head">
        <h2 id="ix-az-title">Todas las ideas A–Z</h2>
        <span>{ideas.length} con historia propia</span>
      </header>
      {groups.length === 0 ? null : (
        <div className="ix-alpha-groups">
          {groups.map(([letter, items]) => (
            <section key={letter} className="ix-alpha-group">
              <h3>{letter}</h3>
              <ul>
                {items.map((idea) => (
                  <li key={idea.slug}>
                    <Link href={idea.href}>
                      <span>{idea.name}</span>
                      <ArrowIcon />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function TopicsView({ ideas }: { ideas: PublicEntity[] }) {
  return (
    <section className="ix-alt-view" aria-labelledby="ix-topics-title">
      <header className="ix-alt-head">
        <h2 id="ix-topics-title">Temas con más presencia en el archivo</h2>
        <span>Ordenados por piezas publicadas</span>
      </header>
      <ul className="ix-topic-list">
        {sortByProminence(ideas).map((idea, index) => (
          <li key={idea.slug}>
            <Link href={idea.href}>
              <span className="ix-topic-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="ix-topic-thumb"><IdeaImage idea={idea} width={160} /></span>
              <span className="ix-topic-copy">
                <strong>{idea.name}</strong>
                {idea.resumen ? <span>{idea.resumen}</span> : null}
              </span>
              <span className="ix-topic-meta">{idea.mentions} {idea.mentions === 1 ? "pieza" : "piezas"}</span>
              <span className="ix-row-arrow"><ArrowIcon /></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function IdeasExplorer({ ideas }: { ideas: PublicEntity[] }) {
  const [filters, setFilters] = useUrlFilters({ q: "", vista: "epocas", periodo: DEFAULT_PERIOD }, 100);
  const deferredQuery = useDeferredValue(filters.q);
  const query = normalize(deferredQuery.trim());

  const periods = useMemo(
    () => HISTORICAL_PERIODS.filter((code) => ideas.some((idea) => idea.periods.includes(code))),
    [ideas],
  );
  const fallbackPeriod = periods.includes(DEFAULT_PERIOD) ? DEFAULT_PERIOD : periods[0] ?? DEFAULT_PERIOD;
  const selectedPeriod = periods.includes(filters.periodo as PeriodCode)
    ? (filters.periodo as PeriodCode)
    : fallbackPeriod;
  const selectedView: IdeasView = VALID_VIEWS.has(filters.vista as IdeasView)
    ? (filters.vista as IdeasView)
    : "epocas";

  const filteredIdeas = useMemo(() => {
    if (!query) return ideas;
    return ideas.filter((idea) => normalize(`${idea.name} ${idea.resumen ?? ""}`).includes(query));
  }, [ideas, query]);

  const periodIdeas = useMemo(
    () => filteredIdeas.filter((idea) => idea.periods.includes(selectedPeriod)),
    [filteredIdeas, selectedPeriod],
  );

  const featured = useMemo(() => {
    const exact = periodIdeas.find((idea) => normalize(idea.name) === normalize(PERIODS[selectedPeriod].label));
    return exact ?? sortByProminence(periodIdeas)[0] ?? null;
  }, [periodIdeas, selectedPeriod]);

  const crossPeriodIdeas = useMemo(() => {
    const candidates = periodIdeas.filter(
      (idea) => HISTORICAL_PERIODS.filter((code) => idea.periods.includes(code)).length > 1,
    );
    const excluded = new Set([
      ...(featured ? [featured.slug] : []),
      ...(selectedPeriod === "FN"
        ? periodIdeas
            .filter((idea) => FN_MAIN_PREFERENCES.some((name) => normalize(name) === normalize(idea.name)))
            .map((idea) => idea.slug)
        : []),
    ]);
    return selectPreferred(
      candidates,
      selectedPeriod === "FN" ? FN_CROSS_PERIOD_PREFERENCES : [],
      3,
      excluded,
    );
  }, [periodIdeas, selectedPeriod, featured]);

  const mainIdeas = useMemo(() => {
    const excluded = new Set([
      ...(featured ? [featured.slug] : []),
      ...crossPeriodIdeas.map((idea) => idea.slug),
    ]);
    return selectPreferred(
      periodIdeas,
      selectedPeriod === "FN" ? FN_MAIN_PREFERENCES : [],
      5,
      excluded,
    );
  }, [periodIdeas, selectedPeriod, featured, crossPeriodIdeas]);

  const selectedIndex = periods.indexOf(selectedPeriod);
  const nextPeriod = periods[(selectedIndex + 1) % periods.length] ?? selectedPeriod;
  const setPeriod = (period: PeriodCode) => setFilters({ periodo: period, vista: "epocas" });
  const setView = (view: IdeasView) => setFilters({ vista: view });
  const clearSearch = () => setFilters({ q: "" });

  return (
    <div className="ix-page">
      <header className="ix-heading">
        <div className="ix-heading-copy">
          <h1>Ideas</h1>
          <p>Procesos, ideologías e instituciones con pieza propia en el archivo — y las historias que permiten pensarlas.</p>
        </div>
        <div className="ix-tools">
          <label className="ix-search">
            <SearchIcon />
            <span className="sr-only">Buscar ideas</span>
            <input
              type="search"
              value={filters.q}
              onChange={(event) => setFilters({ q: event.target.value })}
              placeholder={`Buscar entre ${ideas.length} ideas`}
            />
          </label>
          <div className="ix-tabs" role="tablist" aria-label="Organizar ideas">
            <button type="button" role="tab" aria-selected={selectedView === "temas"} className={selectedView === "temas" ? "is-active" : ""} onClick={() => setView("temas")}>Temas</button>
            <button type="button" role="tab" aria-selected={selectedView === "epocas"} className={selectedView === "epocas" ? "is-active" : ""} onClick={() => setView("epocas")}>Épocas</button>
            <button type="button" role="tab" aria-selected={selectedView === "az"} className={selectedView === "az" ? "is-active" : ""} onClick={() => setView("az")}>A–Z</button>
          </div>
          <div className="ix-total">{ideas.length} con historia propia</div>
        </div>
      </header>

      {selectedView === "epocas" ? (
        <>
          <Timeline periods={periods} selected={selectedPeriod} onSelect={setPeriod} />
          {periodIdeas.length === 0 || !featured ? (
            <EmptyResults onClear={clearSearch} />
          ) : (
            <div className="ix-content">
              <section className="ix-main" aria-labelledby="ix-main-title">
                <h2 id="ix-main-title">
                  Ideas presentes en {selectedPeriod === "FN" ? "el Frente Nacional" : PERIODS[selectedPeriod].label}
                </h2>
                <FeaturedIdea idea={featured} />
                {mainIdeas.length > 0 ? (
                  <ul className="ix-main-list">
                    {mainIdeas.map((idea) => <MainIdeaRow key={idea.slug} idea={idea} />)}
                  </ul>
                ) : null}
              </section>

              <aside className="ix-rail" aria-labelledby="ix-rail-title">
                <h2 id="ix-rail-title">También atraviesan otras épocas</h2>
                {crossPeriodIdeas.length > 0 ? (
                  <ul className="ix-cross-list">
                    {crossPeriodIdeas.map((idea) => (
                      <CrossPeriodRow key={idea.slug} idea={idea} selected={selectedPeriod} />
                    ))}
                  </ul>
                ) : (
                  <p className="ix-rail-empty">Estas ideas se concentran en una sola época.</p>
                )}
                <div className="ix-rail-actions">
                  <button type="button" onClick={() => setPeriod(nextPeriod)}>
                    <CalendarIcon />
                    <span><small>Siguiente época</small><strong>{PERIODS[nextPeriod].label}, {PERIODS[nextPeriod].yearRange}</strong></span>
                    <ArrowIcon />
                  </button>
                  <button type="button" onClick={() => setView("az")}>
                    <AlphabetIcon />
                    <span><strong>Ver todas las ideas A–Z</strong></span>
                    <ArrowIcon />
                  </button>
                </div>
              </aside>
            </div>
          )}
        </>
      ) : filteredIdeas.length === 0 ? (
        <EmptyResults onClear={clearSearch} />
      ) : selectedView === "az" ? (
        <AlphabeticalView ideas={filteredIdeas} />
      ) : (
        <TopicsView ideas={filteredIdeas} />
      )}
    </div>
  );
}
