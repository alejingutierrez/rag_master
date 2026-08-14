"use client";

import { useMemo } from "react";
import type { PeriodCode } from "@/lib/design-tokens";
import { PERIODS } from "@/lib/design-tokens";
import type { TimelineLinkPiece } from "@/lib/public-data";
import { fmtYearSpan, type TimelineEventData } from "./TimelineEventDrawer";

/**
 * Franja de densidad del período: histograma de preguntas por año (barras)
 * con los eventos minados como marcadores clicables, dimensionados por peso.
 */
export function TimelineDensityStrip({
  histogram,
  events,
  facts = [],
  periodoCode,
  selectedEventId,
  onSelectEvent,
}: {
  histogram: Array<{ y: number; n: number; b: number }>;
  events: TimelineEventData[];
  facts?: TimelineLinkPiece[];
  periodoCode: PeriodCode;
  selectedEventId: string | null;
  onSelectEvent: (ev: TimelineEventData) => void;
}) {
  const slug = PERIODS[periodoCode].slug;

  const layout = useMemo(() => {
    if (histogram.length === 0 && events.length === 0 && facts.length === 0) return null;
    const W = 800;
    const years = histogram.map((h) => h.y);
    const evYears = events.flatMap((e) => [e.anioInicio, e.anioFin]);
    const factYears = facts.flatMap((fact) =>
      fact.anio == null ? [] : [fact.anio, fact.anioFin ?? fact.anio],
    );
    const min = Math.min(...years, ...evYears, ...factYears);
    const max = Math.max(...years, ...evYears, ...factYears);
    const span = Math.max(1, max - min);
    const pad = 14;
    const x = (y: number) => pad + ((y - min) / span) * (W - 2 * pad);
    const maxN = Math.max(1, ...histogram.map((h) => h.n));
    const barW = Math.max(1.4, Math.min(10, (W - 2 * pad) / (span + 1) - 0.6));
    return { W, min, max, x, maxN, barW };
  }, [histogram, events, facts]);

  const factYears = useMemo(() => {
    const grouped = new Map<number, number>();
    for (const fact of facts) {
      if (fact.anio == null) continue;
      grouped.set(fact.anio, (grouped.get(fact.anio) ?? 0) + 1);
    }
    return [...grouped.entries()];
  }, [facts]);

  if (!layout) return null;
  const { W, min, max, x, maxN, barW } = layout;

  const BASE = 86; // línea base de las barras
  const MARKER_Y = 18; // carril de los marcadores

  const fmtY = (y: number) => (y < 0 ? `${-y} a.C.` : String(y));

  return (
    <svg
      viewBox={`0 0 ${W} 112`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label="Densidad de preguntas por año, con eventos editoriales y hechos publicados"
    >
      {/* Barras de densidad */}
      {histogram.map((h) => {
        const height = Math.max(2, Math.sqrt(h.n / maxN) * 56);
        return (
          <rect
            key={h.y}
            x={x(h.y) - barW / 2}
            y={BASE - height}
            width={barW}
            height={height}
            fill={`var(--p-${slug})`}
            opacity={0.22}
          >
            <title>{`${fmtY(h.y)} · ${h.n} ${h.n === 1 ? "pregunta" : "preguntas"} / ${h.b} ${h.b === 1 ? "obra" : "obras"}`}</title>
          </rect>
        );
      })}

      {/* Línea base */}
      <line x1={0} y1={BASE} x2={W} y2={BASE} stroke="var(--line)" strokeWidth={1} />

      {/* Hechos publicados: un rombo por año, dimensionado si coinciden varios. */}
      {factYears.map(([year, count]) => {
        const cx = x(year);
        const size = Math.min(7, 3.2 + Math.sqrt(count) * 1.3);
        return (
          <rect
            key={`fact-${year}`}
            x={cx - size / 2}
            y={BASE - size / 2}
            width={size}
            height={size}
            fill={`var(--p-${slug})`}
            stroke="var(--bg)"
            strokeWidth={1}
            transform={`rotate(45 ${cx} ${BASE})`}
          >
            <title>{`${fmtY(year)} · ${count} ${count === 1 ? "hecho publicado" : "hechos publicados"}`}</title>
          </rect>
        );
      })}

      {/* Marcadores de eventos */}
      {events.map((ev) => {
        const cx = x((ev.anioInicio + ev.anioFin) / 2);
        const r = 3.5 + (ev.evidencia.peso / 100) * 5.5;
        const active = ev.id === selectedEventId;
        return (
          <g
            key={ev.id}
            onClick={() => onSelectEvent(ev)}
            style={{ cursor: "pointer" }}
          >
            <title>{`${fmtYearSpan(ev.anioInicio, ev.anioFin)} · ${ev.titulo} — ${
              ev.curated
                ? `${ev.evidencia.nPreguntas} ${ev.evidencia.nPreguntas === 1 ? "mención" : "menciones"} (curado)`
                : `${ev.evidencia.nPreguntas} ${ev.evidencia.nPreguntas === 1 ? "pregunta" : "preguntas"} / ${ev.evidencia.nLibros} ${ev.evidencia.nLibros === 1 ? "obra" : "obras"}`
            }`}</title>
            {/* Tramo del proceso (si es rango) */}
            {ev.anioFin > ev.anioInicio && (
              <line
                x1={x(ev.anioInicio)}
                y1={MARKER_Y}
                x2={x(ev.anioFin)}
                y2={MARKER_Y}
                stroke={`var(--p-${slug})`}
                strokeWidth={active ? 2.5 : 1.5}
                opacity={0.6}
              />
            )}
            {/* Guía vertical hasta la base */}
            <line
              x1={cx}
              y1={MARKER_Y}
              x2={cx}
              y2={BASE}
              stroke={`var(--p-${slug})`}
              strokeWidth={0.75}
              opacity={active ? 0.55 : 0.18}
            />
            {/* Halo clicable generoso */}
            <circle cx={cx} cy={MARKER_Y} r={Math.max(r + 6, 11)} fill="transparent" />
            <circle
              cx={cx}
              cy={MARKER_Y}
              r={r}
              fill={active ? `var(--p-${slug})` : "var(--bg)"}
              stroke={`var(--p-${slug})`}
              strokeWidth={active ? 2 : 1.5}
            />
          </g>
        );
      })}

      {/* Etiquetas de año en los extremos */}
      <text
        x={2}
        y={BASE + 18}
        fontSize={10.5}
        fill="var(--fg-subtle)"
        fontFamily="var(--font-mono)"
      >
        {fmtY(min)}
      </text>
      <text
        x={W - 2}
        y={BASE + 18}
        fontSize={10.5}
        fill="var(--fg-subtle)"
        fontFamily="var(--font-mono)"
        textAnchor="end"
      >
        {fmtY(max)}
      </text>
    </svg>
  );
}
