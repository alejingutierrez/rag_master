"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader, PeriodTag, linkBtn } from "@/components/editorial";
import { ATELIER_FORMAT_LIST } from "@/lib/atelier-formats";

type CellStatus = "PENDING" | "GENERATING" | "COMPLETE" | "ERROR" | null;

interface Cell {
  deliverableId: string;
  status: string;
}

interface MatrixRow {
  id: string;
  pregunta: string;
  periodoCode: string;
  periodoNombre: string;
  categoriaCode: string;
  byFormat: Record<string, Cell | null>;
  completedCount: number;
}

interface MatrixResp {
  rows: MatrixRow[];
  totalFormats: number;
}

const FORMATS = ATELIER_FORMAT_LIST;

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
  // Celdas disparadas localmente (qid::formatId) para feedback inmediato antes
  // de que el polling confirme el estado GENERATING desde la BD.
  const [pending, setPending] = useState<Set<string>>(new Set());
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const documentId = params.get("documentId");

  const fetchMatrix = useCallback(
    async (signal?: AbortSignal) => {
      const p = new URLSearchParams();
      if (documentId) p.set("documentId", documentId);
      const r = await fetch(`/api/questions/matrix?${p}`, { signal }).catch(() => null);
      if (!r || !r.ok) return;
      const data = (await r.json()) as MatrixResp;
      setRows(data.rows ?? []);
    },
    [documentId]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetchMatrix(ctrl.signal).finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [fetchMatrix]);

  // Polling mientras haya alguna celda en curso (GENERATING/PENDING o disparada local).
  useEffect(() => {
    const anyGenerating =
      pending.size > 0 ||
      rows.some((q) =>
        FORMATS.some((f) => {
          const s = q.byFormat[f.id]?.status;
          return s === "GENERATING" || s === "PENDING";
        })
      );
    if (!anyGenerating) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      void fetchMatrix();
      // Limpia los pending locales que ya se reflejan en la BD.
      setPending((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        for (const q of rows) {
          for (const f of FORMATS) {
            const s = q.byFormat[f.id]?.status;
            if (s === "GENERATING" || s === "COMPLETE") next.delete(`${q.id}::${f.id}`);
          }
        }
        return next;
      });
    }, 6000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [rows, pending, fetchMatrix]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const produce = useCallback(
    async (q: MatrixRow, formatId: string) => {
      const key = `${q.id}::${formatId}`;
      setPending((prev) => new Set(prev).add(key));
      try {
        const res = await fetch("/api/atelier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent: q.pregunta, formatId, questionId: q.id }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
        }
      } catch (e) {
        setPending((prev) => {
          const n = new Set(prev);
          n.delete(key);
          return n;
        });
        toast.error(`No se pudo producir: ${(e as Error).message}`);
      }
    },
    []
  );

  // Produce todos los formatos faltantes (sin entregable o en ERROR) de una pregunta.
  const produceRow = useCallback(
    (q: MatrixRow) => {
      const faltantes = FORMATS.filter((f) => {
        const s = q.byFormat[f.id]?.status;
        return s !== "COMPLETE" && s !== "GENERATING" && s !== "PENDING";
      });
      if (faltantes.length === 0) {
        toast.info("Esta pregunta ya tiene los 4 formatos en curso o listos.");
        return;
      }
      faltantes.forEach((f) => void produce(q, f.id));
      toast.success(`${faltantes.length} formato(s) encolado(s) en el Taller.`);
    },
    [produce]
  );

  return (
    <div className="fade-up" data-screen-label="QuestionsMatriz">
      <PageHeader
        label="Investigación · Matriz Q×Formato"
        title="Producción"
        italic="por el Taller"
        subtitle="Cada celda es una pregunta × un formato del Taller. Haz clic en una celda vacía para producirla (corre el motor agéntico completo, ~6-9 min). Una celda llena abre la producción."
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section
        style={{
          padding: "18px 56px",
          maxWidth: 1100,
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
            {rows.length} preguntas × {FORMATS.length} formatos
          </span>
        </div>
      </section>

      <section style={{ padding: "20px 56px 96px", maxWidth: 1100, overflowX: "auto" }}>
        <div style={{ minWidth: 900, border: "1px solid var(--line)" }}>
          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `360px repeat(${FORMATS.length}, 1fr) 120px`,
              background: "var(--bg-subtle)",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div style={{ padding: "14px 16px" }}>
              <div className="label">Pregunta</div>
            </div>
            {FORMATS.map((f) => (
              <div key={f.id} style={{ padding: "14px 12px", borderLeft: "1px solid var(--line)" }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)" }}>{f.name}</div>
                <div className="mono" style={{ fontSize: 10, opacity: 0.6, marginTop: 3 }}>
                  ~{f.defaultWords.toLocaleString()} pal.
                </div>
              </div>
            ))}
            <div style={{ padding: "14px 12px", borderLeft: "1px solid var(--line)" }}>
              <div className="label">Acción</div>
            </div>
          </div>

          {loading && (
            <div style={{ padding: 32 }}>
              <div className="shimmer-line" style={{ height: 14, width: "50%" }} />
            </div>
          )}

          {!loading &&
            rows.map((q, qi) => (
              <div
                key={q.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: `360px repeat(${FORMATS.length}, 1fr) 120px`,
                  borderBottom: qi === rows.length - 1 ? 0 : "1px solid var(--line)",
                }}
              >
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 13, color: "var(--fg)", lineHeight: 1.35, marginBottom: 6 }}>
                    {q.pregunta}
                  </div>
                  <PeriodTag code={q.periodoCode} size="sm" />
                </div>
                {FORMATS.map((f) => {
                  const cell = q.byFormat[f.id];
                  const localPending = pending.has(`${q.id}::${f.id}`);
                  const status: CellStatus = localPending
                    ? "GENERATING"
                    : ((cell?.status as CellStatus) ?? null);
                  return (
                    <MatrixCell
                      key={f.id}
                      status={status}
                      onClick={() => {
                        if (status === "COMPLETE" && cell) {
                          router.push(`/producciones/${cell.deliverableId}`);
                        } else if (status === "GENERATING" || status === "PENDING") {
                          /* en curso: no-op */
                        } else {
                          void produce(q, f.id);
                        }
                      }}
                    />
                  );
                })}
                <div
                  style={{
                    borderLeft: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "10px 8px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => produceRow(q)}
                    title="Producir los formatos faltantes de esta pregunta"
                    style={{ ...linkBtn, fontSize: 11 }}
                  >
                    Faltantes →
                  </button>
                </div>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}

function MatrixCell({ status, onClick }: { status: CellStatus; onClick: () => void }) {
  const config: Record<
    "complete" | "generating" | "error" | "empty",
    { bg: string; glyph: string; color: string; title: string }
  > = {
    complete: { bg: "var(--bg-subtle)", glyph: "●", color: "var(--success)", title: "Listo — abrir producción" },
    generating: { bg: "transparent", glyph: "◐", color: "var(--accent)", title: "En curso…" },
    error: { bg: "transparent", glyph: "✕", color: "var(--danger)", title: "Falló — clic para reintentar" },
    empty: { bg: "transparent", glyph: "+", color: "var(--fg-faint)", title: "Producir este formato" },
  };
  const key: keyof typeof config =
    status === "COMPLETE"
      ? "complete"
      : status === "GENERATING" || status === "PENDING"
        ? "generating"
        : status === "ERROR"
          ? "error"
          : "empty";
  const c = config[key];
  const interactive = key !== "generating";

  return (
    <button
      type="button"
      onClick={onClick}
      title={c.title}
      disabled={!interactive}
      style={{
        appearance: "none",
        borderLeft: "1px solid var(--line)",
        borderTop: 0,
        borderRight: 0,
        borderBottom: 0,
        background: c.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px 8px",
        cursor: interactive ? "pointer" : "default",
      }}
    >
      <span style={{ color: c.color, fontSize: 13, fontFamily: "var(--font-mono)" }}>{c.glyph}</span>
    </button>
  );
}
