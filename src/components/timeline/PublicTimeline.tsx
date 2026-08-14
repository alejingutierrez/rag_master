"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import { HomePeriodSelector } from "@/components/public/home/home-period-selector";
import type { TimelineFile } from "@/lib/timeline-data";
import type { TimelineLinks } from "@/lib/public-data";
import { TimelineDensityStrip } from "./TimelineDensityStrip";
import { TimelineArchivePulse } from "./TimelineArchivePulse";
import { PublicTimelineEventDrawer, matchHechos } from "./PublicTimelineEventDrawer";
import { fmtYearSpan, type TimelineEventData } from "./TimelineEventDrawer";
import "./public-timeline.css";
import { imageAt } from "@/lib/image-url";

// Orden y rango cronológico de los períodos con eventos minados (sin TRANS).
const ORDER: PeriodCode[] = [
  "PRE", "CON", "COL", "PRE_IND", "IND", "NGR", "EUC", "REG",
  "REP_LIB", "VIO", "FN", "CNA", "C91", "SDE", "POS",
];

const n = (v: number) => v.toLocaleString("es-CO");

/**
 * Línea de tiempo pública. UNA sola columna cronológica: antes convivían el
 * listado de piezas del período (sidebar) y el de eventos, que para el lector
 * eran la misma lista dos veces. Ahora el período es cabecera y los eventos son
 * la columna; el evento que ya tiene ficha publicada lo anuncia en su fila y
 * despliega el avance en el drawer.
 */
