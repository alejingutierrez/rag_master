"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PeriodTag } from "@/components/editorial";
import { CATEGORIES, type CategoryCode, type PeriodCode, PERIODS } from "@/lib/design-tokens";
import type { TimelineLinkPiece, PeriodTimelineLinks } from "@/lib/public-data";
import { fmtYearSpan, type TimelineEventData } from "./TimelineEventDrawer";

/**
 * Casa un evento con un hecho publicado. El hecho pertenece al evento si su AÑO
 * PRINCIPAL cae dentro del tramo del evento (±1), no por mero solape de un rango
 * largo — así un hecho de 1887 no se cuela como "el hecho" de un evento de
 * 1899–1902 solo por compartir período. Sin match cercano → null (sin enlace).
 */
function matchHecho(ev: TimelineEventData, hechos: TimelineLinkPiece[]): TimelineLinkPiece | null {
  const s = ev.anioInicio;
  const e = ev.anioFin;
  const inSpan = hechos.filter((h) => h.anio != null && h.anio >= s - 1 && h.anio <= e + 1);
  if (inSpan.length === 0) return null;
  const mid = (s + e) / 2;
  inSpan.sort((a, b) => Math.abs((a.anio ?? mid) - mid) - Math.abs((b.anio ?? mid) - mid));
  return inSpan[0];
}

/**
 * Drawer PÚBLICO del evento. Reusa el lenguaje visual del drawer del admin
 * (hero, "por qué importa", relevancia, entidades) pero su pie enlaza a la wiki
 * pública (el hecho publicado que lo cuenta, la época) — no al Taller ni al admin.
 */
export function PublicTimelineEventDrawer({
  event,
  periodoCode,
  links,
  entityHrefs,
  onClose,
}: {
  event: TimelineEventData | null;
  periodoCode: PeriodCode;
  links?: PeriodTimelineLinks;
  entityHrefs?: Record<string, string>;
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
        {event && (
          <DrawerContent
            key={event.id}
            ev={event}
            periodoCode={periodoCode}
            links={links}
            entityHrefs={entityHrefs}
            onClose={onClose}
          />
        )}
      </aside>
    </>
  );
}

function DrawerContent({
  ev,
  periodoCode,
  links,
  entityHrefs,
  onClose,
}: {
  ev: TimelineEventData;
  periodoCode: PeriodCode;
  links?: PeriodTimelineLinks;
  entityHrefs?: Record<string, string>;
  onClose: () => void;
}) {
  const period = PERIODS[periodoCode];
  const cat = CATEGORIES[ev.categoria as CategoryCode];
  const yearsLabel = fmtYearSpan(ev.anioInicio, ev.anioFin);
  const hecho = links ? matchHecho(ev, links.hechos) : null;
  const epoca = links?.epoca ?? null;

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
          <h2 className="display" style={{ fontSize: 32, margin: 0, color: "var(--fg)", lineHeight: 1.1 }}>
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

        <p className="serif" style={{ margin: 0, fontSize: 18, lineHeight: 1.5, color: "var(--fg)" }}>
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

        <Section title="Relevancia en el corpus">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 12 }}>
            <Metric label="Preguntas" value={ev.evidencia.nPreguntas} />
            <Metric label="Obras" value={ev.evidencia.nLibros} />
            <Metric label="Peso" value={ev.evidencia.peso} suffix="/100" />
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
            Calibrado por cuánto interroga el corpus este momento: número de preguntas y de obras
            distintas ancladas a {yearsLabel}.
          </p>
        </Section>

        {ev.entidadesClave.length > 0 && (
          <Section title="Entidades clave">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ev.entidadesClave.map((e) => {
                const href = entityHrefs?.[e];
                const chipStyle: React.CSSProperties = {
                  padding: "4px 9px",
                  fontSize: 10.5,
                  border: `1px solid ${href ? "var(--line-strong)" : "var(--line)"}`,
                  color: "var(--fg)",
                  letterSpacing: "0.03em",
                  textDecoration: "none",
                };
                // Las entidades publicadas se enlazan a su página (wiki); las demás
                // quedan como texto — así el drawer siempre ofrece a dónde seguir.
                return href ? (
                  <Link key={e} href={href} className="mono" style={chipStyle}>
                    {e}
                  </Link>
                ) : (
                  <span key={e} className="mono" style={chipStyle}>
                    {e}
                  </span>
                );
              })}
            </div>
          </Section>
        )}

        {(hecho || epoca) && (
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
              Seguir leyendo
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {hecho && <FollowLink href={hecho.href} kicker="El hecho" label={hecho.titulo} primary />}
              {epoca && <FollowLink href={epoca.href} kicker="La época" label={epoca.titulo} />}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function FollowLink({
  href,
  kicker,
  label,
  primary,
}: {
  href: string;
  kicker: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        textDecoration: "none",
        border: `1px solid ${primary ? "var(--fg)" : "var(--line-strong)"}`,
        padding: "11px 14px",
        transition: "border-color 120ms var(--ease-out-custom)",
      }}
    >
      <span
        className="mono"
        style={{
          display: "block",
          fontSize: 9.5,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--fg-faint)",
          marginBottom: 4,
        }}
      >
        {kicker} →
      </span>
      <span className="serif" style={{ fontSize: 15, color: "var(--fg)", lineHeight: 1.3 }}>
        {label}
      </span>
    </Link>
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
        {suffix && <span style={{ fontSize: 13, color: "var(--fg-faint)" }}>{suffix}</span>}
      </div>
    </div>
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
