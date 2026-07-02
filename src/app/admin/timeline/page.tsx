"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SectionHeader, primaryBtn } from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import { PERIOD_EVENTS, type PeriodEvent } from "@/lib/period-events";
import {
  TimelineEventDrawer,
  fmtYearSpan,
  type TimelineEventData,
  type TimelinePeriodData,
} from "@/components/timeline/TimelineEventDrawer";
import { TimelineDensityStrip } from "@/components/timeline/TimelineDensityStrip";

interface TimelineData {
  questions: Array<{
    periodoCode: string;
    count: number;
  }>;
  docsByPeriod: Array<{ code: string; count: number }>;
  chunksByPeriod: Array<{ code: string; count: number }>;
  deliverablesByPeriod: Array<{ code: string; count: number }>;
}

// Rango cronológico de cada período (para la regla).
const YEAR_BOUNDS: Record<PeriodCode, [number, number]> = {
  PRE: [1480, 1499],
  CON: [1499, 1599],
  COL: [1600, 1780],
  PRE_IND: [1780, 1809],
  IND: [1810, 1831],
  NGR: [1831, 1862],
  EUC: [1863, 1885],
  REG: [1886, 1929],
  REP_LIB: [1930, 1946],
  VIO: [1946, 1957],
  FN: [1958, 1974],
  CNA: [1974, 1990],
  C91: [1991, 2002],
  SDE: [2002, 2016],
  POS: [2016, 2026],
  TRANS: [1480, 2026],
};

const ORDER: PeriodCode[] = [
  "PRE",
  "CON",
  "COL",
  "PRE_IND",
  "IND",
  "NGR",
  "EUC",
  "REG",
  "REP_LIB",
  "VIO",
  "FN",
  "CNA",
  "C91",
  "SDE",
  "POS",
];

export default function TimelinePage() {
  return (
    <Suspense fallback={<div style={{ padding: 56 }} />}>
      <TimelineContent />
    </Suspense>
  );
}

