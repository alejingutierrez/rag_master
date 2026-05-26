"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PageHeader,
  primaryBtn,
  linkBtn,
} from "@/components/editorial";

interface DocItem {
  id: string;
  filename: string;
  metadata?: Record<string, unknown>;
  status: string;
  _count: { chunks: number; questions?: number };
}

const STEPS_DEF: { step: string; label: string }[] = [
  { step: "fetching_chunks", label: "Obteniendo fragmentos del documento" },
  { step: "selecting_chunks", label: "Preparando contexto completo" },
  { step: "calling_claude", label: "Llamando a Claude Opus 4.7" },
  { step: "parsing", label: "Procesando preguntas" },
  { step: "saving", label: "Guardando con taxonomía" },
];

function computeTargetCount(chunkCount: number): number {
  if (chunkCount <= 200) return 18;
  if (chunkCount <= 500) return 24;
  if (chunkCount <= 1000) return 28;
  return 32;
}

function getDocTitle(doc: DocItem): string {
  const meta = doc.metadata;
  if (meta && typeof meta === "object") {
    const t = (meta as Record<string, unknown>).bookTitle;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return doc.filename.replace(/\.pdf$/i, "");
}

function getDocAuthor(doc: DocItem): string | null {
  const meta = doc.metadata;
  if (meta && typeof meta === "object") {
    const a = (meta as Record<string, unknown>).author;
    if (typeof a === "string" && a.trim()) return a.trim();
  }
  return null;
}

export default function GenerateQuestionsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 56 }} />}>
      <GenerateContent />
    </Suspense>
  );
}

