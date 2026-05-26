"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  PageHeader,
  PeriodTag,
  primaryBtn,
  linkBtn,
} from "@/components/editorial";
import { CHAT_TEMPLATES } from "@/lib/chat-templates";

type CellStatus = "PENDING" | "GENERATING" | "COMPLETE" | "ERROR" | null;

interface MatrixRow {
  id: string;
  pregunta: string;
  periodoCode: string;
  periodoNombre: string;
  categoriaCode: string;
  byTemplate: Record<string, { deliverableId: string; status: string } | null>;
  completedCount: number;
}

interface MatrixResp {
  rows: MatrixRow[];
  totalTemplates: number;
}

export default function MatrizPage() {
  return (
    <Suspense fallback={<div style={{ padding: 56 }} />}>
      <MatrizContent />
    </Suspense>
  );
}

function MatrizContent() {
  const router = useRouter();
  const params = useSearchParams();

  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQs, setSelectedQs] = useState<Set<string>>(new Set());
  const [selectedTpls, setSelectedTpls] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const p = new URLSearchParams();
    const documentId = params.get("documentId");
    if (documentId) p.set("documentId", documentId);
    fetch(`/api/questions/matrix?${p}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { rows: [], totalTemplates: 0 }))
      .then((data: MatrixResp) => setRows(data.rows ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [params]);

  const toGen = selectedQs.size * selectedTpls.size;

  const handleGenerate = async () => {
    if (toGen === 0) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/deliverables/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIds: Array.from(selectedQs),
          templateIds: Array.from(selectedTpls),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`${toGen} producciones encoladas para generación`);
      setSelectedQs(new Set());
      setSelectedTpls(new Set());
      setTimeout(() => {
        fetch("/api/questions/matrix")
          .then((r) => r.json())
          .then((data: MatrixResp) => setRows(data.rows ?? []));
      }, 1500);
    } catch (e) {
      console.error(e);
      toast.error("Error al iniciar generación");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fade-up" data-screen-label="QuestionsMatriz">
      <PageHeader
        label="Investigación · Matriz Q×T"
        title="Generación"
        italic="por lotes"
        subtitle="Selecciona preguntas (filas) y plantillas (columnas) para generar producciones en bloque. Cada celda llena ya tiene una producción asociada."
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section
        style={{
          padding: "18px 56px",
          maxWidth: 1320,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => router.push("/questions")}
            style={{ ...linkBtn, fontSize: 12 }}
          >
            ← Lista
          </button>
          <span style={{ color: "var(--fg-dim)" }}>·</span>
          <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            {rows.length} preguntas × {CHAT_TEMPLATES.length} plantillas
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {toGen > 0 && (
            <span
              className="mono"
              style={{
                fontSize: 11.5,
                color: "var(--accent)",
                letterSpacing: "0.04em",
              }}
            >
              {toGen} celdas seleccionadas
            </span>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={toGen === 0 || generating}
            style={
              toGen > 0 && !generating
                ? primaryBtn
                : { ...primaryBtn, opacity: 0.4, cursor: "default" }
            }
          >
            {generating ? "Encolando…" : `Generar ${toGen > 0 ? toGen + " celdas " : ""}→`}
          </button>
        </div>
      </section>

      <section
        style={{
          padding: "20px 56px 96px",
          maxWidth: 1320,
          overflowX: "auto",
        }}
      >
        <div style={{ minWidth: 1100, border: "1px solid var(--line)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `380px repeat(${CHAT_TEMPLATES.length}, 1fr)`,
              background: "var(--bg-subtle)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div style={{ padding: "14px 16px" }}>
              <div className="label">Pregunta</div>
            </div>
            {CHAT_TEMPLATES.map((t) => {
              const active = selectedTpls.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTpls((s) => {
                      const n = new Set(s);
                      if (n.has(t.id)) n.delete(t.id);
                      else n.add(t.id);
                      return n;
                    });
                  }}
                  style={{
                    appearance: "none",
                    background: active ? "var(--fg)" : "transparent",
                    color: active ? "var(--bg)" : "var(--fg-muted)",
                    border: 0,
                    borderLeft: "1px solid var(--line)",
                    padding: "14px 12px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{t.name}</div>
                  <div
                    className="mono"
                    style={{ fontSize: 10, opacity: 0.7, marginTop: 3 }}
                  >
                    ≈{t.maxTokens.toLocaleString()} tk
                  </div>
                </button>
              );
            })}
          </div>

          {loading && (
            <div style={{ padding: 32 }}>
              <div className="shimmer-line" style={{ height: 14, width: "50%" }} />
            </div>
          )}
          {!loading &&
            rows.map((q, qi) => {
              const active = selectedQs.has(q.id);
              return (
                <div
                  key={q.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `380px repeat(${CHAT_TEMPLATES.length}, 1fr)`,
                    borderBottom:
                      qi === rows.length - 1 ? 0 : "1px solid var(--line)",
                    background: active ? "var(--accent-soft)" : "transparent",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedQs((s) => {
                        const n = new Set(s);
                        if (n.has(q.id)) n.delete(q.id);
                        else n.add(q.id);
                        return n;
                      });
                    }}
                    style={{
                      appearance: "none",
                      background: "transparent",
                      border: 0,
                      padding: "14px 16px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "baseline",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          border: `1px solid ${active ? "var(--accent)" : "var(--line-strong)"}`,
                          background: active ? "var(--accent)" : "transparent",
                          display: "inline-block",
                          flexShrink: 0,
                          position: "relative",
                          top: 2,
                          color: "var(--bg)",
                          fontSize: 9,
                          textAlign: "center",
                          lineHeight: "10px",
                        }}
                      >
                        {active && "✓"}
                      </span>
                      <span
                        style={{ fontSize: 13, color: "var(--fg)", lineHeight: 1.35 }}
                      >
                        {q.pregunta}
                      </span>
                    </div>
                    <div style={{ marginLeft: 22 }}>
                      <PeriodTag code={q.periodoCode} size="sm" />
                    </div>
                  </button>
                  {CHAT_TEMPLATES.map((t) => {
                    const cell = q.byTemplate[t.id];
                    return (
                      <MatrixCell
                        key={t.id}
                        status={(cell?.status as CellStatus) ?? null}
                      />
                    );
                  })}
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}

function MatrixCell({ status }: { status: CellStatus }) {
  const config: Record<
    "complete" | "generating" | "pending" | "empty",
    { bg: string; glyph: string; color: string }
  > = {
    complete: { bg: "var(--bg-subtle)", glyph: "●", color: "var(--success)" },
    generating: { bg: "transparent", glyph: "◐", color: "var(--accent)" },
    pending: { bg: "transparent", glyph: "○", color: "var(--fg-faint)" },
    empty: { bg: "transparent", glyph: "·", color: "var(--fg-dim)" },
  };

  const key: keyof typeof config =
    status === "COMPLETE"
      ? "complete"
      : status === "GENERATING" || status === "PENDING"
        ? "generating"
        : status === "ERROR"
          ? "pending"
          : "empty";

  const c = config[key];

  return (
    <div
      style={{
        borderLeft: "1px solid var(--line)",
        background: c.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px 8px",
      }}
    >
      <span style={{ color: c.color, fontSize: 12, fontFamily: "var(--font-mono)" }}>
        {c.glyph}
      </span>
    </div>
  );
}