function TimelineContent() {
  const router = useRouter();
  const search = useSearchParams();
  const initial = (search.get("p") as PeriodCode | null) ?? "REG";
  const [selected, setSelected] = useState<PeriodCode>(
    ORDER.includes(initial) ? initial : "REG",
  );
  const [data, setData] = useState<TimelineData | null>(null);
  // Eventos minados del corpus, por período (cache en memoria de la sesión).
  const [minedByPeriod, setMinedByPeriod] = useState<
    Record<string, TimelinePeriodData | null>
  >({});
  const [selectedEvent, setSelectedEvent] = useState<TimelineEventData | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/timeline", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TimelineData | null) => setData(d))
      .catch(() => {
        /* ignore — UI degrada a 0 counts */
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (minedByPeriod[selected] !== undefined) return;
    const ctrl = new AbortController();
    fetch(`/api/timeline/events?periodo=${selected}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TimelinePeriodData | null) =>
        setMinedByPeriod((prev) => ({ ...prev, [selected]: d })),
      )
      .catch(() => {
        /* ignore — degrada a hitos curados */
      });
    return () => ctrl.abort();
  }, [selected, minedByPeriod]);

  const counts = useMemo(() => {
    const docs = new Map(data?.docsByPeriod.map((d) => [d.code, d.count]) ?? []);
    const chunks = new Map(
      data?.chunksByPeriod.map((d) => [d.code, d.count]) ?? [],
    );
    const qs = new Map(data?.questions.map((q) => [q.periodoCode, q.count]) ?? []);
    const prods = new Map(
      data?.deliverablesByPeriod.map((d) => [d.code, d.count]) ?? [],
    );
    return { docs, chunks, qs, prods };
  }, [data]);

  const period = PERIODS[selected];
  const mined = minedByPeriod[selected] ?? null;
  const fallbackEvents: PeriodEvent[] = PERIOD_EVENTS[selected] ?? [];

  const docCount = counts.docs.get(selected) ?? 0;
  const qCount = counts.qs.get(selected) ?? 0;
  const prodCount = counts.prods.get(selected) ?? 0;
  const fragmentCount = counts.chunks.get(selected) ?? 0;

  const selectPeriod = (code: PeriodCode) => {
    setSelected(code);
    setSelectedEvent(null);
  };

  return (
    <div className="fade-up" data-screen-label="Timeline">
      <section style={{ padding: "72px 56px 40px", maxWidth: 1320 }}>
        <div className="label" style={{ marginBottom: 16 }}>
          Exploración temporal
        </div>
        <h1
          className="display"
          style={{
            fontSize: "clamp(56px, 7vw, 92px)",
            margin: 0,
            color: "var(--fg)",
          }}
        >
          Quinientos años,{" "}
          <span className="display-italic" style={{ color: "var(--fg-muted)" }}>
            quince períodos.
          </span>
        </h1>
      </section>

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section style={{ padding: "44px 56px 24px", maxWidth: 1320 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 22,
            flexWrap: "wrap",
          }}
        >
          <div className="label">Períodos canónicos · seleccione uno</div>
          <div
            className="mono"
            style={{
              fontSize: 12,
              color: `var(--p-${period.slug})`,
              letterSpacing: "0.04em",
              fontWeight: 600,
            }}
          >
            {String(ORDER.indexOf(selected) + 1).padStart(2, "0")} · {period.label} ·{" "}
            {period.yearRange}
          </div>
        </div>

        <div style={{ paddingTop: 20, paddingBottom: 40 }}>
          {/* Etiquetas de año (inicio de cada período), alineadas a las barras */}
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {ORDER.map((code) => {
              const [a] = YEAR_BOUNDS[code];
              const active = code === selected;
              return (
                <div
                  key={code}
                  className="mono num"
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontSize: 10,
                    color: active
                      ? `var(--p-${PERIODS[code].slug})`
                      : "var(--fg-subtle)",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {a}
                </div>
              );
            })}
          </div>

          {/* Barras uniformes — una por período, todas clicables por igual */}
          <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
            {ORDER.map((code, i) => {
              const p = PERIODS[code];
              const active = code === selected;
              const n = String(i + 1).padStart(2, "0");
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => selectPeriod(code)}
                  title={`${n} · ${p.label} · ${p.yearRange}`}
                  aria-label={`${p.label}, ${p.yearRange}`}
                  style={{
                    flex: 1,
                    height: active ? 28 : 12,
                    background: active ? `var(--p-${p.slug})` : "var(--bg-muted)",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                    transition: "all 200ms var(--ease-out-custom)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "var(--fg-faint)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "var(--bg-muted)";
                  }}
                />
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {ORDER.map((code) => {
            const p = PERIODS[code];
            const active = code === selected;
            return (
              <button
                key={code}
                type="button"
                onClick={() => selectPeriod(code)}
                style={{
                  appearance: "none",
                  background: active ? "var(--fg)" : "transparent",
                  color: active ? "var(--bg)" : "var(--fg-muted)",
                  border: "1px solid " + (active ? "var(--fg)" : "var(--line-strong)"),
                  borderRadius: 999,
                  padding: "5px 11px",
                  fontSize: 11.5,
                  fontFamily: "var(--font-mono)",
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: `var(--p-${p.slug})`,
                  }}
                />
                {p.label}
              </button>
            );
          })}
        </div>
      </section>

      <hr className="hairline" style={{ margin: "16px 56px 0" }} />

      <section
        style={{
          padding: "56px 56px 96px",
          maxWidth: 1320,
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 80,
        }}
      >
        <aside style={{ position: "sticky", top: 80, alignSelf: "start" }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: `var(--p-${period.slug})`,
              letterSpacing: "0.08em",
              marginBottom: 12,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Período {String(ORDER.indexOf(selected) + 1).padStart(2, "0")}
          </div>
          <h2
            className="display"
            style={{
              fontSize: 44,
              margin: "0 0 8px",
              color: "var(--fg)",
              lineHeight: 1.0,
            }}
          >
            {period.label}
          </h2>
          <div
            className="mono"
            style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 32 }}
          >
            {period.yearRange}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
              marginBottom: 28,
            }}
          >
            <Metric label="Obras" value={docCount} />
            <Metric label="Fragmentos" value={fragmentCount} />
            <Metric label="Preguntas" value={qCount} />
            <Metric label="Producciones" value={prodCount} />
          </div>

          <button
            type="button"
            onClick={() => router.push(`/admin/questions?periodo=${selected}`)}
            style={{ ...primaryBtn, width: "100%" }}
          >
            Consultar este período →
          </button>
        </aside>

        <div>
          {mined && mined.events.length > 0 ? (
            <>
              <SectionHeader
                index="◷"
                title="Eventos pivote"
                caption="Derivados del corpus — calibrados por la atención de las preguntas y las obras"
              />

              <div style={{ margin: "8px 0 28px" }}>
                <TimelineDensityStrip
                  histogram={mined.yearHistogram}
                  events={mined.events}
                  periodoCode={selected}
                  selectedEventId={selectedEvent?.id ?? null}
                  onSelectEvent={setSelectedEvent}
                />
                <div
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    color: "var(--fg-faint)",
                    letterSpacing: "0.04em",
                    marginTop: 6,
                  }}
                >
                  Barras: preguntas ancladas por año · Círculos: eventos, dimensionados
                  por peso en el corpus
                </div>
              </div>

              <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {mined.events.map((e, i) => (
                  <li key={e.id} style={{ borderTop: i === 0 ? 0 : "1px solid var(--line)" }}>
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(e)}
                      title="Ver detalle del evento"
                      style={{
                        appearance: "none",
                        background:
                          selectedEvent?.id === e.id ? "var(--bg-muted)" : "transparent",
                        border: 0,
                        width: "100%",
                        textAlign: "left",
                        padding: "24px 12px",
                        margin: "0 -12px",
                        cursor: "pointer",
                        display: "grid",
                        gridTemplateColumns: "120px 1fr",
                        gap: 32,
                        alignItems: "baseline",
                        transition: "background 140ms var(--ease-out-custom)",
                      }}
                      onMouseEnter={(ev) => {
                        if (selectedEvent?.id !== e.id)
                          ev.currentTarget.style.background = "var(--bg-muted)";
                      }}
                      onMouseLeave={(ev) => {
                        if (selectedEvent?.id !== e.id)
                          ev.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div>
                        <div
                          className="display num"
                          style={{
                            fontSize: e.anioFin !== e.anioInicio ? 24 : 32,
                            color: `var(--p-${period.slug})`,
                            lineHeight: 1.1,
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {fmtYearSpan(e.anioInicio, e.anioFin)}
                        </div>
                      </div>
                      <div>
                        <h4
                          className="display"
                          style={{
                            fontSize: 26,
                            margin: "0 0 8px",
                            color: "var(--fg)",
                            lineHeight: 1.1,
                          }}
                        >
                          {e.titulo}
                        </h4>
                        <p
                          className="serif"
                          style={{
                            fontSize: 16,
                            color: "var(--fg-muted)",
                            margin: "0 0 12px",
                            lineHeight: 1.55,
                            maxWidth: 560,
                          }}
                        >
                          {e.resumen}
                        </p>
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 14 }}
                        >
                          <span
                            style={{
                              width: 120,
                              height: 3,
                              background: "var(--bg-muted)",
                              position: "relative",
                              display: "inline-block",
                            }}
                          >
                            <span
                              style={{
                                position: "absolute",
                                inset: 0,
                                width: `${e.evidencia.peso}%`,
                                background: `var(--p-${period.slug})`,
                              }}
                            />
                          </span>
                          <span
                            className="mono num"
                            style={{
                              fontSize: 11,
                              color: "var(--fg-muted)",
                              letterSpacing: "0.03em",
                            }}
                          >
                            {e.evidencia.nPreguntas.toLocaleString("es-CO")} preguntas ·{" "}
                            {e.evidencia.nLibros.toLocaleString("es-CO")} obras
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <SectionHeader
                index="◷"
                title="Eventos pivote"
                caption="Hitos de referencia — curados, no derivados del corpus"
              />

              {fallbackEvents.length === 0 && (
                <p
                  className="serif"
                  style={{
                    fontSize: 16,
                    color: "var(--fg-muted)",
                    lineHeight: 1.55,
                    maxWidth: 560,
                  }}
                >
                  Aún no hay hitos para este período.
                </p>
              )}

              {fallbackEvents.length > 0 && (
                <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {fallbackEvents.map((e, i) => (
                    <li
                      key={i}
                      style={{
                        borderTop: i === 0 ? 0 : "1px solid var(--line)",
                        padding: "24px 0",
                        display: "grid",
                        gridTemplateColumns: "100px 1fr",
                        gap: 32,
                        alignItems: "baseline",
                      }}
                    >
                      <div
                        className="display num"
                        style={{
                          fontSize: 32,
                          color: `var(--p-${period.slug})`,
                          lineHeight: 1,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {e.y}
                      </div>
                      <div>
                        <h4
                          className="display"
                          style={{
                            fontSize: 26,
                            margin: "0 0 8px",
                            color: "var(--fg)",
                            lineHeight: 1.1,
                          }}
                        >
                          {e.t}
                        </h4>
                        <p
                          className="serif"
                          style={{
                            fontSize: 16,
                            color: "var(--fg-muted)",
                            margin: 0,
                            lineHeight: 1.55,
                            maxWidth: 560,
                          }}
                        >
                          {e.note}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      </section>

      <TimelineEventDrawer
        event={selectedEvent}
        periodoCode={selected}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div
        className="display num"
        style={{
          fontSize: 28,
          color: "var(--fg)",
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {value.toLocaleString("es-CO")}
      </div>
    </div>
  );
}