function GenerateContent() {
  const router = useRouter();
  const params = useSearchParams();
  const initialDocId = params.get("documentId") ?? "";

  const [docs, setDocs] = useState<DocItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>(initialDocId);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [currentStep, setCurrentStep] = useState(-1);
  const [generated, setGenerated] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/documents?limit=300&status=READY");
      const d = await r.json();
      const list: DocItem[] = d.documents ?? [];
      setDocs(list);
      if (!selectedDoc && list.length > 0) {
        setSelectedDoc(list[0].id);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const selected = docs.find((d) => d.id === selectedDoc);
  const projectedN = selected ? computeTargetCount(selected._count.chunks) : 0;

  const handleGenerate = async () => {
    if (!selectedDoc) return;
    setPhase("running");
    setCurrentStep(0);
    setGenerated(0);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/documents/${selectedDoc}/questions/generate`, {
        method: "POST",
      });
      if (!res.body) throw new Error("Sin stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "progress") {
              const stepIdx = STEPS_DEF.findIndex((s) => s.step === ev.step);
              if (stepIdx >= 0) setCurrentStep(stepIdx);
            }
            if (ev.type === "question") {
              setGenerated((g) => g + 1);
              // Asegurar que estamos pasados la fase de "parsing".
              setCurrentStep((s) => Math.max(s, 3));
            }
            if (ev.type === "complete") {
              setCurrentStep(STEPS_DEF.length);
              setPhase("done");
            }
            if (ev.type === "error") {
              setErrorMsg(ev.message);
              setPhase("error");
            }
          } catch {
            /* skip malformed */
          }
        }
      }
      if (phase === "running") {
        setCurrentStep(STEPS_DEF.length);
        setPhase("done");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error desconocido");
      setPhase("error");
    }
  };

  return (
    <div className="fade-up" data-screen-label="QuestionsGenerate">
      <section style={{ padding: "32px 56px 12px", maxWidth: 1320 }}>
        <button
          type="button"
          onClick={() => router.push("/questions")}
          style={{ ...linkBtn, fontSize: 12 }}
        >
          ← Preguntas
        </button>
      </section>

      <PageHeader
        label="Investigación · Generación de preguntas"
        title="Generar"
        italic="preguntas guiadas"
        subtitle="A partir de un documento READY, Claude Opus 4.7 genera 18–32 preguntas guiadas con taxonomía completa (período, categoría, entidades, año principal)."
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section
        style={{
          padding: "44px 56px 96px",
          maxWidth: 1100,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 64,
        }}
      >
        <div>
          <div className="label" style={{ marginBottom: 14 }}>
            Documento de origen · {docs.length}
          </div>
          {loading && (
            <div className="shimmer-line" style={{ height: 14, width: "60%" }} />
          )}
          <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 480, overflowY: "auto" }}>
            {docs.slice(0, 12).map((d, i) => {
              const active = d.id === selectedDoc;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedDoc(d.id)}
                    disabled={phase === "running"}
                    style={{
                      width: "100%",
                      appearance: "none",
                      background: active ? "var(--bg-muted)" : "transparent",
                      border: 0,
                      borderTop: i === 0 ? "1px solid var(--line)" : 0,
                      borderBottom: "1px solid var(--line)",
                      padding: "14px 12px",
                      cursor: phase === "running" ? "default" : "pointer",
                      textAlign: "left",
                      position: "relative",
                    }}
                  >
                    {active && (
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          background: "var(--accent)",
                        }}
                      />
                    )}
                    <div className="serif" style={{ fontSize: 15, color: "var(--fg)", lineHeight: 1.3 }}>
                      {getDocTitle(d)}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 4 }}>
                      {getDocAuthor(d) ?? "Sin autor"} ·{" "}
                      {d._count.chunks.toLocaleString("es-CO")} fragmentos
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div style={{ marginTop: 28 }}>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!selectedDoc || phase === "running"}
              style={
                phase === "idle" && selectedDoc
                  ? primaryBtn
                  : { ...primaryBtn, opacity: 0.4, cursor: "default" }
              }
            >
              {phase === "idle" && "Generar preguntas →"}
              {phase === "running" && "Generando…"}
              {phase === "done" && "Listo ✓"}
              {phase === "error" && "Reintentar"}
            </button>
          </div>
        </div>

        <div>
          <div className="label" style={{ marginBottom: 14 }}>
            Proceso
          </div>

          {phase === "idle" && (
            <div style={{ padding: "32px 0", color: "var(--fg-muted)", fontSize: 14, lineHeight: 1.6 }}>
              <p style={{ margin: 0 }}>Doc seleccionado:</p>
              {selected ? (
                <p
                  className="serif"
                  style={{ fontSize: 16, color: "var(--fg)", margin: "8px 0 18px" }}
                >
                  {getDocTitle(selected)}
                </p>
              ) : (
                <p style={{ margin: "8px 0 18px" }}>Selecciona un documento.</p>
              )}
              {selected && (
                <p style={{ margin: 0 }}>
                  El proceso lee los{" "}
                  {selected._count.chunks.toLocaleString("es-CO")} fragmentos y produce ≈{" "}
                  {projectedN} preguntas con taxonomía histórica.
                </p>
              )}
            </div>
          )}

          {phase !== "idle" && (
            <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {STEPS_DEF.map((s, i) => {
                const done = i < currentStep;
                const active = i === currentStep;
                return (
                  <li
                    key={s.step}
                    style={{
                      padding: "16px 0",
                      borderTop: "1px solid var(--line)",
                      display: "flex",
                      gap: 14,
                      alignItems: "baseline",
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        width: 20,
                        fontSize: 12,
                        color: done
                          ? "var(--success)"
                          : active
                            ? "var(--accent)"
                            : "var(--fg-faint)",
                      }}
                    >
                      {done ? "✓" : active ? "◐" : "○"}
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        color: done || active ? "var(--fg)" : "var(--fg-muted)",
                      }}
                    >
                      {s.label}
                      {active && phase === "running" && <span className="caret" />}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {phase === "done" && (
            <div
              className="fade-in"
              style={{
                marginTop: 24,
                padding: "16px 0",
                borderTop: "1px solid var(--line-strong)",
              }}
            >
              <div className="display num" style={{ fontSize: 48, color: "var(--fg)", lineHeight: 1 }}>
                {generated}
              </div>
              <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 8 }}>
                preguntas generadas
              </div>
              <div style={{ marginTop: 18 }}>
                <button
                  type="button"
                  style={primaryBtn}
                  onClick={() => router.push("/questions")}
                >
                  Ver preguntas →
                </button>
              </div>
            </div>
          )}

          {phase === "error" && errorMsg && (
            <div
              style={{
                marginTop: 24,
                padding: "16px 0",
                borderTop: "1px solid var(--danger)",
                color: "var(--danger)",
                fontSize: 13,
              }}
              role="alert"
            >
              {errorMsg}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
