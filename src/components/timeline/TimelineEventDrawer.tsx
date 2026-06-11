"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PeriodTag } from "@/components/editorial";
import { CATEGORIES, type CategoryCode, type PeriodCode, PERIODS } from "@/lib/design-tokens";

// ─── Tipos del artefacto minado (scripts/mine-timeline-events.mts) ──────────

export interface TimelineEventData {
  id: string;
  anioInicio: number;
  anioFin: number;
  titulo: string;
  resumen: string;
  porQueImporta: string;
  categoria: string;
  entidadesClave: string[];
  evidencia: {
    nPreguntas: number;
    nLibros: number;
    peso: number;
    topEntidades: string[];
    questionIds: string[];
  };
}

export interface TimelinePeriodData {
  yearHistogram: Array<{ y: number; n: number; b: number }>;
  events: TimelineEventData[];
}

interface EventQuestion {
  id: string;
  pregunta: string;
  yearPrincipal?: number | null;
  tipoPregunta?: string | null;
  periodoCode: string;
  document?: { filename: string; metadata?: { bookTitle?: string; author?: string } | null };
}

/** "1899–1902", "1948", "3000 a.C." */
export function fmtYearSpan(a: number, b: number): string {
  const f = (y: number) => (y < 0 ? `${-y} a.C.` : String(y));
  return a === b ? f(a) : `${f(a)}–${f(b)}`;
}

export function TimelineEventDrawer({
  event,
  periodoCode,
  onClose,
}: {
  event: TimelineEventData | null;
  periodoCode: PeriodCode;
  onClose: () => void;
}) {
  const open = event !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: open ? "rgba(0,0,0,0.18)" : "transparent",
          pointerEvents: open ? "auto" : "none",
          zIndex: 40,
          transition: "background 200ms var(--ease-out-custom)",
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(600px, 92vw)",
          background: "var(--bg)",
          borderLeft: "1px solid var(--line-strong)",
          boxShadow: open ? "-24px 0 60px -32px rgba(0,0,0,0.2)" : "none",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 280ms var(--ease-out-custom)",
          zIndex: 50,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* key: remonta el contenido al cambiar de evento — resetea el estado de carga */}
        {event && (
          <DrawerContent key={event.id} ev={event} periodoCode={periodoCode} onClose={onClose} />
        )}
      </aside>
    </>
  );
}

