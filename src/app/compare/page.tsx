"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Pill, primaryBtn } from "@/components/editorial";
import { Cita } from "@/components/editorial/cita";
import { CHAT_TEMPLATES } from "@/lib/chat-templates";

interface ChunkCitation {
  id: string;
  documentId: string;
  documentFilename?: string;
  pageNumber: number;
  similarity: number;
  content: string;
}

interface CompareResult {
  templateId: string;
  status: "idle" | "loading" | "complete" | "error";
  answer: string;
  citations: ChunkCitation[];
  error?: string;
}

const DEFAULT_TEMPLATES = ["mini-ensayo", "ensayo-largo", "paper-academico"];

export default function ComparePage() {
  const [question, setQuestion] = useState(
    "¿Cómo evolucionó el modelo bipartidista durante la Regeneración?",
  );
  const [activeTpls, setActiveTpls] = useState<string[]>(DEFAULT_TEMPLATES);
  const [results, setResults] = useState<Record<string, CompareResult>>({});
  const [running, setRunning] = useState(false);
  const pollersRef = useRef<Record<string, ReturnType<typeof setInterval> | null>>({});

  useEffect(() => {
    return () => {
      Object.values(pollersRef.current).forEach((p) => {
        if (p) clearInterval(p);
      });
    };
  }, []);

  const run = async () => {
    const q = question.trim();
    if (q.length < 10) {
      toast.warning("La consulta necesita al menos 10 caracteres.");
      return;
    }
    if (activeTpls.length === 0) {
      toast.warning("Selecciona al menos una plantilla.");
      return;
    }
    setRunning(true);
    const initial: Record<string, CompareResult> = {};
    activeTpls.forEach((t) => {
      initial[t] = { templateId: t, status: "loading", answer: "", citations: [] };
    });
    setResults(initial);
    Object.values(pollersRef.current).forEach((p) => {
      if (p) clearInterval(p);
    });

    await Promise.all(
      activeTpls.map(async (templateId) => {
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: q,
              topK: 100,
              similarityThreshold: 0.25,
              templateId,
            }),
          });
          if (!res.ok) {
            setResults((r) => ({
              ...r,
              [templateId]: {
                ...r[templateId],
                status: "error",
                error: "HTTP error",
              },
            }));
            return;
          }
          const data = await res.json();
          setResults((r) => ({
            ...r,
            [templateId]: {
              ...r[templateId],
              citations: data.chunks ?? [],
            },
          }));
          pollersRef.current[templateId] = setInterval(async () => {
            try {
              const poll = await fetch(`/api/chat/${data.id}`);
              if (!poll.ok) return;
              const pd = await poll.json();
              if (pd.status === "COMPLETE") {
                if (pollersRef.current[templateId]) {
                  clearInterval(pollersRef.current[templateId]!);
                  pollersRef.current[templateId] = null;
                }
                setResults((r) => ({
                  ...r,
                  [templateId]: {
                    ...r[templateId],
                    status: "complete",
                    answer: pd.answer,
                  },
                }));
              } else if (pd.status === "ERROR") {
                if (pollersRef.current[templateId]) {
                  clearInterval(pollersRef.current[templateId]!);
                  pollersRef.current[templateId] = null;
                }
                setResults((r) => ({
                  ...r,
                  [templateId]: {
                    ...r[templateId],
                    status: "error",
                    error: pd.answer || "Error",
                  },
                }));
              }
            } catch {
              /* retry */
            }
          }, 2000);
        } catch {
          setResults((r) => ({
            ...r,
            [templateId]: {
              ...r[templateId],
              status: "error",
              error: "Error de red",
            },
          }));
        }
      }),
    );

    const checkDone = setInterval(() => {
      const anyRunning = Object.values(pollersRef.current).some((p) => p);
      if (!anyRunning) {
        clearInterval(checkDone);
        setRunning(false);
      }
    }, 1000);
  };

  const phase = Object.keys(results).length === 0 ? "idle" : "running";

  return (
    <div className="fade-up" data-screen-label="Compare">
      <PageHeader
        label="Producción · Comparación de plantillas"
        title="Comparador"
        italic="lado a lado"
        subtitle="Lanza la misma consulta contra varias plantillas en paralelo. Cada columna usa un prompt distinto: mini-ensayo, ensayo extenso, paper académico, análisis comparado, etc."
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section style={{ padding: "32px 56px 0", maxWidth: 1320 }}>
        <div className="label" style={{ marginBottom: 14 }}>
          Consulta
        </div>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={1}
          style={{
            width: "100%",
            appearance: "none",
            background: "transparent",
            border: 0,
            borderBottom: "1px solid var(--line-strong)",
            outline: "none",
            resize: "vertical",
            fontFamily: "var(--font-display)",
            fontSize: 24,
            color: "var(--fg)",
            lineHeight: 1.35,
            padding: "10px 0",
            letterSpacing: "-0.005em",
          }}
        />

        <div style={{ marginTop: 20, marginBottom: 6 }}>
          <div className="label" style={{ marginBottom: 12 }}>
            Plantillas a comparar · {activeTpls.length}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CHAT_TEMPLATES.map((t) => {
              const on = activeTpls.includes(t.id);
              return (
                <Pill
                  key={t.id}
                  active={on}
                  onClick={() =>
                    setActiveTpls((s) =>
                      on ? s.filter((x) => x !== t.id) : [...s, t.id],
                    )
                  }
                >
                  {t.name}
                </Pill>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={run}
            disabled={
              question.trim().length < 10 || activeTpls.length === 0 || running
            }
            style={
              question.trim().length >= 10 && activeTpls.length > 0 && !running
                ? primaryBtn
                : { ...primaryBtn, opacity: 0.4, cursor: "default" }
            }
          >
            {running ? "Generando…" : "Comparar →"}
          </button>
        </div>
      </section>

      <section style={{ padding: "44px 56px 96px", maxWidth: 1640 }}>
        {phase === "idle" && (
          <div
            style={{
              padding: "120px 24px",
              textAlign: "center",
              color: "var(--fg-faint)",
              borderTop: "1px solid var(--line-strong)",
            }}
          >
            <div className="display" style={{ fontSize: 32 }}>
              Esperando consulta.
            </div>
            <div style={{ fontSize: 14, marginTop: 12 }}>
              Los resultados de cada plantilla aparecerán lado a lado.
            </div>
          </div>
        )}

        {phase !== "idle" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${activeTpls.length}, minmax(360px, 1fr))`,
              gap: 0,
              overflowX: "auto",
            }}
          >
            {activeTpls.map((tid, i) => {
              const tpl = CHAT_TEMPLATES.find((t) => t.id === tid);
              const r = results[tid];
              return (
                <div
                  key={tid}
                  style={{
                    padding: "0 24px 0 0",
                    paddingLeft: i === 0 ? 0 : 24,
                    borderLeft: i === 0 ? 0 : "1px solid var(--line)",
                    borderTop: "1px solid var(--line-strong)",
                    paddingTop: 24,
                  }}
                >
                  <div className="label" style={{ marginBottom: 6 }}>
                    {tpl?.name ?? tid}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      color: "var(--fg-faint)",
                      marginBottom: 18,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    ≈{tpl?.maxTokens.toLocaleString() ?? "—"} tk
                  </div>
                  {r?.status === "loading" && !r.answer && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--accent)",
                          animation: "caret-blink 1s infinite",
                        }}
                      />
                      <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>
                        Generando…
                      </span>
                    </div>
                  )}
                  {r?.status === "error" && (
                    <div
                      style={{
                        padding: "12px 16px",
                        border: "1px solid var(--danger)",
                        color: "var(--danger)",
                        fontSize: 13,
                      }}
                    >
                      {r.error ?? "Error"}
                    </div>
                  )}
                  {r?.answer && (
                    <div className="prose" style={{ fontSize: 15, maxWidth: "none" }}>
                      {r.answer.split("\n").map((line, j) =>
                        line.trim() === "" ? (
                          <div key={j} style={{ height: 4 }} />
                        ) : (
                          <p key={j} style={{ margin: "0 0 0.9em" }}>
                            {renderInline(line, r.citations)}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function renderInline(text: string, chunks: ChunkCitation[]) {
  const parts: React.ReactNode[] = [];
  let r = text;
  let k = 0;
  while (r.length) {
    const m = r.match(/^\[#?(\d+)\]/);
    const bMatch = r.match(/^\*\*([^*]+)\*\*/);
    const iMatch = r.match(/^\*([^*]+)\*/);
    if (m) {
      const n = parseInt(m[1], 10);
      const chunk = chunks[n - 1];
      parts.push(
        <Cita
          key={k++}
          n={n}
          page={chunk?.pageNumber}
          doc={chunk?.documentFilename?.replace(/\.pdf$/i, "")}
        />,
      );
      r = r.slice(m[0].length);
    } else if (bMatch) {
      parts.push(<strong key={k++}>{bMatch[1]}</strong>);
      r = r.slice(bMatch[0].length);
    } else if (iMatch) {
      parts.push(<em key={k++}>{iMatch[1]}</em>);
      r = r.slice(iMatch[0].length);
    } else {
      const nextC = r.search(/\[#?\d+\]/);
      const nextB = r.indexOf("**");
      const nextI = r.indexOf("*");
      const candidates = [nextC, nextB, nextI].filter((x) => x >= 0);
      const stop = candidates.length ? Math.min(...candidates) : r.length;
      const slice = r.slice(0, Math.max(stop, 1));
      parts.push(<Fragment key={k++}>{slice}</Fragment>);
      r = r.slice(slice.length);
    }
  }
  return parts;
}
