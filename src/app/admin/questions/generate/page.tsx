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
  { step: "calling_claude", label: "Generando preguntas" },
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

  // ─── Generación masiva ─────────────────────────────────────────────────
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [completedCount, setCompletedCount] = useState<number | null>(null);
  const [batchPhase, setBatchPhase] = useState<"idle" | "starting" | "running" | "error">("idle");
  const [batchMsg, setBatchMsg] = useState<string | null>(null);

  const refreshBatchStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/questions/generate-batch");
      if (!r.ok) return;
      const d = await r.json();
      setPendingCount(typeof d.pendingCount === "number" ? d.pendingCount : null);
      setCompletedCount(typeof d.completedCount === "number" ? d.completedCount : null);
    } catch {
      // silently
    }
  }, []);

  useEffect(() => {
    void refreshBatchStatus();
    // Re-encuesta cada 15s cuando el batch está corriendo, así el usuario ve
    // cómo baja el contador de pendientes sin recargar.
    if (batchPhase === "running") {
      const t = setInterval(refreshBatchStatus, 15_000);
      return () => clearInterval(t);
    }
  }, [refreshBatchStatus, batchPhase]);

  const handleBatchGenerate = async () => {
    if (batchPhase === "starting" || batchPhase === "running") return;
    setBatchPhase("starting");
    setBatchMsg(null);
    try {
      const r = await fetch("/api/questions/generate-batch", { method: "POST" });
      const d = await r.json();
      if (!r.ok) {
        setBatchPhase("error");
        setBatchMsg(d.error ?? `HTTP ${r.status}`);
        return;
      }
      setBatchPhase("running");
      setBatchMsg(d.message ?? "Generación iniciada en background");
    } catch (e) {
      setBatchPhase("error");
      setBatchMsg(e instanceof Error ? e.message : "Error desconocido");
    }
  };

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
          onClick={() => router.push("/admin/questions")}
          style={{ ...linkBtn, fontSize: 12 }}
        >
          ← Preguntas
        </button>
      </section>

      <PageHeader
        label="Investigación · Generación de preguntas"
        title="Generar"
        italic="preguntas guiadas"
        subtitle="A partir de un documento READY, se generan 18–32 preguntas guiadas con taxonomía completa (período, categoría, entidades, año principal)."
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      {/* ─── Generación masiva (batch) ──────────────────────────────────── */}
      <section style={{ padding: "32px 56px 24px", maxWidth: 1100 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 32,
            flexWrap: "wrap",
            padding: "20px 24px",
            border: "1px solid var(--line-strong)",
            background: "var(--bg-muted)",
          }}
        >
          <div style={{ minWidth: 260 }}>
            <div className="label" style={{ marginBottom: 6 }}>
              Generación masiva
            </div>
            <div className="serif" style={{ fontSize: 18, color: "var(--fg)", lineHeight: 1.3, margin: "4px 0 6px" }}>
              {pendingCount === null
                ? "Calculando…"
                : pendingCount === 0
                  ? "Todos los libros READY ya tienen preguntas."
                  : `${pendingCount} libro${pendingCount === 1 ? "" : "s"} sin preguntas`}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
              {completedCount !== null && (
                <>
                  {completedCount} ya generados ·{" "}
                </>
              )}
              {pendingCount && pendingCount > 60
                ? `procesa hasta 60 por corrida; vuelve a disparar para los ${pendingCount - 60} restantes.`
                : "Procesa todos los pendientes en background (concurrencia 2)."}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <button
              type="button"
              onClick={handleBatchGenerate}
              disabled={batchPhase === "starting" || batchPhase === "running" || !pendingCount}
              style={
                pendingCount && batchPhase === "idle"
                  ? primaryBtn
                  : { ...primaryBtn, opacity: 0.4, cursor: "default" }
              }
            >
              {batchPhase === "idle" && pendingCount ? `Generar para ${Math.min(pendingCount, 60)} libros →` : null}
              {batchPhase === "idle" && !pendingCount ? "Nada pendiente" : null}
              {batchPhase === "starting" && "Iniciando…"}
              {batchPhase === "running" && "Procesando en background…"}
              {batchPhase === "error" && "Reintentar"}
            </button>
            {batchPhase === "running" && (
              <button
                type="button"
                onClick={refreshBatchStatus}
                style={{ ...linkBtn, fontSize: 11 }}
              >
                Refrescar contador
              </button>
            )}
          </div>
        </div>
        {batchMsg && batchPhase !== "error" && (
          <div
            className="fade-in"
            style={{
              marginTop: 10,
              fontSize: 12.5,
              color: "var(--fg-muted)",
              fontStyle: "italic",
            }}
          >
            {batchMsg}. El procesamiento continúa aunque cierres esta página. Refresca{" "}
            <button
              type="button"
              onClick={() => router.push("/admin/questions")}
              style={{ ...linkBtn, fontSize: 12.5, padding: 0 }}
            >
              /questions
            </button>{" "}
            para ver las preguntas a medida que se generan.
          </div>
        )}
        {batchPhase === "error" && batchMsg && (
          <div
            className="fade-in"
            style={{ marginTop: 10, fontSize: 13, color: "var(--danger)" }}
            role="alert"
          >
            {batchMsg}
          </div>
        )}
      </section>

      <section
        style={{
          padding: "12px 56px 24px",
          maxWidth: 1100,
        }}
      >
        <div className="label" style={{ color: "var(--fg-muted)" }}>
          ó generar uno por uno
        </div>
      </section>

      <section
        style={{
          padding: "12px 56px 96px",
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
                  onClick={() => router.push("/admin/questions")}
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
