"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PeriodTag } from "@/components/editorial";
import {
  TIPO_LABELS,
  ESCALA_LABELS,
  type TipoPregunta,
  type EscalaGeografica,
} from "@/lib/questions-config";

export interface QuestionDetail {
  id: string;
  questionNumber: number;
  pregunta: string;
  periodoCode: string;
  periodoNombre: string;
  periodoRango: string;
  categoriaCode: string;
  categoriaNombre: string;
  subcategoriaCode: string;
  subcategoriaNombre: string;
  periodosRelacionados?: string[];
  categoriasRelacionadas?: string[];
  yearPrincipal?: number | null;
  yearsSecondary?: number[];
  entidadesPersonas?: string[];
  entidadesLugares?: string[];
  entidadesConceptos?: string[];
  tipoPregunta?: string | null;
  clusterTematico?: string | null;
  hipotesisImplicita?: string | null;
  escalaGeografica?: string | null;
  justificacion?: string;
  deliverables?: Array<{ id: string; templateId: string; status: string }>;
  document?: { id: string; filename: string };
}

export function QuestionDetailDrawer({
  question,
  onClose,
  onSelectCluster,
}: {
  question: QuestionDetail | null;
  onClose: () => void;
  onSelectCluster?: (cluster: string) => void;
}) {
  const router = useRouter();
  const open = question !== null;

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
          width: "min(560px, 92vw)",
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
        {question && <DrawerContent q={question} onClose={onClose} onSelectCluster={onSelectCluster} router={router} />}
      </aside>
    </>
  );
}

function DrawerContent({
  q,
  onClose,
  onSelectCluster,
  router,
}: {
  q: QuestionDetail;
  onClose: () => void;
  onSelectCluster?: (cluster: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const tipoLabel = q.tipoPregunta
    ? TIPO_LABELS[q.tipoPregunta as TipoPregunta] ?? q.tipoPregunta
    : null;
  const escalaLabel = q.escalaGeografica
    ? ESCALA_LABELS[q.escalaGeografica as EscalaGeografica] ?? q.escalaGeografica
    : null;
  const totalDeliv = q.deliverables?.length ?? 0;
  const completeDeliv = (q.deliverables ?? []).filter((d) => d.status === "COMPLETE").length;

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
          PREGUNTA · #{String(q.questionNumber).padStart(3, "0")}
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
        <p
          className="serif"
          style={{
            margin: 0,
            fontSize: 22,
            lineHeight: 1.4,
            color: "var(--fg)",
            letterSpacing: "-0.005em",
          }}
        >
          {q.pregunta}
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tipoLabel && <Badge tone="solid">{tipoLabel}</Badge>}
          {escalaLabel && <Badge tone="outline">{escalaLabel}</Badge>}
          <PeriodTag code={q.periodoCode} size="md" showName />
        </div>

        {q.hipotesisImplicita && (
          <Section title="Hipótesis implícita">
            <blockquote
              style={{
                margin: 0,
                padding: "14px 18px",
                borderLeft: "2px solid var(--fg)",
                background: "var(--bg-muted)",
                fontFamily: "var(--font-serif, var(--font-mono))",
                fontSize: 14.5,
                lineHeight: 1.55,
                color: "var(--fg)",
                fontStyle: "italic",
              }}
            >
              {q.hipotesisImplicita}
            </blockquote>
          </Section>
        )}

        {q.clusterTematico && (
          <Section title="Cluster temático">
            <button
              type="button"
              onClick={() => onSelectCluster?.(q.clusterTematico!)}
              style={{
                appearance: "none",
                background: "transparent",
                border: 0,
                padding: 0,
                cursor: onSelectCluster ? "pointer" : "default",
                color: "var(--fg)",
                fontSize: 14,
                textAlign: "left",
                textDecoration: onSelectCluster ? "underline" : "none",
                textDecorationStyle: "dotted" as const,
                textUnderlineOffset: 4,
              }}
              title={onSelectCluster ? "Ver preguntas hermanas" : undefined}
            >
              {q.clusterTematico}
            </button>
          </Section>
        )}

        <Section title="Anclaje temporal">
          <YearLine principal={q.yearPrincipal ?? null} secondary={q.yearsSecondary ?? []} />
        </Section>

        <Section title="Categoría">
          <div style={{ fontSize: 13.5, color: "var(--fg)" }}>
            {q.categoriaNombre}{" "}
            <span style={{ color: "var(--fg-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
              · {q.categoriaCode}
            </span>
          </div>
          {q.subcategoriaNombre && (
            <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 4 }}>
              {q.subcategoriaNombre}{" "}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-faint)" }}>
                {q.subcategoriaCode}
              </span>
            </div>
          )}
        </Section>

        <Section title="Entidades">
          <EntityGroup label="Personas" items={q.entidadesPersonas ?? []} />
          <EntityGroup label="Lugares" items={q.entidadesLugares ?? []} />
          <EntityGroup label="Conceptos" items={q.entidadesConceptos ?? []} />
        </Section>

        {((q.periodosRelacionados?.length ?? 0) > 0 || (q.categoriasRelacionadas?.length ?? 0) > 0) && (
          <Section title="Relaciones">
            {(q.periodosRelacionados?.length ?? 0) > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {q.periodosRelacionados!.map((p) => (
                  <PeriodTag key={p} code={p} size="sm" />
                ))}
              </div>
            )}
            {(q.categoriasRelacionadas?.length ?? 0) > 0 && (
              <div
                className="mono"
                style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 10.5, color: "var(--fg-muted)" }}
              >
                {q.categoriasRelacionadas!.map((c) => (
                  <span key={c} style={{ letterSpacing: "0.04em" }}>{c}</span>
                ))}
              </div>
            )}
          </Section>
        )}

        {q.justificacion && (
          <Section title="Justificación">
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--fg-muted)" }}>
              {q.justificacion}
            </p>
          </Section>
        )}

        <Section title="Producciones">
          {totalDeliv === 0 ? (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-faint)", fontStyle: "italic" }}>
              Sin producciones aún. Esta pregunta espera ser trabajada.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
                {completeDeliv}/{totalDeliv} completas
              </div>
              {q.deliverables!.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--line)",
                    fontSize: 12.5,
                  }}
                >
                  <span>{d.templateId}</span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      color: d.status === "COMPLETE" ? "var(--fg)" : "var(--fg-muted)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {q.document && (
          <Section title="Fuente">
            <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{q.document.filename}</div>
          </Section>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            paddingTop: 8,
            borderTop: "1px solid var(--line)",
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={() => router.push(`/chat?questionId=${encodeURIComponent(q.id)}`)}
            style={{
              appearance: "none",
              background: "var(--fg)",
              color: "var(--bg)",
              border: "1px solid var(--fg)",
              padding: "9px 16px",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em",
              cursor: "pointer",
              flex: 1,
            }}
            title="Abre la pregunta en el chat con todo su contexto (período, categoría, tipo, escala, entidades, hipótesis) para que el LLM responda con esa información."
          >
            ABRIR EN CHAT →
          </button>
        </div>
      </div>
    </>
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

