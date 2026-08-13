"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import {
  HISTORICAL_PERIODS,
  PERIODS,
  getPeriodColor,
  type PeriodCode,
} from "@/lib/design-tokens";
import { HomePeriodSelector } from "@/components/public/home/home-period-selector";
import { SectionMasthead } from "@/components/public/section-masthead";
import { imageAt } from "@/lib/image-url";
import type { TypologyCard } from "@/lib/public-data";
import { useUrlFilters } from "@/lib/use-url-state";
import "@/components/public/essays/essays-explorer.css";

const PAGE_SIZE = 13;
const PREFERRED_FEATURES = [
  "las periferias colombianas",
  "la cuestión agraria como sustrato",
  "discontinuidad del campo intelectual",
];

const SHORT_CATEGORY_LABELS: Record<string, string> = {
  CON: "Conflicto y violencia",
  SOC: "Sociedad",
  POL: "Política y Estado",
  CUL: "Cultura e ideas",
  HIS: "Historiografía",
  INS: "Instituciones y justicia",
  TER: "Territorio",
  ECO: "Economía",
  MOV: "Movimientos sociales",
  REL: "Geopolítica",
};

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function cardHaystack(card: TypologyCard): string {
  return normalize(
    [
      card.titulo,
      card.resumen,
      card.porQueImporta,
      card.categoriaNombre ?? "",
      card.clusterTematico ?? "",
      ...card.entidades.personas,
      ...card.entidades.lugares,
      ...card.entidades.ideas,
    ].join(" "),
  );
}

function editorialRank(a: TypologyCard, b: TypologyCard): number {
  return (
    Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl)) ||
    (b.docCount ?? 0) - (a.docCount ?? 0) ||
    (b.wordCount ?? 0) - (a.wordCount ?? 0) ||
    a.titulo.localeCompare(b.titulo, "es")
  );
}

function selectEditorial(cards: TypologyCard[], usePreferred: boolean): TypologyCard[] {
  const selected: TypologyCard[] = [];
  if (usePreferred) {
    for (const fragment of PREFERRED_FEATURES) {
      const found = cards.find((card) => normalize(card.titulo).includes(normalize(fragment)));
      if (found && !selected.some((card) => card.id === found.id)) selected.push(found);
    }
  }
  for (const card of [...cards].sort(editorialRank)) {
    if (selected.length >= 3) break;
    if (!selected.some((item) => item.id === card.id)) selected.push(card);
  }
  return selected.slice(0, 3);
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15M14 7l5 5-5 5" />
    </svg>
  );
}

function EssayImage({
  card,
  width,
  eager = false,
}: {
  card: TypologyCard;
  width: 160 | 320 | 480 | 640 | 960 | 1400;
  eager?: boolean;
}) {
  const src = imageAt(card.imageUrl, width);
  if (!src) return <span className="ex-image-fallback" aria-hidden>{card.titulo.charAt(0)}</span>;
  return (
    // La imagen acompaña al título dentro del mismo enlace.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" aria-hidden loading={eager ? "eager" : "lazy"} />
  );
}

function EssayMeta({ card }: { card: TypologyCard }) {
  const period = card.periodCode ? PERIODS[card.periodCode as PeriodCode] : null;
  return (
    <span className="ex-meta">
      {card.periodCode ? (
        <i style={{ backgroundColor: getPeriodColor(card.periodCode) }} aria-hidden />
      ) : null}
      <span>{SHORT_CATEGORY_LABELS[card.categoriaCode ?? ""] ?? card.categoriaNombre ?? "Lectura"}</span>
      {period ? <span>{period.label}</span> : null}
    </span>
  );
}

