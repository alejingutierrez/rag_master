"use client";

import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  PageHeader,
  SectionHeader,
  FilterTabs,
  Pill,
  primaryBtn,
} from "@/components/editorial";
import {
  ATELIER_FORMAT_LIST,
  type AtelierFormatId,
  type LongitudId,
} from "@/lib/atelier-formats";

type Stage =
  | "encuadre"
  | "acopio"
  | "triangulacion"
  | "verificacion"
  | "hipotesis"
  | "composicion"
  | "edicion"
  | "complete"
  | "error";

interface AtelierPhase {
  key: Stage;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
  metric?: string;
}

interface ConfidenceIndex {
  score: number;
  label: "alta" | "media" | "baja";
  rationale: string;
  factors: { name: string; value: number }[];
  documentosUnicos: number;
  claimsTotales: number;
  claimsBienSoportados: number;
  contradiccionesResueltas: number;
}

interface AtelierMeta {
  stage: Stage;
  message?: string;
  formatId: AtelierFormatId;
  phases?: AtelierPhase[];
  confidenceIndex?: ConfidenceIndex;
  wordCount?: number;
  docCount?: number;
  degraded?: string[];
}

interface ChunkMeta {
  id: string;
  documentFilename?: string;
  pageNumber?: number;
  similarity?: number;
}

interface Data {
  id: string;
  status: "PENDING" | "GENERATING" | "COMPLETE" | "ERROR";
  userQuestion: string;
  answer: string;
  chunksUsed: ChunkMeta[];
  metadata: { atelier?: AtelierMeta } | null;
  templateId: string;
  createdAt: string;
}

const STAGES: { key: Stage; label: string; desc: string }[] = [
  { key: "encuadre", label: "Encuadre", desc: "Se traduce la intención en un brief: tesis, ejes y voz." },
  { key: "acopio", label: "Acopio", desc: "Se cruzan fuentes del corpus por cada eje de indagación." },
  { key: "triangulacion", label: "Triangulación", desc: "Se cotejan fuentes: concordancias y contradicciones resueltas." },
  { key: "verificacion", label: "Verificación", desc: "Un verificador refuta cada afirmación contra sus fuentes." },
  { key: "hipotesis", label: "Hipótesis", desc: "Se fija la espina argumental: tesis, antítesis y síntesis sobre la evidencia." },
  { key: "composicion", label: "Composición", desc: "Se redacta la pieza solo con el material verificado." },
  { key: "edicion", label: "Edición", desc: "Pulido de estilo y control de calidad." },
  { key: "complete", label: "Listo", desc: "Entregable terminado." },
];

const STAGE_INDEX: Record<Stage, number> = {
  encuadre: 0,
  acopio: 1,
  triangulacion: 2,
  verificacion: 3,
  hipotesis: 4,
  composicion: 5,
  edicion: 6,
  complete: 7,
  error: 0,
};

const LONGITUDES: { value: LongitudId; label: string }[] = [
  { value: "compacta", label: "Compacta" },
  { value: "normal", label: "Normal" },
  { value: "extensa", label: "Extensa" },
];

type Tab = "pieza" | "fases" | "confianza" | "fuentes";

export default function AtelierPage() {
  return (
    <Suspense fallback={<div style={{ padding: 56 }} />}>
      <AtelierContent />
    </Suspense>
  );
}