function DrawerContent({
  ev,
  periodoCode,
  onClose,
}: {
  ev: TimelineEventData;
  periodoCode: PeriodCode;
  onClose: () => void;
}) {
  const router = useRouter();
  // null = cargando. Si el evento no tiene preguntas vinculadas, arranca resuelto.
  const [questions, setQuestions] = useState<EventQuestion[] | null>(
    ev.evidencia.questionIds.length === 0 ? [] : null
  );

  useEffect(() => {
    if (ev.evidencia.questionIds.length === 0) return;
    const ctrl = new AbortController();
    const ids = ev.evidencia.questionIds.join(",");
    fetch(`/api/questions?ids=${encodeURIComponent(ids)}&limit=30`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { questions?: EventQuestion[] } | null) => {
        const qs = d?.questions ?? [];
        qs.sort((a, b) => (a.yearPrincipal ?? 0) - (b.yearPrincipal ?? 0));
        setQuestions(qs);
      })
      .catch(() => setQuestions([]));
    return () => ctrl.abort();
  }, [ev]);

  const period = PERIODS[periodoCode];
  const cat = CATEGORIES[ev.categoria as CategoryCode];
  const yearsLabel = fmtYearSpan(ev.anioInicio, ev.anioFin);
  const tallerIntent = `${ev.titulo} (${yearsLabel}): ${ev.porQueImporta}`;

  return (
    <>
      <header
        style={{
          padding: "24px 32px 18px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          position: "sticky",
          top: 0,
          background: "var(--bg)",
          zIndex: 1,
        }}
      >
        <div className="mono num" style={{ fontSize: 11, color: "var(--fg-faint)", letterSpacing: "0.04em" }}>
          EVENTO · {yearsLabel}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            appearance: "none",
            background: "transparent",
            border: 0,
            padding: 6,
            cursor: "pointer",
            color: "var(--fg-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          ✕ ESC
        </button>
      </header>

      <div style={{ padding: "26px 32px 40px", display: "flex", flexDirection: "column", gap: 28 }}>
        <div>
          <div
            className="display num"
            style={{
              fontSize: 40,
              color: `var(--p-${period.slug})`,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              marginBottom: 10,
            }}
          >
            {yearsLabel}
          </div>
          <h2
            className="display"
            style={{ fontSize: 32, margin: 0, color: "var(--fg)", lineHeight: 1.1 }}
          >
            {ev.titulo}
          </h2>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <PeriodTag code={periodoCode} size="md" showName />
          {cat && (
            <span
              className="mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 9px",
                fontSize: 10.5,
                border: "1px solid var(--line-strong)",
                color: "var(--fg-muted)",
                letterSpacing: "0.05em",
              }}
            >
              {cat.label}
            </span>
          )}
        </div>

        <p
          className="serif"
          style={{ margin: 0, fontSize: 18, lineHeight: 1.5, color: "var(--fg)" }}
        >
          {ev.resumen}
        </p>

        <Section title="Por qué importa">
          <blockquote
            style={{
              margin: 0,
              padding: "14px 18px",
              borderLeft: `2px solid var(--p-${period.slug})`,
              background: "var(--bg-muted)",
              fontFamily: "var(--font-serif, var(--font-mono))",
              fontSize: 14.5,
              lineHeight: 1.55,
              color: "var(--fg)",
              fontStyle: "italic",
            }}
          >
            {ev.porQueImporta}
          </blockquote>
        </Section>

        <Section title="Atención del corpus">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 12 }}>
            <Metric label="Preguntas" value={ev.evidencia.nPreguntas} />
            <Metric label="Obras" value={ev.evidencia.nLibros} />
            <Metric label="Peso relativo" value={ev.evidencia.peso} suffix="/100" />
          </div>
          <div style={{ height: 4, background: "var(--bg-muted)", position: "relative" }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: `${ev.evidencia.peso}%`,
                background: `var(--p-${period.slug})`,
              }}
            />
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--fg-faint)", lineHeight: 1.5 }}>
            Calibrado contra las preguntas del corpus ancladas a {yearsLabel}: cuántas lo
            interrogan y desde cuántas obras distintas.
          </p>
        </Section>

        {ev.entidadesClave.length > 0 && (
          <Section title="Entidades clave">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ev.entidadesClave.map((e) => (
                <span
                  key={e}
                  className="mono"
                  style={{
                    padding: "4px 9px",
                    fontSize: 10.5,
                    border: "1px solid var(--line)",
                    color: "var(--fg)",
                    letterSpacing: "0.03em",
                  }}
                >
                  {e}
                </span>
              ))}
            </div>
          </Section>
        )}

        <Section title={`Preguntas del corpus (${ev.evidencia.nPreguntas})`}>
          {questions === null && (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-faint)", fontStyle: "italic" }}>
              Cargando preguntas…
            </p>
          )}
          {questions !== null && questions.length === 0 && (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-faint)", fontStyle: "italic" }}>
              Sin preguntas vinculadas.
            </p>
          )}
          {questions !== null && questions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {questions.map((q) => {
                const book =
                  q.document?.metadata?.bookTitle ?? q.document?.filename ?? "";
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/atelier?questionId=${encodeURIComponent(q.id)}&intent=${encodeURIComponent(q.pregunta)}`
                      )
                    }
                    title="Trabajar esta pregunta en el Taller"
                    style={{
                      appearance: "none",
                      background: "transparent",
                      border: 0,
                      borderBottom: "1px solid var(--line)",
                      padding: "12px 0",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "grid",
                      gridTemplateColumns: "44px 1fr",
                      gap: 12,
                      alignItems: "baseline",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-muted)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span
                      className="mono num"
                      style={{ fontSize: 11, color: `var(--p-${period.slug})`, fontWeight: 600 }}
                    >
                      {q.yearPrincipal != null
                        ? q.yearPrincipal < 0
                          ? `${-q.yearPrincipal}aC`
                          : q.yearPrincipal
                        : "—"}
                    </span>
                    <span>
                      <span
                        className="serif"
                        style={{
                          display: "block",
                          fontSize: 14,
                          lineHeight: 1.45,
                          color: "var(--fg)",
                        }}
                      >
                        {q.pregunta}
                      </span>
                      {book && (
                        <span
                          style={{
                            display: "block",
                            marginTop: 4,
                            fontSize: 11,
                            color: "var(--fg-faint)",
                          }}
                        >
                          {book}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        <div style={{ paddingTop: 12, borderTop: "1px solid var(--line)", marginTop: 4 }}>
          <h3
            className="mono"
            style={{
              margin: "0 0 12px",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--fg-faint)",
              fontWeight: 500,
            }}
          >
            Usar este evento en
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <ActionBtn
              label="El Taller"
              primary
              onClick={() => router.push(`/atelier?intent=${encodeURIComponent(tallerIntent)}`)}
            />
            <ActionBtn
              label="Archivo del período"
              onClick={() => router.push(`/questions?periodo=${periodoCode}`)}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--fg-faint)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div className="display num" style={{ fontSize: 24, color: "var(--fg)", lineHeight: 1 }}>
        {value.toLocaleString("es-CO")}
        {suffix && (
          <span style={{ fontSize: 13, color: "var(--fg-faint)" }}>{suffix}</span>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  primary,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: "none",
        background: primary ? "var(--fg)" : "transparent",
        color: primary ? "var(--bg)" : "var(--fg)",
        border: `1px solid ${primary ? "var(--fg)" : "var(--line-strong)"}`,
        padding: "9px 14px",
        fontSize: 12,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.04em",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 120ms var(--ease-out-custom)",
      }}
      onMouseEnter={(e) => {
        if (!primary) e.currentTarget.style.borderColor = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        if (!primary) e.currentTarget.style.borderColor = "var(--line-strong)";
      }}
    >
      {label} →
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3
        className="mono"
        style={{
          margin: "0 0 10px",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--fg-faint)",
          fontWeight: 500,
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}
