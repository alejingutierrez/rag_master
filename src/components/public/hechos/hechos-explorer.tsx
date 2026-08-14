"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { EditorialArrow, EditorialImage } from "@/components/public/home/primitives";
import { HomePeriodSelector } from "@/components/public/home/home-period-selector";
import { SectionMasthead } from "@/components/public/section-masthead";
import {
  getPeriodColor,
  HISTORICAL_PERIODS,
  PERIODS,
  type PeriodCode,
} from "@/lib/design-tokens";
import type { TypologyCard } from "@/lib/public-data";
import { useUrlState } from "@/lib/use-url-state";

type ExploreMode = "orden" | "temas" | "lugares" | "personas";

interface Facet {
  name: string;
  count: number;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function searchText(fact: TypologyCard): string {
  return normalize(
    [
      fact.titulo,
      fact.resumen,
      fact.porQueImporta,
      fact.meta ?? "",
      fact.categoriaNombre ?? "",
      fact.clusterTematico ?? "",
      ...fact.entidades.personas,
      ...fact.entidades.lugares,
      ...fact.entidades.ideas,
    ].join(" "),
  );
}

function countNames(lists: string[][]): Facet[] {
  const counts = new Map<string, number>();
  for (const list of lists) {
    const seen = new Set<string>();
    for (const raw of list) {
      const name = raw.trim();
      const key = normalize(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
}

function countUnique(lists: string[][]): number {
  const names = new Set<string>();
  for (const list of lists) for (const item of list) names.add(normalize(item));
  names.delete("");
  return names.size;
}

function leadScore(fact: TypologyCard): number {
  return (
    (fact.docCount ?? 0) * 6 +
    fact.fragmentCount * 2 +
    Math.min(fact.wordCount ?? 0, 8000) / 250 +
    fact.entidades.personas.length * 4 +
    fact.entidades.lugares.length * 2
  );
}

function pickLead(facts: TypologyCard[]): TypologyCard | null {
  let best: TypologyCard | null = null;
  let score = -1;
  for (const fact of facts) {
    const candidate = leadScore(fact);
    if (candidate > score) {
      score = candidate;
      best = fact;
    }
  }
  return best;
}

function factMatchesFacet(fact: TypologyCard, mode: ExploreMode, facet: string): boolean {
  const key = normalize(facet);
  if (mode === "temas") {
    return [fact.categoriaNombre, fact.clusterTematico]
      .filter((value): value is string => !!value)
      .some((value) => normalize(value) === key);
  }
  const values = mode === "lugares" ? fact.entidades.lugares : fact.entidades.personas;
  return values.some((value) => normalize(value) === key);
}

function FactImage({ fact, eager = false }: { fact: TypologyCard; eager?: boolean }) {
  return (
    <EditorialImage
      src={fact.imageUrl}
      alt=""
      className="hx-fact-image"
      eager={eager}
      width={eager ? 1400 : 640}
      sizes={eager ? "(max-width: 760px) 100vw, 66vw" : "(max-width: 760px) 100vw, 33vw"}
    />
  );
}

function LeadFact({ fact }: { fact: TypologyCard }) {
  return (
    <article className="hx-lead-fact">
      <Link href={fact.href} className="hx-lead-image-link">
        <FactImage fact={fact} eager />
      </Link>
      <div className="hx-lead-copy">
        <div className="hx-fact-meta">
          <span style={{ background: getPeriodColor(fact.periodCode ?? "TRANS") }} />
          {fact.meta ?? "Fecha por precisar"}
        </div>
        <h2><Link href={fact.href}>{fact.titulo}</Link></h2>
        <p>{fact.resumen}</p>
        {fact.porQueImporta ? <blockquote>{fact.porQueImporta}</blockquote> : null}
        <Link href={fact.href} className="hx-read-link">Entrar al hecho <EditorialArrow /></Link>
      </div>
    </article>
  );
}

function FactCard({ fact, compact = false }: { fact: TypologyCard; compact?: boolean }) {
  return (
    <article className={`hx-fact-card${compact ? " is-compact" : ""}`}>
      <Link href={fact.href} className="hx-card-image-link"><FactImage fact={fact} /></Link>
      <div>
        <div className="hx-fact-meta">
          <span style={{ background: getPeriodColor(fact.periodCode ?? "TRANS") }} />
          {fact.meta ?? PERIODS[fact.periodCode as PeriodCode]?.yearRange ?? ""}
        </div>
        <h3><Link href={fact.href}>{fact.titulo}</Link></h3>
        <p>{fact.resumen}</p>
      </div>
    </article>
  );
}

function FactTimeline({ facts, title }: { facts: TypologyCard[]; title: string }) {
  if (!facts.length) return null;
  return (
    <section className="hx-timeline" aria-labelledby="hx-timeline-title">
      <header>
        <p>Secuencia visual</p>
        <h2 id="hx-timeline-title">{title}</h2>
      </header>
      <ol>
        {facts.map((fact) => (
          <li key={fact.id}>
            <Link href={fact.href}>
              <span className="hx-timeline-year">{fact.meta ?? fact.anio ?? "—"}</span>
              <EditorialImage src={fact.imageUrl} alt="" width={320} sizes="150px" />
              <strong>{fact.titulo}</strong>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HechosExplorer({
  facts,
  periods,
}: {
  facts: TypologyCard[];
  periods: TypologyCard[];
}) {
  const [periodParam, setPeriodParam] = useUrlState<string | null>({
    key: "periodo",
    default: null,
    debounceMs: 0,
  });
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [mode, setMode] = useState<ExploreMode>("orden");
  const [facet, setFacet] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const present = useMemo(() => new Set(facts.map((fact) => fact.periodCode).filter(Boolean) as string[]), [facts]);
  const selectedPeriod = periodParam && present.has(periodParam) ? periodParam : null;
  const period = selectedPeriod ? PERIODS[selectedPeriod as PeriodCode] : null;
  const periodByCode = useMemo(() => new Map(periods.map((item) => [item.periodCode, item])), [periods]);

  const scopedFacts = useMemo(
    () => selectedPeriod ? facts.filter((fact) => fact.periodCode === selectedPeriod) : facts,
    [facts, selectedPeriod],
  );
  const normalizedQuery = normalize(deferredQuery.trim());
  const searchedFacts = useMemo(
    () => normalizedQuery ? scopedFacts.filter((fact) => searchText(fact).includes(normalizedQuery)) : scopedFacts,
    [normalizedQuery, scopedFacts],
  );

  const facets = useMemo(() => {
    if (mode === "temas") {
      return countNames(searchedFacts.map((fact) =>
        [fact.categoriaNombre, fact.clusterTematico].filter((value): value is string => !!value),
      )).slice(0, 12);
    }
    if (mode === "lugares") return countNames(searchedFacts.map((fact) => fact.entidades.lugares)).slice(0, 12);
    if (mode === "personas") return countNames(searchedFacts.map((fact) => fact.entidades.personas)).slice(0, 12);
    return [];
  }, [mode, searchedFacts]);

  const filteredFacts = useMemo(
    () => facet && mode !== "orden"
      ? searchedFacts.filter((fact) => factMatchesFacet(fact, mode, facet))
      : searchedFacts,
    [facet, mode, searchedFacts],
  );
  const lead = useMemo(() => pickLead(filteredFacts), [filteredFacts]);
  const rest = useMemo(() => filteredFacts.filter((fact) => fact.id !== lead?.id), [filteredFacts, lead]);
  const initialLimit = selectedPeriod ? 8 : 11;
  const visibleRest = showAll ? rest : rest.slice(0, initialLimit);

  const peopleCount = countUnique(scopedFacts.map((fact) => fact.entidades.personas));
  const placesCount = countUnique(scopedFacts.map((fact) => fact.entidades.lugares));
  const ideasCount = countUnique(scopedFacts.map((fact) => fact.entidades.ideas));
  const periodOverview = selectedPeriod ? periodByCode.get(selectedPeriod) : null;
  const timelineFacts = selectedPeriod
    ? scopedFacts
    : HISTORICAL_PERIODS.flatMap((code) => {
        const representative = pickLead(facts.filter((fact) => fact.periodCode === code));
        return representative ? [representative] : [];
      });

  const selectPeriod = (next: string | null) => {
    setPeriodParam(next);
    setFacet(null);
    setShowAll(false);
  };
  const selectMode = (next: ExploreMode) => {
    setMode(next);
    setFacet(null);
    setShowAll(false);
  };

  return (
    <div className="hx-wrap">
      <SectionMasthead
        eyebrow="01 · Acontecimientos"
        title="Hechos"
        summary="Los acontecimientos que marcaron a Colombia, situados en su época y conectados con sus protagonistas y documentos."
        meta={`${facts.length} hechos publicados`}
        actions={
          <label className="hx-search">
            <span className="sr-only">Buscar hechos</span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShowAll(false);
              }}
              placeholder="Un hecho, una persona, un lugar…"
            />
          </label>
        }
      >
        <HomePeriodSelector
          selectedPeriod={selectedPeriod as PeriodCode | null}
          destination="hechos"
          onSelect={selectPeriod}
          availablePeriods={HISTORICAL_PERIODS.filter((code) => present.has(code))}
        />
      </SectionMasthead>

      <section className="hx-periods" aria-label="Estado de la selección">
        <div
          className="hx-status"
          aria-live="polite"
          data-mobile-label={period ? "Contenido de la época" : "Contenido del archivo"}
        >
          <strong>{period ? `Explorando ${period.label}` : "Archivo completo de hechos"}</strong>
          <dl>
            <div><dt>{scopedFacts.length}</dt><dd>hechos</dd></div>
            <div><dt>{peopleCount}</dt><dd>personas</dd></div>
            <div><dt>{placesCount}</dt><dd>lugares</dd></div>
            <div><dt>{ideasCount}</dt><dd>ideas</dd></div>
          </dl>
        </div>
      </section>

      {period ? (
        <section className="hx-period-opener">
          <div>
            <p>Panorama de época</p>
            <h2>{periodOverview?.titulo ?? period.label}</h2>
            <div>{periodOverview?.resumen || `Los hechos publicados entre ${period.yearRange}, organizados para leer sus conexiones y su secuencia.`}</div>
            {periodOverview?.href ? <Link href={periodOverview.href}>Entrar a la época <EditorialArrow /></Link> : null}
          </div>
          <EditorialImage
            src={periodOverview?.imageUrl ?? null}
            alt=""
            width={960}
            sizes="(max-width: 760px) 100vw, 50vw"
          />
        </section>
      ) : null}

      <FactTimeline facts={timelineFacts} title={period ? `Cronología de ${period.label}` : "Una puerta de entrada por cada época"} />

      <section className="hx-explorer" aria-labelledby="hx-explorer-title">
        <header className="hx-explorer-head">
          <div>
            <p>Explorar el archivo</p>
            <h2 id="hx-explorer-title">{period ? `Hechos de ${period.label}` : "Hechos a través del tiempo"}</h2>
          </div>
          <div className="hx-modes" aria-label="Formas de explorar">
            {(["orden", "temas", "lugares", "personas"] as ExploreMode[]).map((item) => (
              <button key={item} type="button" className={mode === item ? "is-active" : ""} onClick={() => selectMode(item)}>
                {item === "orden" ? "Orden" : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </header>

        {facets.length ? (
          <div className="hx-facets" aria-label={`Filtrar por ${mode}`}>
            {facets.map((item) => (
              <button
                key={item.name}
                type="button"
                className={facet === item.name ? "is-active" : ""}
                onClick={() => {
                  setFacet(facet === item.name ? null : item.name);
                  setShowAll(false);
                }}
              >
                {item.name} <small>{item.count}</small>
              </button>
            ))}
          </div>
        ) : null}

        <div className="hx-results-meta">
          <span>{filteredFacts.length} {filteredFacts.length === 1 ? "hecho" : "hechos"}</span>
          {normalizedQuery || facet ? (
            <button type="button" onClick={() => { setQuery(""); setFacet(null); setShowAll(false); }}>Limpiar búsqueda</button>
          ) : null}
        </div>

        {!lead ? (
          <div className="hx-empty">No hay hechos que coincidan con esta exploración.</div>
        ) : (
          <>
            <LeadFact fact={lead} />
            {visibleRest.length ? (
              <div className="hx-card-grid">
                {visibleRest.map((fact, index) => <FactCard key={fact.id} fact={fact} compact={index >= 4} />)}
              </div>
            ) : null}
            {!showAll && rest.length > visibleRest.length ? (
              <button type="button" className="hx-reveal" onClick={() => setShowAll(true)}>
                Ver los {rest.length - visibleRest.length} hechos restantes <EditorialArrow />
              </button>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
