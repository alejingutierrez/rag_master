"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import { PeriodRibbon } from "@/components/public/period-ribbon";
import type { TimelineFile } from "@/lib/timeline-data";
import type { TimelineLinks } from "@/lib/public-data";
import { TimelineDensityStrip } from "./TimelineDensityStrip";
import { PublicTimelineEventDrawer } from "./PublicTimelineEventDrawer";
import { fmtYearSpan, type TimelineEventData } from "./TimelineEventDrawer";

// Orden y rango cronológico de los períodos con eventos minados (sin TRANS).
const ORDER: PeriodCode[] = [
  "PRE", "CON", "COL", "PRE_IND", "IND", "NGR", "EUC", "REG",
  "REP_LIB", "VIO", "FN", "CNA", "C91", "SDE", "POS",
];
const KIND_LABEL: Record<string, string> = {
  hecho: "Hecho",
  epoca: "Época",
  entidad: "Entidad",
  pregunta: "Ensayo",
  ensayo: "Ensayo",
};

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

  const selectPeriod = (code: PeriodCode) => {
    setSelected(code);
    setSelectedEvent(null);
  };

  const sample = useMemo(() => periodLinks?.pieces.slice(0, 6) ?? [], [periodLinks]);

  return (
    <div className="fade-up">
      <section style={{ padding: "64px 34px 36px", maxWidth: 1180, margin: "0 auto" }}>
        <div className="label" style={{ marginBottom: 16 }}>
          Exploración temporal
        </div>
        <h1 className="display" style={{ fontSize: "clamp(48px, 7vw, 84px)", margin: 0, color: "var(--fg)", lineHeight: 1.02 }}>
          Quinientos años,{" "}
          <span className="display-italic" style={{ color: "var(--fg-muted)" }}>
            quince períodos.
          </span>
        </h1>
        <p className="serif" style={{ fontStyle: "italic", fontSize: 19, color: "var(--fg-muted)", margin: "18px 0 0", maxWidth: "50ch", lineHeight: 1.45 }}>
          Una línea de tiempo calibrada por atención: los momentos que el corpus más interroga
          pesan más. Elija un período y explore sus eventos.
        </p>
      </section>

      <hr className="hairline" style={{ margin: "0 34px", maxWidth: 1180 }} />

      {/* Selector de períodos — cinta cronológica compartida (modo navegación). */}
      <section style={{ padding: "40px 34px 20px", maxWidth: 1180, margin: "0 auto" }}>
        <PeriodRibbon
          order={ORDER}
          selected={selected}
          onSelect={(c) => c && selectPeriod(c as PeriodCode)}
          label="Períodos canónicos · seleccione uno"
          mode="nav"
        />
      </section>

      <hr className="hairline" style={{ margin: "12px 34px 0", maxWidth: 1180 }} />

      {/* Cuerpo: sidebar del período + eventos */}
      <section
        className="pt-body"
        style={{ padding: "48px 34px 90px", maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "300px 1fr", gap: 64 }}
      >
        <aside style={{ position: "sticky", top: 72, alignSelf: "start" }}>
          <div
            className="mono"
            style={{ fontSize: 11, color: `var(--p-${period.slug})`, letterSpacing: "0.08em", marginBottom: 12, textTransform: "uppercase", fontWeight: 600 }}
          >
            Período {String(ORDER.indexOf(selected) + 1).padStart(2, "0")}
          </div>
          <h2 className="display" style={{ fontSize: 40, margin: "0 0 8px", color: "var(--fg)", lineHeight: 1.0 }}>
            {period.label}
          </h2>
          <div className="mono" style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 24 }}>
            {period.yearRange}
          </div>

          <div style={{ display: "flex", gap: 24, marginBottom: 26 }}>
            <Metric label="Eventos" value={slice.events.length} />
            <Metric label="Piezas" value={periodLinks?.counts.total ?? 0} />
          </div>

          {periodLinks?.epoca && (
            <Link
              href={periodLinks.epoca.href}
              style={{ display: "block", textDecoration: "none", border: "1px solid var(--fg)", padding: "13px 15px", marginBottom: 18 }}
            >
              <span className="mono" style={{ display: "block", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 5 }}>
                Leer la época →
              </span>
              <span className="serif" style={{ fontSize: 14.5, color: "var(--fg)", lineHeight: 1.4 }}>
                {periodLinks.epoca.resumen || periodLinks.epoca.titulo}
              </span>
            </Link>
          )}

          {sample.length > 0 && (
            <div>
              <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 10 }}>
                Publicado en este período
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {sample.map((p) => (
                  <Link
                    key={p.href}
                    href={p.href}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "42px 1fr",
                      gap: 10,
                      padding: "10px 0",
                      borderTop: "1px solid var(--line)",
                      textDecoration: "none",
                      alignItems: "baseline",
                    }}
                  >
                    <span className="mono num" style={{ fontSize: 11, color: `var(--p-${period.slug})`, fontWeight: 600 }}>
                      {p.anio != null ? (p.anio < 0 ? `${-p.anio}aC` : p.anio) : "—"}
                    </span>
                    <span>
                      <span className="serif" style={{ display: "block", fontSize: 13.5, color: "var(--fg)", lineHeight: 1.4 }}>
                        {p.titulo}
                      </span>
                      <span className="mono" style={{ fontSize: 9.5, color: "var(--fg-faint)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {KIND_LABEL[p.kind] ?? p.kind}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>

        <div>
          <SectionHeader
            index="◷"
            title="Eventos pivote"
            caption="Derivados del corpus — calibrados por la atención de las preguntas y las obras"
          />

          {slice.events.length > 0 ? (
            <>
              <div style={{ margin: "8px 0 28px" }}>
                <TimelineDensityStrip
                  histogram={slice.yearHistogram}
                  events={slice.events}
                  periodoCode={selected}
                  selectedEventId={selectedEvent?.id ?? null}
                  onSelectEvent={setSelectedEvent}
                />
                <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-faint)", letterSpacing: "0.04em", marginTop: 6 }}>
                  Barras: preguntas ancladas por año · Círculos: eventos, dimensionados por peso en el corpus
                </div>
              </div>

              <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {slice.events.map((e, i) => (
                  <li key={e.id} style={{ borderTop: i === 0 ? 0 : "1px solid var(--line)" }}>
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(e)}
                      title="Ver detalle del evento"
                      style={{
                        appearance: "none",
                        background: selectedEvent?.id === e.id ? "var(--bg-muted)" : "transparent",
                        border: 0,
                        width: "100%",
                        textAlign: "left",
                        padding: "24px 12px",
                        margin: "0 -12px",
                        cursor: "pointer",
                        display: "grid",
                        gridTemplateColumns: "112px 1fr",
                        gap: 28,
                        alignItems: "baseline",
                        transition: "background 140ms var(--ease-out-custom)",
                      }}
                      onMouseEnter={(ev) => {
                        if (selectedEvent?.id !== e.id) ev.currentTarget.style.background = "var(--bg-muted)";
                      }}
                      onMouseLeave={(ev) => {
                        if (selectedEvent?.id !== e.id) ev.currentTarget.style.background = "transparent";
                      }}
                    >
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
                      <div>
                        <h4 className="display" style={{ fontSize: 26, margin: "0 0 8px", color: "var(--fg)", lineHeight: 1.1 }}>
                          {e.titulo}
                        </h4>
                        <p className="serif" style={{ fontSize: 16, color: "var(--fg-muted)", margin: "0 0 12px", lineHeight: 1.55, maxWidth: 560 }}>
                          {e.resumen}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <span style={{ width: 120, height: 3, background: "var(--bg-muted)", position: "relative", display: "inline-block" }}>
                            <span style={{ position: "absolute", inset: 0, width: `${e.evidencia.peso}%`, background: `var(--p-${period.slug})` }} />
                          </span>
                          <span className="mono num" style={{ fontSize: 11, color: "var(--fg-muted)", letterSpacing: "0.03em" }}>
                            {e.curated
                              ? `${e.evidencia.nPreguntas.toLocaleString("es-CO")} menciones · curado`
                              : `${e.evidencia.nPreguntas.toLocaleString("es-CO")} preguntas · ${e.evidencia.nLibros.toLocaleString("es-CO")} obras`}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="serif" style={{ fontSize: 16, color: "var(--fg-muted)", lineHeight: 1.55, maxWidth: 560 }}>
              Aún no hay eventos para este período.
            </p>
          )}
        </div>
      </section>

      <PublicTimelineEventDrawer
        event={selectedEvent}
        periodoCode={selected}
        links={periodLinks}
        entityHrefs={entityHrefs}
        onClose={() => setSelectedEvent(null)}
      />

      <style>{`
        @media (max-width: 860px) {
          .pt-body { grid-template-columns: 1fr !important; gap: 40px !important; }
          .pt-body aside { position: static !important; }
        }
      `}</style>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div className="display num" style={{ fontSize: 28, color: "var(--fg)", lineHeight: 1, letterSpacing: "-0.02em" }}>
        {value.toLocaleString("es-CO")}
      </div>
    </div>
  );
}