function Badge({ tone, children }: { tone: "solid" | "outline"; children: React.ReactNode }) {
  const solid = tone === "solid";
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 9px",
        fontSize: 10.5,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        background: solid ? "var(--fg)" : "transparent",
        color: solid ? "var(--bg)" : "var(--fg)",
        border: "1px solid var(--fg)",
        borderRadius: 4,
      }}
    >
      {children}
    </span>
  );
}

function EntityGroup({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        className="mono"
        style={{
          fontSize: 10,
          color: "var(--fg-faint)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label} · {items.length}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {items.map((it) => (
          <span
            key={it}
            style={{
              fontSize: 12,
              color: "var(--fg)",
              background: "var(--bg-muted)",
              padding: "3px 8px",
              borderRadius: 3,
              border: "1px solid var(--line)",
            }}
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function YearLine({ principal, secondary }: { principal: number | null; secondary: number[] }) {
  if (principal == null && secondary.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 12, color: "var(--fg-faint)", fontStyle: "italic" }}>
        Sin anclaje temporal asignado.
      </p>
    );
  }
  // Combinamos años para crear una mini-timeline visual ordenada.
  const all = [...new Set([...(principal != null ? [principal] : []), ...secondary])].sort(
    (a, b) => a - b
  );
  const min = all[0];
  const max = all[all.length - 1];
  const span = Math.max(1, max - min);
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--fg-muted)",
        }}
      >
        {principal != null && (
          <span style={{ color: "var(--fg)", fontSize: 14, fontWeight: 500 }}>
            {principal}
          </span>
        )}
        {secondary.length > 0 && (
          <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
            + {secondary.slice().sort((a, b) => a - b).join(" · ")}
          </span>
        )}
      </div>
      {all.length > 1 && (
        <div style={{ position: "relative", height: 22, marginTop: 10 }}>
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 0,
              right: 0,
              height: 1,
              background: "var(--line-strong)",
            }}
          />
          {all.map((y) => {
            const pct = ((y - min) / span) * 100;
            const isPrincipal = y === principal;
            return (
              <span
                key={y}
                title={String(y)}
                style={{
                  position: "absolute",
                  top: isPrincipal ? 5 : 7,
                  left: `${pct}%`,
                  width: isPrincipal ? 10 : 6,
                  height: isPrincipal ? 10 : 6,
                  borderRadius: "50%",
                  background: isPrincipal ? "var(--fg)" : "var(--fg-muted)",
                  transform: "translateX(-50%)",
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
