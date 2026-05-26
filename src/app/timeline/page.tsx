"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Radar,
  FileText,
  BookOpen,
  LayoutGrid,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  Skeleton,
  Tooltip,
} from "@/components/ui";
import { PeriodBadge } from "@/components/domain/period-badge";
import { PERIOD_OPTIONS, PERIOD_YEAR_BOUNDS } from "@/lib/taxonomy";
import { getPeriodColor, getCategoryColor } from "@/lib/design-tokens";

interface TimelineData {
  questions: Array<{ periodoCode: string; periodoNombre: string; periodoRango: string; count: number }>;
  docsByPeriod: Array<{ code: string; count: number }>;
  deliverablesByPeriod: Array<{ code: string; count: number }>;
}

export default function TimelinePage() {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/timeline")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="app-page-wide">
        <Skeleton variant="line" className="h-8 w-72 mb-3" />
        <Skeleton variant="line" className="h-4 w-[480px] mb-6" />
        <Skeleton variant="rect" className="h-[320px] w-full" />
      </div>
    );
  }

  const qByCode = Object.fromEntries(data.questions.map((q) => [q.periodoCode, q.count]));
  const docsByCode = Object.fromEntries(data.docsByPeriod.map((d) => [d.code, d.count]));
  const delivsByCode = Object.fromEntries(data.deliverablesByPeriod.map((d) => [d.code, d.count]));

  // Excluir TRANS para el eje cronológico
  const chronological = PERIOD_OPTIONS.filter((p) => p.code !== "TRANS");
  const maxCount = Math.max(1, ...chronological.map((p) => qByCode[p.code] ?? 0));

  const selectedPeriod = selected ? PERIOD_OPTIONS.find((p) => p.code === selected) : null;

  return (
    <div className="app-page-wide">
      <header className="mb-6">
        <h2
          className="serif-title text-[28px] leading-tight m-0 text-[var(--color-ink-1000)] inline-flex items-center gap-2"
          style={{ fontWeight: 700 }}
        >
          <Radar className="size-6 text-[var(--accent)]" />
          Línea de tiempo histórica
        </h2>
        <p className="text-[14px] leading-relaxed text-[var(--fg-muted)] mt-1.5 mb-0 max-w-[760px]">
          Recorrido cronológico por 14 períodos de la historia colombiana, desde lo prehispánico hasta el posconflicto.
          Cada barra muestra la densidad de preguntas; los anillos, documentos y producciones.
        </p>
      </header>

      <Card variant="default" size="md" className="mb-4">
        {/* Timeline horizontal */}
        <div className="overflow-x-auto pb-3">
          <div className="flex gap-2 pt-8" style={{ minWidth: 1100 }}>
            {chronological.map((p) => {
              const qCount = qByCode[p.code] ?? 0;
              const docCount = docsByCode[p.code] ?? 0;
              const delivCount = delivsByCode[p.code] ?? 0;
              const heightPct = (qCount / maxCount) * 100;
              const color = getPeriodColor(p.code);
              const isSelected = selected === p.code;

              return (
                <div
                  key={p.code}
                  onClick={() => setSelected(isSelected ? null : p.code)}
                  className="flex-1 cursor-pointer flex flex-col items-center"
                  style={{ minWidth: 72 }}
                >
                  <div className="h-[220px] flex items-end w-full relative">
                    <Tooltip
                      content={
                        <div>
                          <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                          <div style={{ fontSize: 11, opacity: 0.85 }}>{p.rango}</div>
                          <div style={{ marginTop: 4, fontSize: 11 }}>
                            {qCount} preguntas · {docCount} docs · {delivCount} producciones
                          </div>
                        </div>
                      }
                    >
                      <div
                        className="w-full rounded transition-all duration-200 relative"
                        style={{
                          minHeight: 4,
                          height: `${Math.max(4, heightPct)}%`,
                          background: `linear-gradient(to top, ${color}, ${color}88)`,
                          opacity: isSelected ? 1 : 0.85,
                          border: isSelected ? `2px solid ${color}` : "none",
                          boxShadow: isSelected ? `0 0 0 4px ${color}33` : "none",
                        }}
                      >
                        {qCount > 0 && heightPct > 15 && (
                          <span
                            className="absolute left-0 right-0 text-center"
                            style={{
                              top: 6,
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#fff",
                              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                            }}
                          >
                            {qCount}
                          </span>
                        )}
                      </div>
                    </Tooltip>
                  </div>

                  <div className="my-2 w-full" style={{ height: 1, background: color }} />

                  <span
                    className="text-[10px]"
                    style={{ color: "var(--fg-subtle)", fontFamily: "var(--font-mono)" }}
                  >
                    {p.rango}
                  </span>
                  <span
                    className="text-center mt-1"
                    style={{
                      fontSize: 11,
                      color: isSelected ? color : "var(--fg-default)",
                      fontWeight: isSelected ? 600 : 500,
                      lineHeight: 1.25,
                      maxWidth: 90,
                    }}
                  >
                    {p.nombre.split(" ").slice(0, 3).join(" ")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leyenda */}
        <div className="flex items-center gap-5 mt-4">
          <div className="flex items-center gap-1.5">
            <div
              className="rounded-sm"
              style={{ width: 12, height: 12, background: "var(--accent)" }}
            />
            <span className="text-xs text-[var(--fg-muted)]">Preguntas (altura)</span>
          </div>
          <span className="text-xs text-[var(--fg-subtle)]">
            Click en un período para explorar
          </span>
        </div>
      </Card>

      {/* Detalle del período seleccionado */}
      {selectedPeriod ? (
        <Card variant="default" size="md">
          <header className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <PeriodBadge code={selectedPeriod.code} size="md" />
              <span className="text-sm text-[var(--fg-muted)]">{selectedPeriod.rango}</span>
            </div>
            <Link
              href={`/questions?periodo=${selectedPeriod.code}`}
              className="text-[13px] text-[var(--accent)] hover:underline inline-flex items-center gap-1"
            >
              Ver preguntas <ArrowRight className="size-3" />
            </Link>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MiniStat
              icon={BookOpen}
              label="Preguntas"
              value={qByCode[selectedPeriod.code] ?? 0}
              color={getPeriodColor(selectedPeriod.code)}
            />
            <MiniStat
              icon={FileText}
              label="Documentos"
              value={docsByCode[selectedPeriod.code] ?? 0}
              color={getPeriodColor(selectedPeriod.code)}
            />
            <MiniStat
              icon={LayoutGrid}
              label="Producciones"
              value={delivsByCode[selectedPeriod.code] ?? 0}
              color={getPeriodColor(selectedPeriod.code)}
            />
          </div>

          {/* Timeline real por yearPrincipal dentro del período */}
          <InnerPeriodTimeline periodoCode={selectedPeriod.code} />
        </Card>
      ) : (
        <Card variant="default" size="md">
          <div className="py-10 text-center">
            <div className="text-[13px] text-[var(--fg-subtle)]">
              Selecciona un período para ver detalles
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─── MiniStat ────────────────────────────────────────────────────────────── */

function MiniStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card variant="outline" size="sm">
      <div className="flex flex-col gap-1">
        <Icon className="size-5" style={{ color }} />
        <span className="text-xs text-[var(--fg-muted)]">{label}</span>
        <span className="text-[26px] font-semibold text-[var(--fg-default)] tabular-nums">
          {value}
        </span>
      </div>
    </Card>
  );
}

// ─── Timeline anidado por año real ──────────────────────────────────────────
interface InnerQ {
  id: string;
  pregunta: string;
  yearPrincipal: number | null;
  categoriaCode: string;
  categoriaNombre: string;
}

function InnerPeriodTimeline({ periodoCode }: { periodoCode: string }) {
  const [items, setItems] = useState<InnerQ[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    (async () => {
      if (!cancelled) setLoading(true);
      try {
        const r = await fetch(
          `/api/questions?periodo=${periodoCode}&limit=200&sortBy=cronologico`,
          { signal: ctrl.signal },
        );
        const d = await r.json();
        if (cancelled) return;
        setItems(d.questions ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [periodoCode]);

  const bounds = PERIOD_YEAR_BOUNDS[periodoCode];
  if (!bounds) return null;

  // Para PRE el rango "real" es muy ancho (-10000 a 1499). Usamos 0–1499 visualmente.
  const xStart = periodoCode === "PRE" ? 800 : bounds.start;
  const xEnd = bounds.end;

  const withYear = items.filter((q) => q.yearPrincipal != null);
  const withoutYear = items.filter((q) => q.yearPrincipal == null);

  const periodColor = getPeriodColor(periodoCode);

  const xPct = (year: number) => {
    const clamped = Math.max(xStart, Math.min(xEnd, year));
    return ((clamped - xStart) / Math.max(1, xEnd - xStart)) * 100;
  };

  // Marcadores: 5 ticks equiespaciados
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(
    (p) => Math.round(xStart + p * (xEnd - xStart))
  );

  if (loading) {
    return (
      <div className="mt-4">
        <Skeleton variant="line" className="h-4 w-64 mb-2" />
        <Skeleton variant="rect" className="h-[160px] w-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  // Asignar pista vertical (lane) a cada pregunta para que no se sobrepongan
  // demasiado: ordenamos por año y vamos buscando la primera lane libre.
  const sorted = [...withYear].sort((a, b) => (a.yearPrincipal ?? 0) - (b.yearPrincipal ?? 0));
  const LANE_COUNT = 6;
  const MIN_DELTA_PCT = 3.5; // si dos puntos están a <3.5% pixel, se separan en otra lane
  const lanes: number[] = []; // último xPct usado en esa lane
  const positioned = sorted.map((q) => {
    const x = xPct(q.yearPrincipal!);
    let lane = lanes.findIndex((last) => Math.abs(x - last) >= MIN_DELTA_PCT);
    if (lane === -1) {
      if (lanes.length < LANE_COUNT) {
        lane = lanes.length;
        lanes.push(x);
      } else {
        // saturación: ciclar entre lanes
        lane = lanes.length % LANE_COUNT;
        lanes[lane] = x;
      }
    } else {
      lanes[lane] = x;
    }
    return { q, x, lane };
  });

  return (
    <div className="mt-5">
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-xs font-semibold text-[var(--fg-muted)]">
          Cronología fina por año principal
        </span>
        <span className="text-[11px] text-[var(--fg-subtle)]">
          {withYear.length} preguntas con año {withoutYear.length > 0 && `· ${withoutYear.length} sin año`}
        </span>
      </div>

      <div
        className="relative overflow-hidden rounded-lg"
        style={{
          height: 200,
          background: "var(--bg-muted)",
          padding: "12px 12px 28px 12px",
        }}
      >
        {/* Tick lines */}
        {ticks.map((y) => (
          <div
            key={`tick-${y}`}
            className="absolute"
            style={{
              left: `calc(12px + ${xPct(y)}% * (100% - 24px) / 100%)`,
              top: 12,
              bottom: 28,
              width: 1,
              background: "color-mix(in oklab, var(--border-default) 55%, transparent)",
            }}
          />
        ))}

        {/* Points */}
        {positioned.map(({ q, x, lane }) => {
          const color = getCategoryColor(q.categoriaCode);
          const top = 16 + lane * 26;
          return (
            <Tooltip
              key={q.id}
              content={
                <div style={{ maxWidth: 320 }}>
                  <div style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>{q.yearPrincipal}</div>
                  <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                    {q.categoriaNombre}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12 }}>
                    {q.pregunta.slice(0, 200)}
                    {q.pregunta.length > 200 ? "…" : ""}
                  </div>
                </div>
              }
            >
              <Link
                href={`/questions?focus=${q.id}`}
                className="absolute block"
                style={{
                  left: `calc(12px + ${x}% * (100% - 24px) / 100%)`,
                  top,
                  transform: "translateX(-50%)",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: color,
                  border: `2px solid ${periodColor}`,
                  boxShadow: "0 0 0 2px var(--bg-page)",
                  cursor: "pointer",
                }}
              />
            </Tooltip>
          );
        })}

        {/* Eje x */}
        <div
          className="absolute"
          style={{
            left: 12,
            right: 12,
            bottom: 18,
            height: 1,
            background: "var(--border-default)",
          }}
        />
        {ticks.map((y) => (
          <span
            key={`label-${y}`}
            className="absolute"
            style={{
              left: `calc(12px + ${xPct(y)}% * (100% - 24px) / 100%)`,
              bottom: 4,
              transform: "translateX(-50%)",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: "var(--fg-subtle)",
            }}
          >
            {y}
          </span>
        ))}
      </div>

      <span className="block text-[10px] text-[var(--fg-subtle)] mt-2">
        Cada punto = una pregunta. Color = categoría. Hover para ver. Click para abrir.
      </span>
    </div>
  );
}
