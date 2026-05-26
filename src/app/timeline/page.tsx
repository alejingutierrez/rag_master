"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SectionHeader, primaryBtn } from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";

interface TimelineData {
  questions: Array<{
    periodoCode: string;
    periodoNombre: string;
    periodoRango: string;
    count: number;
  }>;
  docsByPeriod: Array<{ code: string; count: number }>;
  deliverablesByPeriod: Array<{ code: string; count: number }>;
}

interface PeriodEvent {
  y: number | string;
  t: string;
  note: string;
}

// Eventos pivote por período — datos historiográficos (no hay API aún).
// TODO: extraer a /api/timeline/events cuando exista la tabla.
const EVENTS: Partial<Record<PeriodCode, PeriodEvent[]>> = {
  CON: [
    { y: 1499, t: "Llegada a costas continentales", note: "Alonso de Ojeda recorre la costa de la Guajira." },
    { y: 1525, t: "Fundación de Santa Marta", note: "Rodrigo de Bastidas establece la primera ciudad." },
    { y: 1538, t: "Fundación de Santafé de Bogotá", note: "Gonzalo Jiménez de Quesada en el altiplano muisca." },
  ],
  IND: [
    { y: 1810, t: "Grito de Independencia", note: "20 de julio en Santafé de Bogotá." },
    { y: 1816, t: "Reconquista española", note: "Régimen del Terror bajo Morillo y Sámano." },
    { y: 1819, t: "Boyacá", note: "Batalla decisiva; consolida la Gran Colombia." },
    { y: 1830, t: "Muerte de Bolívar", note: "Disolución de la Gran Colombia." },
  ],
  REG: [
    { y: 1886, t: "Constitución de Núñez", note: "Centralización política y restauración del rol social de la Iglesia." },
    { y: 1887, t: "Concordato con la Santa Sede", note: "Devuelve a la Iglesia el control de la educación pública." },
    { y: 1899, t: "Guerra de los Mil Días", note: "Conflicto bipartidista, devastador para el país." },
    { y: 1903, t: "Separación de Panamá", note: "Pérdida territorial en el contexto del canal interoceánico." },
    { y: 1910, t: "Reforma constitucional", note: "Limita la reelección presidencial." },
    { y: 1928, t: "Masacre de las bananeras", note: "Conflicto laboral; uno de los hitos del fin de la Hegemonía." },
  ],
  REP_LIB: [
    { y: 1934, t: "Primer gobierno de López Pumarejo", note: "Inicio de la 'Revolución en marcha'." },
    { y: 1936, t: "Reforma constitucional", note: "Función social de la propiedad." },
    { y: 1936, t: "Ley 200 de tierras", note: "Reconoce derechos sin expropiar." },
  ],
  VIO: [
    { y: 1946, t: "Triunfo conservador", note: "Ospina Pérez asume; tensión bipartidista en ascenso." },
    { y: 1948, t: "Bogotazo", note: "Asesinato de Jorge Eliécer Gaitán; estallido urbano." },
    { y: 1953, t: "Dictadura de Rojas Pinilla", note: "Único golpe militar del siglo XX colombiano." },
    { y: 1957, t: "Plebiscito y Frente Nacional", note: "Pacto bipartidista que cierra el ciclo de La Violencia." },
  ],
  C91: [
    { y: 1991, t: "Asamblea Constituyente", note: "Nueva Constitución; tutela y derechos fundamentales." },
    { y: 1993, t: "Muerte de Pablo Escobar", note: "Cierre simbólico del Cartel de Medellín." },
  ],
  POS: [{ y: 2016, t: "Acuerdo de paz con las FARC", note: "Firma del acuerdo en La Habana / Bogotá." }],
};

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

  const counts = useMemo(() => {
    const docs = new Map(data?.docsByPeriod.map((d) => [d.code, d.count]) ?? []);
    const qs = new Map(data?.questions.map((q) => [q.periodoCode, q.count]) ?? []);
    const prods = new Map(
      data?.deliverablesByPeriod.map((d) => [d.code, d.count]) ?? [],
    );
    return { docs, qs, prods };
  }, [data]);

  const period = PERIODS[selected];
  const events: PeriodEvent[] =
    EVENTS[selected] ?? [
      {
        y: period.yearRange,
        t: period.label,
        note: "Eventos disponibles próximamente. Esta sección se enriquecerá con hitos historiográficos.",
      },
    ];

  const start = 1499;
  const end = 2026;
  const span = end - start;

  const docCount = counts.docs.get(selected) ?? 0;
  const qCount = counts.qs.get(selected) ?? 0;
  const prodCount = counts.prods.get(selected) ?? 0;
  const fragmentCount = docCount * 142;

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
        <div className="label" style={{ marginBottom: 22 }}>
          Períodos canónicos · seleccione uno
        </div>

        <div style={{ position: "relative", paddingTop: 20, paddingBottom: 40 }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 20,
              height: 1,
              background: "var(--line-strong)",
            }}
          />

          {[1500, 1600, 1700, 1800, 1900, 2000].map((y) => {
            const pct = ((y - start) / span) * 100;
            return (
              <Fragment key={y}>
                <div
                  style={{
                    position: "absolute",
                    left: `${pct}%`,
                    top: 14,
                    width: 1,
                    height: 12,
                    background: "var(--fg-faint)",
                  }}
                />
                <div
                  className="mono"
                  style={{
                    position: "absolute",
                    left: `${pct}%`,
                    top: 0,
                    transform: "translateX(-50%)",
                    fontSize: 10,
                    color: "var(--fg-subtle)",
                  }}
                >
                  {y}
                </div>
              </Fragment>
            );
          })}

          {ORDER.map((code, i) => {
            const p = PERIODS[code];
            const [a, b] = YEAR_BOUNDS[code];
            const left = ((a - start) / span) * 100;
            const width = ((b - a) / span) * 100;
            const active = code === selected;
            const n = String(i + 1).padStart(2, "0");
            return (
              <button
                key={code}
                type="button"
                onClick={() => setSelected(code)}
                title={`${p.label} · ${p.yearRange}`}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  top: 26,
                  width: `${width}%`,
                  height: active ? 28 : 8,
                  background: active ? `var(--p-${p.slug})` : "var(--bg-muted)",
                  border: 0,
                  cursor: "pointer",
                  padding: 0,
                  transition: "all 200ms var(--ease-out-custom)",
                  outline: "1px solid var(--bg)",
                }}
              >
                {active && (
                  <span
                    className="mono"
                    style={{
                      position: "absolute",
                      left: 6,
                      top: 0,
                      lineHeight: "28px",
                      fontSize: 10,
                      color: "var(--bg)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {n} · {p.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {ORDER.map((code) => {
            const p = PERIODS[code];
            const active = code === selected;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setSelected(code)}
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
            onClick={() => router.push(`/questions?periodo=${selected}`)}
            style={{ ...primaryBtn, width: "100%" }}
          >
            Consultar este período →
          </button>
        </aside>

        <div>
          <SectionHeader
            index="◷"
            title="Eventos pivote"
            caption="Hitos historiográficos del período"
          />

          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {events.map((e, i) => (
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
        </div>
      </section>
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