function EditorialCover({ cards, caption }: { cards: TypologyCard[]; caption: string }) {
  const [lead, ...secondary] = cards;
  if (!lead) return null;

  return (
    <section className="ex-cover" aria-labelledby="ex-cover-title">
      <div className="ex-cover-head">
        <span id="ex-cover-title">Selección editorial</span>
        <span>{caption}</span>
      </div>
      <div className="ex-cover-grid">
        <Link href={lead.href} className="ex-lead-image">
          <EssayImage card={lead} width={960} eager />
        </Link>
        <Link href={lead.href} className="ex-lead-copy">
          <EssayMeta card={lead} />
          <strong>{lead.titulo}</strong>
          {lead.resumen ? <span className="ex-lead-summary">{lead.resumen}</span> : null}
          <span className="ex-lead-foot">
            <span>{lead.docCount ? `${lead.docCount} documentos` : "Lectura documentada"}{lead.wordCount ? ` · ${lead.wordCount.toLocaleString("es-CO")} palabras` : ""}</span>
            <ArrowIcon />
          </span>
        </Link>
        {secondary.length ? (
          <div className="ex-secondary">
            {secondary.map((card) => (
              <Link href={card.href} key={card.id}>
                <span className="ex-secondary-image"><EssayImage card={card} width={480} /></span>
                <span className="ex-secondary-copy">
                  <EssayMeta card={card} />
                  <strong>{card.titulo}</strong>
                  <small>{card.docCount ? `${card.docCount} documentos` : card.meta ?? "Lectura"}</small>
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ArchiveResults({ cards, total }: { cards: TypologyCard[]; total: number }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = cards.slice(0, visible);
  const remaining = cards.length - shown.length;

  return (
    <>
      <ol className="ex-results">
        {shown.map((card, index) => (
          <li key={card.id} className={index === 0 ? "is-featured" : undefined}>
            <Link href={card.href}>
              <span className="ex-result-image">
                <EssayImage card={card} width={index === 0 ? 640 : 320} />
              </span>
              <span className="ex-result-copy">
                <span className="ex-result-number">{String(index + 1).padStart(2, "0")}</span>
                <EssayMeta card={card} />
                <strong>{card.titulo}</strong>
                {card.resumen ? <span className="ex-result-summary">{card.resumen}</span> : null}
                <span className="ex-result-foot">
                  {card.docCount ? `${card.docCount} documentos` : card.meta ?? "Lectura"}
                  <ArrowIcon />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {remaining > 0 ? (
        <div className="ex-more">
          <button type="button" onClick={() => setVisible((current) => current + PAGE_SIZE)}>
            Mostrar {Math.min(PAGE_SIZE, remaining)} más
          </button>
          <span>{shown.length} de {cards.length} resultados · {total} lecturas en el archivo</span>
        </div>
      ) : null}
    </>
  );
}

export function EssaysExplorer({ cards }: { cards: TypologyCard[] }) {
  const [filters, setFilters, resetFilters] = useUrlFilters({ periodo: "", tema: "", q: "" }, 120);
  const deferredQuery = useDeferredValue(filters.q.trim());
  const query = normalize(deferredQuery);

  const presentPeriods = useMemo(
    () => new Set(cards.map((card) => card.periodCode).filter((code): code is string => Boolean(code))),
    [cards],
  );
  const selectedPeriod = presentPeriods.has(filters.periodo) ? filters.periodo as PeriodCode : null;

  const categoryOptions = useMemo(() => {
    const options = new Map<string, { code: string; label: string; total: number }>();
    for (const card of cards) {
      if (!card.categoriaCode) continue;
      const current = options.get(card.categoriaCode);
      if (current) current.total += 1;
      else options.set(card.categoriaCode, {
        code: card.categoriaCode,
        label: SHORT_CATEGORY_LABELS[card.categoriaCode] ?? card.categoriaNombre ?? card.categoriaCode,
        total: 1,
      });
    }
    return [...options.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));
  }, [cards]);
  const validThemes = useMemo(() => new Set(categoryOptions.map((option) => option.code)), [categoryOptions]);
  const selectedTheme = validThemes.has(filters.tema) ? filters.tema : "";

  const periodAndQueryCards = useMemo(
    () => cards.filter((card) => {
      if (selectedPeriod && card.periodCode !== selectedPeriod) return false;
      if (query && !cardHaystack(card).includes(query)) return false;
      return true;
    }),
    [cards, query, selectedPeriod],
  );
  const themeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const card of periodAndQueryCards) {
      if (card.categoriaCode) counts.set(card.categoriaCode, (counts.get(card.categoriaCode) ?? 0) + 1);
    }
    return counts;
  }, [periodAndQueryCards]);
  const filteredCards = useMemo(
    () => selectedTheme
      ? periodAndQueryCards.filter((card) => card.categoriaCode === selectedTheme)
      : periodAndQueryCards,
    [periodAndQueryCards, selectedTheme],
  );
  const featureCards = useMemo(
    () => selectEditorial(filteredCards, !selectedPeriod && !selectedTheme && !query),
    [filteredCards, query, selectedPeriod, selectedTheme],
  );

  const activeTheme = categoryOptions.find((option) => option.code === selectedTheme);
  const selectionTitle = activeTheme && selectedPeriod
    ? `${activeTheme.label} durante ${PERIODS[selectedPeriod].label}`
    : activeTheme?.label ?? (selectedPeriod ? `Lecturas de ${PERIODS[selectedPeriod].label}` : query ? "Resultados de búsqueda" : "Todas las lecturas");
  const coverCaption = selectedPeriod
    ? `${PERIODS[selectedPeriod].label} · ${PERIODS[selectedPeriod].yearRange}`
    : activeTheme?.label ?? "Lecturas para empezar";
  const resultKey = `${selectedPeriod ?? "all"}:${selectedTheme || "all"}:${query}`;

  return (
    <div className="ex-wrap">
      <SectionMasthead
        eyebrow="03 · Lecturas de fondo"
        title="Ensayos"
        summary="Preguntas y ensayos que conectan procesos, fuentes y debates para leer el pasado colombiano con más profundidad."
        meta={`${cards.length} lecturas publicadas`}
        actions={
          <label className="ex-search">
            <SearchIcon />
            <span className="sr-only">Buscar una lectura</span>
            <input
              type="search"
              value={filters.q}
              onChange={(event) => setFilters({ q: event.target.value })}
              placeholder="Buscar una lectura…"
            />
          </label>
        }
      >
        <HomePeriodSelector
          selectedPeriod={selectedPeriod}
          destination="ensayos"
          onSelect={(periodo) => setFilters({ periodo: periodo ?? "" })}
          availablePeriods={HISTORICAL_PERIODS.filter((code) => presentPeriods.has(code))}
        />
      </SectionMasthead>

      {cards.length === 0 ? (
        <div className="ex-empty">Aún no hay lecturas publicadas. Aparecerán aquí a medida que se publiquen desde el taller.</div>
      ) : (
        <>
          <EditorialCover cards={featureCards} caption={coverCaption} />

          <section className="ex-explore" aria-labelledby="ex-explore-title">
            <div className="ex-explore-head">
              <div>
                <h2 id="ex-explore-title">Explorar las {cards.length} lecturas</h2>
                <p>Época y tema se pueden combinar.</p>
              </div>
              {(selectedPeriod || selectedTheme || query) ? (
                <button type="button" className="ex-reset" onClick={resetFilters}>Limpiar filtros</button>
              ) : null}
            </div>
            <div className="ex-themes">
              <span className="ex-section-label">Tema</span>
              <div className="ex-theme-scroll">
                <div className="ex-theme-list" role="group" aria-label="Filtrar lecturas por tema">
                  <button
                    type="button"
                    className={!selectedTheme ? "is-active" : undefined}
                    onClick={() => setFilters({ tema: "" })}
                    aria-pressed={!selectedTheme}
                  >
                    Todos los temas <small>{periodAndQueryCards.length}</small>
                  </button>
                  {categoryOptions.map((option) => {
                    const count = themeCounts.get(option.code) ?? 0;
                    const active = selectedTheme === option.code;
                    return (
                      <button
                        type="button"
                        key={option.code}
                        className={active ? "is-active" : undefined}
                        disabled={count === 0}
                        onClick={() => setFilters({ tema: active ? "" : option.code })}
                        aria-pressed={active}
                      >
                        {option.label} <small>{count}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="ex-archive" aria-labelledby="ex-archive-title">
            <div className="ex-archive-head">
              <h2 id="ex-archive-title">{selectionTitle}</h2>
              <span>{filteredCards.length} {filteredCards.length === 1 ? "resultado" : "resultados"}</span>
            </div>
            {filteredCards.length ? (
              <ArchiveResults key={resultKey} cards={filteredCards} total={cards.length} />
            ) : (
              <div className="ex-empty">
                Nada coincide con esta combinación. <button type="button" onClick={resetFilters}>Ver todas las lecturas</button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
