"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import { PeriodRibbon } from "@/components/public/period-ribbon";
import type { TimelineFile } from "@/lib/timeline-data";
import type { TimelineLinks } from "@/lib/public-data";
import { TimelineDensityStrip } from "./TimelineDensityStrip";
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
          Una línea de tiempo calibrada por atención: los momentos que el corpus más interroga
          pesan más. Elija un período; cada evento abre su detalle y, cuando el hecho ya está
          escrito, un avance de la ficha completa.
        </p>
      </header>

      {/* Selector de períodos — cinta cronológica compartida (modo navegación). */}
      <div className="ptl-wrap ptl-ribbon">
        <PeriodRibbon
          order={ORDER}
          selected={selected}
          onSelect={(c) => c && selectPeriod(c as PeriodCode)}
          label="Períodos canónicos · seleccione uno"
          mode="nav"
        />
      </div>

      <section className="ptl-wrap" style={pcStyle}>
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
              <Metric label="Eventos" value={total} />
              <Metric label="Piezas publicadas" value={periodLinks?.counts.total ?? 0} />
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
                periodoCode={selected}
                selectedEventId={selectedEvent?.id ?? null}
                onSelectEvent={setSelectedEvent}
              />
              <div className="ptl-strip-cap">
                Barras: preguntas ancladas por año · Círculos: eventos, dimensionados por peso en el corpus
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
              {slice.events.map((e) => {
                const hecho = hechoPorEvento.get(e.id) ?? null;
                const rango = e.anioFin !== e.anioInicio;
                return (
                  <li key={e.id} className="ptl-item">
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(e)}
                      title="Ver el detalle del evento"
                      data-active={selectedEvent?.id === e.id ? "true" : "false"}
                      className={hecho?.imageUrl ? "ptl-btn has-media" : "ptl-btn"}
                    >
                      <span className="ptl-year" data-span={rango ? "true" : "false"}>
                        {fmtYearSpan(e.anioInicio, e.anioFin)}
                      </span>

                      <span>
                        <span className="ptl-t">{e.titulo}</span>
                        <span className="ptl-s">{e.resumen}</span>
                        <span className="ptl-meta">
                          <span className="ptl-bar">
                            <i style={{ width: `${e.evidencia.peso}%` }} />
                          </span>
                          <span className="ptl-c">
                            {e.curated
                              ? `${n(e.evidencia.nPreguntas)} menciones · curado`
                              : `${n(e.evidencia.nPreguntas)} preguntas · ${n(e.evidencia.nLibros)} obras`}
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