export function PublicTimeline({
  timeline,
  links,
  initialPeriod = "REG",
  entityHrefs,
}: {
  timeline: TimelineFile;
  links: TimelineLinks;
  initialPeriod?: PeriodCode;
  /** nombre de entidad → href de su página (solo publicadas) para enlazar chips. */
  entityHrefs?: Record<string, string>;
}) {
  const [selected, setSelected] = useState<PeriodCode>(
    ORDER.includes(initialPeriod) ? initialPeriod : "REG",
  );
  const [selectedEvent, setSelectedEvent] = useState<TimelineEventData | null>(null);

  const period = PERIODS[selected];
  const slice = timeline.periods[selected] ?? { yearHistogram: [], events: [] };
  const periodLinks = links[selected];
  const pcStyle = { "--pc": `var(--p-${period.slug})` } as CSSProperties;

  const selectPeriod = (code: PeriodCode) => {
    setSelected(code);
    setSelectedEvent(null);
    const params = new URLSearchParams(window.location.search);
    params.set("p", code);
    window.history.replaceState(null, "", `/linea-de-tiempo?${params.toString()}`);
  };

  // Un solo casamiento evento↔ficha para toda la página: la fila y el drawer
  // siempre hablan del mismo hecho publicado.
  const hechoPorEvento = useMemo(
    () => matchHechos(slice.events, periodLinks?.hechos ?? []),
    [slice.events, periodLinks],
  );
  const conFicha = hechoPorEvento.size;
  const total = slice.events.length;

  return (
    <div className="fade-up">
      <header className="ptl-wrap ptl-hero">
        <div className="ptl-hero-k">Exploración temporal</div>
        <h1 className="ptl-hero-t">
          Quinientos años, <em>quince períodos.</em>
        </h1>
        <p className="ptl-hero-s">
          Una cronología que hace visible cuánto archivo existe detrás de cada época. La densidad
          responde a hechos publicados; los eventos y las preguntas muestran cómo se conectan.
        </p>
      </header>

      <div className="ptl-wrap">
        <TimelineArchivePulse
          order={ORDER}
          timeline={timeline}
          links={links}
          selected={selected}
          onSelect={selectPeriod}
        />
      </div>

      {/* El mismo deck de épocas que usan las demás superficies públicas. */}
      <div className="ptl-wrap ptl-selector">
        <div className="ptl-selector-head">
          <span>Explorar otra época</span>
          <small>La selección actual permanece ampliada; pase el cursor para previsualizar las demás.</small>
        </div>
        <HomePeriodSelector
          selectedPeriod={selected}
          destination="linea-de-tiempo"
          onSelect={(code) => code && selectPeriod(code)}
          availablePeriods={ORDER}
        />
      </div>

      <section className="ptl-wrap" style={pcStyle}>
        <div key={selected} className="ptl-period-stage">
          {/* Cabecera del período: identidad, cifras y la puerta a la época. */}
          <header className="ptl-period">
          <div>
            <div className="ptl-period-n">
              Período {String(ORDER.indexOf(selected) + 1).padStart(2, "0")} / {ORDER.length}
            </div>
            <h2 className="ptl-period-t">{period.label}</h2>
            <div className="ptl-period-y">{period.yearRange}</div>
          </div>

          <div className="ptl-period-side">
            <div className="ptl-metrics">
              <Metric label="Hechos publicados" value={periodLinks?.counts.hechos ?? 0} />
              <Metric label="Eventos" value={total} />
              <Metric label="Piezas" value={periodLinks?.counts.total ?? 0} />
            </div>
            {periodLinks?.epoca && (
              <Link href={periodLinks.epoca.href} className="ptl-epoca">
                <span className="k">Leer la época →</span>
                <span className="t">{periodLinks.epoca.resumen || periodLinks.epoca.titulo}</span>
              </Link>
            )}
          </div>
          </header>

          {total > 0 ? (
          <>
            <div className="ptl-strip">
              <TimelineDensityStrip
                histogram={slice.yearHistogram}
                events={slice.events}
                facts={periodLinks?.hechos ?? []}
                periodoCode={selected}
                selectedEventId={selectedEvent?.id ?? null}
                onSelectEvent={setSelectedEvent}
              />
              <div className="ptl-strip-cap">
                Barras: preguntas por año · Círculos: eventos editoriales · Rombos: hechos publicados
              </div>
            </div>

            <div className="ptl-lhead">
              <div className="ptl-lhead-t">Cronología del período</div>
              <div className="ptl-lhead-n">
                {n(total)} {total === 1 ? "evento" : "eventos"}
                {conFicha > 0 && ` · ${n(conFicha)} con ficha publicada`}
              </div>
            </div>

            <ol className="ptl-list">
              {slice.events.map((e, index) => {
                const hecho = hechoPorEvento.get(e.id) ?? null;
                const rango = e.anioFin !== e.anioInicio;
                const eventWeight = Math.max(0.2, e.evidencia.peso / 100);
                return (
                  <li
                    key={e.id}
                    className="ptl-item"
                    style={
                      {
                        "--event-delay": `${Math.min(index * 24, 240)}ms`,
                        "--event-size": `${7 + eventWeight * 8}px`,
                      } as CSSProperties
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(e)}
                      title="Ver el detalle del evento"
                      data-active={selectedEvent?.id === e.id ? "true" : "false"}
                      className={hecho?.imageUrl ? "ptl-btn has-media" : "ptl-btn"}
                    >
                      <span className="ptl-event-node" aria-hidden="true"><i /></span>
                      <span className="ptl-year" data-span={rango ? "true" : "false"}>
                        {fmtYearSpan(e.anioInicio, e.anioFin)}
                      </span>

                      <span className="ptl-event-copy">
                        <span className="ptl-t">{e.titulo}</span>
                        <span className="ptl-s">{e.resumen}</span>
                        <span className="ptl-meta">
                          <span className="ptl-bar">
                            <i style={{ width: `${e.evidencia.peso}%` }} />
                          </span>
                          <span className="ptl-c">
                            {e.curated
                              ? `${n(e.evidencia.nPreguntas)} ${e.evidencia.nPreguntas === 1 ? "mención" : "menciones"} · curado`
                              : `${n(e.evidencia.nPreguntas)} ${e.evidencia.nPreguntas === 1 ? "pregunta" : "preguntas"} · ${n(e.evidencia.nLibros)} ${e.evidencia.nLibros === 1 ? "obra" : "obras"}`}
                          </span>
                          {hecho && <span className="ptl-tag">Ficha publicada</span>}
                        </span>
                      </span>

                      {hecho?.imageUrl && (
                        <span className="ptl-media">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imageAt(hecho.imageUrl, 160)!} alt={hecho.titulo} loading="lazy" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
          ) : (
          <p className="ptl-empty">Aún no hay eventos para este período.</p>
          )}
        </div>
      </section>

      <PublicTimelineEventDrawer
        event={selectedEvent}
        periodoCode={selected}
        links={periodLinks}
        hecho={selectedEvent ? hechoPorEvento.get(selectedEvent.id) ?? null : null}
        entityHrefs={entityHrefs}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="ptl-metric-l">{label}</div>
      <div className="ptl-metric-v">{n(value)}</div>
    </div>
  );
}
