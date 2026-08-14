"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { PERIODS, getPeriodColor, type PeriodCode } from "@/lib/design-tokens";
import type { TimelineFile } from "@/lib/timeline-data";
import type { TimelineLinks } from "@/lib/public-data";

interface PeriodVolume {
  code: PeriodCode;
  facts: number;
  events: number;
  questions: number;
}

const number = (value: number) => value.toLocaleString("es-CO");

/**
 * Vista general del ritmo del archivo. A diferencia del selector, esta pieza no
 * distribuye las épocas por igual: la altura de cada pulso nace del número real
 * de hechos publicados en esa época. Los otros dos conteos explican la capa
 * editorial (eventos) y la atención del corpus (preguntas ancladas por año).
 */
export function TimelineArchivePulse({
  order,
  timeline,
  links,
  selected,
  onSelect,
}: {
  order: PeriodCode[];
  timeline: TimelineFile;
  links: TimelineLinks;
  selected: PeriodCode;
  onSelect: (code: PeriodCode) => void;
}) {
  const [preview, setPreview] = useState<PeriodCode | null>(null);
  const volumes = useMemo<PeriodVolume[]>(
    () =>
      order.map((code) => {
        const slice = timeline.periods[code];
        return {
          code,
          facts: links[code]?.counts.hechos ?? 0,
          events: slice?.events.length ?? 0,
          questions: slice?.yearHistogram.reduce((sum, year) => sum + year.n, 0) ?? 0,
        };
      }),
    [links, order, timeline.periods],
  );

  const maxFacts = Math.max(1, ...volumes.map((volume) => volume.facts));
  const totals = volumes.reduce(
    (sum, volume) => ({
      facts: sum.facts + volume.facts,
      events: sum.events + volume.events,
      questions: sum.questions + volume.questions,
    }),
    { facts: 0, events: 0, questions: 0 },
  );
  const currentCode = preview ?? selected;
  const current = volumes.find((volume) => volume.code === currentCode) ?? volumes[0];

  return (
    <section className="ptl-pulse" aria-labelledby="ptl-pulse-title">
      <header className="ptl-pulse-head">
        <div>
          <span>Ritmo del archivo</span>
          <h2 id="ptl-pulse-title">La historia no ocupa el mismo espacio.</h2>
        </div>
        <dl>
          <div><dt>{number(totals.facts)}</dt><dd>hechos publicados</dd></div>
          <div><dt>{number(totals.events)}</dt><dd>eventos editoriales</dd></div>
          <div><dt>{number(totals.questions)}</dt><dd>preguntas ancladas</dd></div>
        </dl>
      </header>

      <div
        className="ptl-pulse-chart"
        role="group"
        aria-label="Volumen de hechos publicados por época"
        onPointerLeave={() => setPreview(null)}
      >
        {volumes.map((volume, index) => {
          const active = volume.code === selected;
          const highlighted = volume.code === currentCode;
          const ratio = Math.sqrt(volume.facts / maxFacts);
          const height = 12 + ratio * 78;
          const period = PERIODS[volume.code];
          return (
            <button
              key={volume.code}
              type="button"
              className={`ptl-pulse-period${active ? " is-active" : ""}${highlighted ? " is-highlighted" : ""}`}
              style={
                {
                  "--pulse-color": getPeriodColor(volume.code),
                  "--pulse-height": `${height}%`,
                  "--pulse-delay": `${index * 24}ms`,
                } as CSSProperties
              }
              aria-pressed={active}
              aria-label={`${period.label}, ${volume.facts} ${volume.facts === 1 ? "hecho publicado" : "hechos publicados"}`}
              onPointerEnter={() => setPreview(volume.code)}
              onFocus={() => setPreview(volume.code)}
              onBlur={() => setPreview(null)}
              onClick={() => onSelect(volume.code)}
            >
              <span className="ptl-pulse-count">{number(volume.facts)}</span>
              <span className="ptl-pulse-meter" aria-hidden="true">
                <i />
                <b />
              </span>
              <span className="ptl-pulse-code">{period.short}</span>
            </button>
          );
        })}
      </div>

      {current ? (
        <div className="ptl-pulse-readout" aria-live="polite">
          <strong>{PERIODS[current.code].label}</strong>
          <span>
            {number(current.facts)} {current.facts === 1 ? "hecho publicado" : "hechos publicados"}
            {` · ${number(current.events)} eventos · ${number(current.questions)} preguntas del corpus`}
          </span>
        </div>
      ) : null}
    </section>
  );
}
