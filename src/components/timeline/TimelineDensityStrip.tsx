"use client";

import { useMemo } from "react";
import type { PeriodCode } from "@/lib/design-tokens";
import { PERIODS } from "@/lib/design-tokens";
import { fmtYearSpan, type TimelineEventData } from "./TimelineEventDrawer";

/**
 * Franja de densidad del período: histograma de preguntas por año (barras)
 * con los eventos minados como marcadores clicables, dimensionados por peso.
 */
export function TimelineDensityStrip({
  histogram,
  events,
  periodoCode,
  selectedEventId,
  onSelectEvent,
}: {
  histogram: Array<{ y: number; n: number; b: number }>;
  events: TimelineEventData[];
  periodoCode: PeriodCode;
  selectedEventId: string | null;
  onSelectEvent: (ev: TimelineEventData) => void;
}) {
  const slug = PERIODS[periodoCode].slug;

  const layout = useMemo(() => {
    if (histogram.length === 0) return null;
    const W = 800;
    const years = histogram.map((h) => h.y);
    const evYears = events.flatMap((e) => [e.anioInicio, e.anioFin]);
    const min = Math.min(...years, ...evYears);
    const max = Math.max(...years, ...evYears);
    const span = Math.max(1, max - min);
    const pad = 14;
    const x = (y: number) => pad + ((y - min) / span) * (W - 2 * pad);
    const maxN = Math.max(...histogram.map((h) => h.n));
    const barW = Math.max(1.4, Math.min(10, (W - 2 * pad) / (span + 1) - 0.6));
    return { W, min, max, x, maxN, barW };
  }, [histogram, events]);

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
      aria-label="Densidad de preguntas por año, con eventos pivote"
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
            <title>{`${fmtY(h.y)} · ${h.n} preguntas / ${h.b} obras`}</title>
          </rect>
        );
      })}

      {/* Línea base */}
      <line x1={0} y1={BASE} x2={W} y2={BASE} stroke="var(--line)" strokeWidth={1} />

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
            <title>{`${fmtYearSpan(ev.anioInicio, ev.anioFin)} · ${ev.titulo} — ${ev.evidencia.nPreguntas} preguntas / ${ev.evidencia.nLibros} obras`}</title>
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