function AtelierContent() {
  const router = useRouter();
  const params = useSearchParams();
  const idFromUrl = params.get("id");

  const [intent, setIntent] = useState("");
  const [formatId, setFormatId] = useState<AtelierFormatId>("cronica");
  const [longitud, setLongitud] = useState<LongitudId>("normal");
  const [linkedQuestionId, setLinkedQuestionId] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>("pieza");
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preloadedRef = useRef(false);

  const fetchData = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/deliverables/${id}`);
      if (!res.ok) throw new Error("Entregable no encontrado");
      const d = (await res.json()) as Data;
      setData(d);
      return d;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, []);

  const startPolling = useCallback(
    (id: string) => {
      if (pollerRef.current) clearInterval(pollerRef.current);
      const tick = async () => {
        const d = await fetchData(id);
        if (!d || d.status === "COMPLETE" || d.status === "ERROR") {
          if (pollerRef.current) {
            clearInterval(pollerRef.current);
            pollerRef.current = null;
          }
        }
      };
      tick();
      pollerRef.current = setInterval(tick, 3000);
    },
    [fetchData]
  );

  useEffect(() => {
    if (idFromUrl) startPolling(idFromUrl);
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, [idFromUrl, startPolling]);

  // Precarga desde una pregunta del corpus: ?intent= y/o ?questionId=.
  useEffect(() => {
    if (idFromUrl || preloadedRef.current) return;
    const qid = params.get("questionId");
    const intentParam = params.get("intent");
    if (!qid && !intentParam) return;
    preloadedRef.current = true;
    if (qid) setLinkedQuestionId(qid);
    if (intentParam) {
      setIntent(intentParam);
      return;
    }
    if (qid) {
      fetch(`/api/questions/${qid}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { question?: { pregunta?: string } } | null) => {
          if (d?.question?.pregunta) setIntent(d.question.pregunta);
        })
        .catch(() => {});
    }
  }, [idFromUrl, params]);

  const submit = async () => {
    const q = intent.trim();
    if (q.length < 12) {
      toast.warning("Necesitas al menos 12 caracteres.");
      return;
    }
    setSubmitting(true);
    setData(null);
    setTab("pieza");
    try {
      const res = await fetch("/api/atelier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: q, formatId, longitud, questionId: linkedQuestionId ?? undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const { deliverableId } = (await res.json()) as { deliverableId: string };
      router.replace(`/admin/atelier?id=${deliverableId}`);
      startPolling(deliverableId);
      toast.success("El Taller se puso a trabajar");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const meta = data?.metadata?.atelier;
  const stage: Stage = data?.status === "ERROR" ? "error" : meta?.stage ?? "encuadre";
  const stageIdx = STAGE_INDEX[stage];
  const isRunning = data?.status === "GENERATING" || data?.status === "PENDING";
  const phase: "idle" | "running" | "done" = !data ? "idle" : isRunning ? "running" : "done";

  return (
    <div className="fade-up" data-screen-label="Atelier">
      <PageHeader
        label="Producción · Motor agéntico"
        title="El Taller"
        subtitle="Cruza fuentes, verifica cada afirmación y compone una pieza pulida en el formato que elijas. El rigor queda en el aparato crítico; el texto, limpio. Cuanto más hondo el formato, más tarda: de unos minutos la crónica a bastante más el capítulo."
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      {phase === "idle" && (
        <section style={{ padding: "56px 56px 0", maxWidth: 1100 }}>
          {/* Selector de formato */}
          <div className="label" style={{ marginBottom: 14 }}>
            Formato del entregable
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
              marginBottom: 44,
            }}
          >
            {ATELIER_FORMAT_LIST.map((f) => {
              const selected = f.id === formatId;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormatId(f.id)}
                  style={{
                    appearance: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    background: selected ? "var(--bg-hover)" : "transparent",
                    border: `1px solid ${selected ? "var(--accent)" : "var(--line)"}`,
                    borderRadius: 8,
                    padding: "16px 18px",
                    transition: "border-color 140ms var(--ease-out-custom)",
                  }}
                >
                  <div
                    className="display"
                    style={{ fontSize: 18, color: "var(--fg)", marginBottom: 6 }}
                  >
                    {f.name}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                    {f.description}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <span className="label">Intención</span>
            {linkedQuestionId && (
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: "var(--accent)",
                  border: "1px solid var(--accent)",
                  borderRadius: 4,
                  padding: "2px 8px",
                  letterSpacing: "0.04em",
                }}
              >
                ↳ vinculado a una pregunta del corpus
              </span>
            )}
          </div>
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder='Ej: "Cuéntame la toma y retoma del Palacio de Justicia desde la mirada de las víctimas."'
            rows={2}
            style={{
              width: "100%",
              appearance: "none",
              background: "transparent",
              border: 0,
              borderBottom: "1px solid var(--line-strong)",
              outline: "none",
              resize: "vertical",
              fontFamily: "var(--font-display)",
              fontSize: 28,
              color: "var(--fg)",
              lineHeight: 1.3,
              padding: "12px 0",
              letterSpacing: "-0.01em",
            }}
          />
          <div
            style={{
              marginTop: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>Extensión</span>
              <FilterTabs<LongitudId> value={longitud} onChange={setLongitud} options={LONGITUDES} />
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || intent.trim().length < 12}
              style={
                intent.trim().length >= 12 && !submitting
                  ? primaryBtn
                  : { ...primaryBtn, opacity: 0.4, cursor: "default" }
              }
            >
              {submitting ? "Iniciando…" : "Componer →"}
            </button>
          </div>

          <div style={{ marginTop: 56 }}>
            <SectionHeader title="Cómo trabaja el Taller" caption="Seis fases; el andamiaje queda tras bambalinas" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
              {STAGES.slice(0, -1).map((s, i) => (
                <div key={s.key} style={{ padding: "20px 0", borderTop: "1px solid var(--line)" }}>
                  <div
                    className="mono"
                    style={{ fontSize: 11, color: "var(--fg-faint)", letterSpacing: "0.04em" }}
                  >
                    Fase {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="display" style={{ fontSize: 20, color: "var(--fg)", margin: "6px 0" }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                    {s.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {phase !== "idle" && data && (
        <>
          <section style={{ padding: "32px 56px 0", maxWidth: 1320 }}>
            <div className="label" style={{ marginBottom: 12 }}>
              Encargo
            </div>
            <h2
              className="display"
              style={{ fontSize: 32, margin: 0, color: "var(--fg)", lineHeight: 1.2, maxWidth: 900 }}
            >
              {data.userQuestion}
            </h2>
            {phase === "done" && data.status === "COMPLETE" && (
              <button
                type="button"
                onClick={() => router.push(`/admin/producciones/${data.id}`)}
                style={{ ...primaryBtn, marginTop: 20 }}
              >
                Ver en Producciones →
              </button>
            )}
          </section>

          {data.status === "ERROR" ? (
            <section style={{ padding: "44px 56px 96px", maxWidth: 900 }}>
              <div
                style={{
                  border: "1px solid var(--danger)",
                  borderRadius: 8,
                  padding: "20px 24px",
                  color: "var(--fg)",
                }}
              >
                <div className="label" style={{ marginBottom: 8, color: "var(--danger)" }}>
                  Error
                </div>
                <div className="serif" style={{ fontSize: 16 }}>
                  {meta?.message ?? "Algo falló en la composición."}
                </div>
              </div>
            </section>
          ) : (
            <>
              <section style={{ padding: "32px 56px 0", maxWidth: 1320 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`,
                    gap: 8,
                  }}
                >
                  {STAGES.map((s, i) => {
                    const done = i < stageIdx;
                    const active = i === stageIdx;
                    const ph = meta?.phases?.find((p) => p.key === s.key);
                    return (
                      <div key={s.key} style={{ paddingTop: 14 }}>
                        <div
                          style={{
                            height: 2,
                            background: done
                              ? "var(--success)"
                              : active
                                ? "var(--accent)"
                                : "var(--line)",
                            marginBottom: 10,
                            transition: "background 220ms var(--ease-out-custom)",
                          }}
                        />
                        <div
                          className="mono"
                          style={{
                            fontSize: 10.5,
                            color: done || active ? "var(--fg)" : "var(--fg-faint)",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {s.label}
                        </div>
                        {(active || done) && ph?.metric && (
                          <div style={{ fontSize: 11, color: "var(--fg-subtle)", marginTop: 4 }}>
                            {ph.metric}
                          </div>
                        )}
                        {active && isRunning && (
                          <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 4 }}>
                            {meta?.message ?? s.desc}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section style={{ padding: "44px 56px 0", maxWidth: 1320 }}>
                <FilterTabs<Tab>
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: "pieza", label: `Pieza${phase === "done" ? " · lista" : ""}` },
                    { value: "fases", label: "Fases" },
                    {
                      value: "confianza",
                      label: meta?.confidenceIndex
                        ? `Confianza · ${meta.confidenceIndex.score}`
                        : "Confianza",
                    },
                    { value: "fuentes", label: `Fuentes · ${data.chunksUsed?.length ?? 0}` },
                  ]}
                />
              </section>

              <section style={{ padding: "44px 56px 96px", maxWidth: 1100 }}>
                {tab === "pieza" && <Pieza data={data} isRunning={!!isRunning} />}
                {tab === "fases" && <Fases phases={meta?.phases ?? []} />}
                {tab === "confianza" && <Confianza ci={meta?.confidenceIndex} degraded={meta?.degraded} />}
                {tab === "fuentes" && <Fuentes chunks={data.chunksUsed ?? []} />}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Pieza({ data, isRunning }: { data: Data; isRunning: boolean }) {
  if (!data.answer && isRunning) {
    return (
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
        <span style={{ fontSize: 14, color: "var(--fg-muted)" }}>Componiendo la pieza…</span>
      </div>
    );
  }
  if (!data.answer) {
    return (
      <p className="serif" style={{ color: "var(--fg-faint)" }}>
        Sin contenido todavía.
      </p>
    );
  }
  const lines = data.answer.split("\n");
  return (
    <div className="prose" style={{ maxWidth: "none", fontSize: 18 }}>
      {lines.map((line, idx) => {
        if (line.startsWith("# ")) return <h1 key={idx}>{renderInline(line.slice(2))}</h1>;
        if (line.startsWith("## ")) return <h2 key={idx}>{renderInline(line.slice(3))}</h2>;
        if (line.startsWith("### ")) return <h3 key={idx}>{renderInline(line.slice(4))}</h3>;
        if (line.startsWith("> "))
          return (
            <blockquote key={idx}>
              <p style={{ margin: 0 }}>{renderInline(line.slice(2))}</p>
            </blockquote>
          );
        if (line.trim() === "") return <div key={idx} style={{ height: 6 }} />;
        return <p key={idx}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function Fases({ phases }: { phases: AtelierPhase[] }) {
  return (
    <div className="fade-in">
      <SectionHeader title="Fases del Taller" caption="El proceso interno, paso a paso" />
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {phases.map((p, i) => (
          <li
            key={p.key}
            style={{
              padding: "18px 0",
              borderTop: "1px solid var(--line)",
              display: "grid",
              gridTemplateColumns: "30px 1fr 150px",
              gap: 18,
              alignItems: "baseline",
            }}
          >
            <span className="mono" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="serif" style={{ fontSize: 16, color: "var(--fg)" }}>
                {STAGES.find((s) => s.key === p.key)?.label ?? p.key}
              </div>
              {p.detail && (
                <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 3 }}>
                  {p.detail}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              {p.status === "done" ? (
                <span className="mono" style={{ fontSize: 11, color: "var(--success)" }}>
                  ✓ {p.metric ?? "hecho"}
                </span>
              ) : p.status === "running" ? (
                <span className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>
                  ◐ {p.metric ?? "en curso"}
                </span>
              ) : p.status === "error" ? (
                <span className="mono" style={{ fontSize: 11, color: "var(--danger)" }}>
                  error
                </span>
              ) : (
                <span className="mono" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                  · pendiente
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Confianza({ ci, degraded }: { ci?: ConfidenceIndex; degraded?: string[] }) {
  if (!ci) {
    return (
      <p className="serif" style={{ color: "var(--fg-faint)" }}>
        El índice de confianza aparecerá al terminar.
      </p>
    );
  }
  const color =
    ci.label === "alta" ? "var(--success)" : ci.label === "media" ? "var(--accent)" : "var(--danger)";
  return (
    <div className="fade-in">
      <SectionHeader title="Índice de confianza" caption="Calculado del cruce y la verificación de fuentes" />
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 8 }}>
        <span className="display" style={{ fontSize: 56, color }}>
          {ci.score}
        </span>
        <span className="mono" style={{ fontSize: 13, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {ci.label}
        </span>
      </div>
      <p className="serif" style={{ fontSize: 16, color: "var(--fg-muted)", maxWidth: 640, lineHeight: 1.6 }}>
        {ci.rationale}
      </p>
      <div style={{ marginTop: 32, maxWidth: 520 }}>
        {ci.factors.map((f) => (
          <div key={f.name} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{f.name}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--fg-subtle)" }}>
                {Math.round(f.value * 100)}%
              </span>
            </div>
            <div style={{ height: 4, background: "var(--line)", borderRadius: 2 }}>
              <div
                style={{
                  width: `${Math.round(f.value * 100)}%`,
                  height: "100%",
                  background: "var(--accent)",
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {degraded && degraded.length > 0 && (
        <div style={{ marginTop: 28, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {degraded.map((d, i) => (
            <Pill key={i}>{d}</Pill>
          ))}
        </div>
      )}
    </div>
  );
}

function Fuentes({ chunks }: { chunks: ChunkMeta[] }) {
  return (
    <div className="fade-in">
      <SectionHeader title="Fuentes usadas" caption="Documentos que respaldan las afirmaciones verificadas" />
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {chunks.map((c, i) => (
          <li
            key={c.id ?? i}
            style={{
              padding: "16px 0",
              borderTop: i === 0 ? "1px solid var(--line-strong)" : "1px solid var(--line)",
              display: "grid",
              gridTemplateColumns: "30px 1fr 80px",
              gap: 18,
              alignItems: "baseline",
            }}
          >
            <span className="mono" style={{ fontSize: 11, color: "var(--accent)", fontWeight: 500 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="serif" style={{ fontSize: 15, color: "var(--fg)", lineHeight: 1.3 }}>
                {c.documentFilename?.replace(/\.pdf$/i, "") ?? "Fuente"}
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-subtle)", marginTop: 4 }}>
                p. {c.pageNumber ?? "—"}
              </div>
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--fg-muted)", textAlign: "right" }}>
              sim {((c.similarity ?? 0) * 100).toFixed(0)}%
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Render inline mínimo: **negrita** y *cursiva*. El cuerpo del Taller no lleva citas. */
function renderInline(text: string) {
  const parts: React.ReactNode[] = [];
  let r = text;
  let k = 0;
  while (r.length) {
    const bMatch = r.match(/^\*\*([^*]+)\*\*/);
    const iMatch = r.match(/^\*([^*]+)\*/);
    if (bMatch) {
      parts.push(<strong key={k++}>{bMatch[1]}</strong>);
      r = r.slice(bMatch[0].length);
    } else if (iMatch) {
      parts.push(<em key={k++}>{iMatch[1]}</em>);
      r = r.slice(iMatch[0].length);
    } else {
      const nextB = r.indexOf("**");
      const nextI = r.indexOf("*");
      const candidates = [nextB, nextI].filter((x) => x >= 0);
      const stop = candidates.length ? Math.min(...candidates) : r.length;
      const slice = r.slice(0, Math.max(stop, 1));
      parts.push(<Fragment key={k++}>{slice}</Fragment>);
      r = r.slice(slice.length);
    }
  }
  return parts;
}
