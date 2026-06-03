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
import { Cita } from "@/components/editorial/cita";

interface Subquery {
  query: string;
  status: "pending" | "running" | "done" | "error";
  foundChunks?: number;
  error?: string;
}

interface ChunkMeta {
  id: string;
  documentFilename?: string;
  pageNumber?: number;
  similarity?: number;
  content?: string;
}

interface ResearchPlan {
  thinking?: string;
  scope: string;
  entities: {
    personas: string[];
    instituciones: string[];
    lugares: string[];
    conceptos: string[];
    temporalidad: string;
  };
  subqueries: string[];
}

type Stage =
  | "planning"
  | "executing"
  | "fusing"
  | "synthesizing"
  | "annexes"
  | "persisting"
  | "complete"
  | "error";

interface DeepResearchMetadata {
  stage: Stage;
  message?: string;
  plan?: ResearchPlan;
  subqueriesProgress?: Subquery[];
  paperWords?: number;
  startedAt?: string;
  finishedAt?: string;
}

interface DeepResearchData {
  id: string;
  status: "PENDING" | "GENERATING" | "COMPLETE" | "ERROR";
  userQuestion: string;
  answer: string;
  chunksUsed: ChunkMeta[];
  metadata: DeepResearchMetadata;
  createdAt: string;
  updatedAt: string;
  modelUsed: string;
}

const STAGES: { key: Stage; label: string; desc: string }[] = [
  { key: "planning", label: "Planificación", desc: "Se diseña el plan: entidades, sub-consultas, temporalidad." },
  { key: "executing", label: "Ejecución", desc: "Se lanzan sub-consultas en paralelo contra el corpus." },
  { key: "fusing", label: "Fusión", desc: "Chunks deduplicados y rerankeados por relevancia agregada." },
  { key: "synthesizing", label: "Síntesis", desc: "Paper académico con citas inline obligatorias." },
  { key: "annexes", label: "Anexos", desc: "Cronología, bibliografía APA y aparato crítico." },
  { key: "complete", label: "Listo", desc: "Paper publicado." },
];

const STAGE_INDEX: Record<Stage, number> = {
  planning: 0,
  executing: 1,
  fusing: 2,
  synthesizing: 3,
  annexes: 4,
  persisting: 4,
  complete: 5,
  error: 0,
};

type Tab = "paper" | "plan" | "subqueries" | "sources";

export default function DeepResearchPage() {
  return (
    <Suspense fallback={<div style={{ padding: 56 }} />}>
      <DeepResearchContent />
    </Suspense>
  );
}

function DeepResearchContent() {
  const router = useRouter();
  const params = useSearchParams();
  const idFromUrl = params.get("id");

  const [question, setQuestion] = useState("");
  const [linkedQuestionId, setLinkedQuestionId] = useState<string | null>(null);
  const [data, setData] = useState<DeepResearchData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>("paper");
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preloadedRef = useRef(false);

  const fetchData = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/deep-research?id=${id}`);
      if (!res.ok) throw new Error("Deep research no encontrado");
      const d = (await res.json()) as DeepResearchData;
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
    [fetchData],
  );

  useEffect(() => {
    if (idFromUrl) startPolling(idFromUrl);
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, [idFromUrl, startPolling]);

  useEffect(() => {
    if (data?.userQuestion && !question) setQuestion(data.userQuestion);
  }, [data?.userQuestion]); // eslint-disable-line

  // Precarga desde una pregunta del corpus: ?q= y/o ?questionId= (no autodispara).
  useEffect(() => {
    if (idFromUrl || preloadedRef.current) return;
    const qid = params.get("questionId");
    const qText = params.get("q");
    if (!qid && !qText) return;
    preloadedRef.current = true;
    if (qid) setLinkedQuestionId(qid);
    if (qText) {
      setQuestion(qText);
      return;
    }
    if (qid) {
      fetch(`/api/questions/${qid}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { question?: { pregunta?: string } } | null) => {
          if (d?.question?.pregunta) setQuestion(d.question.pregunta);
        })
        .catch(() => {});
    }
  }, [idFromUrl, params]);

  const submit = async () => {
    const q = question.trim();
    if (q.length < 12) {
      toast.warning("Necesitas al menos 12 caracteres.");
      return;
    }
    setSubmitting(true);
    setData(null);
    setTab("paper");

    try {
      const res = await fetch("/api/deep-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, questionId: linkedQuestionId ?? undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const { deliverableId } = (await res.json()) as { deliverableId: string };
      router.replace(`/deep-research?id=${deliverableId}`);
      startPolling(deliverableId);
      toast.success("Investigación iniciada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const stage = data?.metadata?.stage ?? "planning";
  const stageIdx = STAGE_INDEX[stage];
  const isRunning = data?.status === "GENERATING" || data?.status === "PENDING";
  const phase: "idle" | "running" | "done" = !data
    ? "idle"
    : isRunning
      ? "running"
      : "done";

  return (
    <div className="fade-up" data-screen-label="DeepResearch">
      <PageHeader
        label="Investigación · Agente con thinking extendido"
        title="Deep Research"
        subtitle="El agente planifica sub-consultas, ejecuta en paralelo, fusiona evidencia y escribe un paper académico. Tiempo típico: 90–180 segundos."
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      {phase === "idle" && (
        <section style={{ padding: "56px 56px 0", maxWidth: 1100 }}>
          <div className="label" style={{ marginBottom: 14 }}>
            Pregunta de investigación
          </div>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder='Ej: "Reconstruye la consolidación del bipartidismo colombiano entre 1886 y 1957."'
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
              gap: 12,
            }}
          >
            <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
              {question.length} caracteres · mínimo 12
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || question.trim().length < 12}
              style={
                question.trim().length >= 12 && !submitting
                  ? primaryBtn
                  : { ...primaryBtn, opacity: 0.4, cursor: "default" }
              }
            >
              {submitting ? "Iniciando…" : "Iniciar investigación →"}
            </button>
          </div>

          <div style={{ marginTop: 56 }}>
            <SectionHeader title="Cómo funciona" caption="Cinco etapas, una pieza acabada" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 24,
              }}
            >
              {STAGES.slice(0, -1).map((s, i) => (
                <div
                  key={s.key}
                  style={{
                    padding: "20px 0",
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <div
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--fg-faint)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Etapa {String(i + 1).padStart(2, "0")}
                  </div>
                  <div
                    className="display"
                    style={{ fontSize: 20, color: "var(--fg)", margin: "6px 0 6px" }}
                  >
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
              Consulta de investigación
            </div>
            <h2
              className="display"
              style={{
                fontSize: 32,
                margin: 0,
                color: "var(--fg)",
                lineHeight: 1.2,
                maxWidth: 900,
              }}
            >
              {data.userQuestion}
            </h2>
            {phase === "done" && (
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--fg-muted)",
                  letterSpacing: "0.04em",
                  marginTop: 16,
                }}
              >
                Alejandro Gutiérrez ·{" "}
                {new Date(data.createdAt).toLocaleDateString("es-CO", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
                {data.chunksUsed?.length
                  ? ` · ${data.chunksUsed.length} fuentes`
                  : ""}
              </div>
            )}
          </section>

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
                    {active && isRunning && (
                      <div
                        style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 4 }}
                      >
                        {s.desc}
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
                {
                  value: "paper",
                  label: `Paper${phase === "done" ? " · listo" : ""}`,
                },
                { value: "plan", label: "Plan de investigación" },
                {
                  value: "subqueries",
                  label: `Sub-consultas · ${data.metadata.subqueriesProgress?.length ?? data.metadata.plan?.subqueries.length ?? 0}`,
                },
                {
                  value: "sources",
                  label: `Fuentes · ${data.chunksUsed?.length ?? 0}`,
                },
              ]}
            />
          </section>

          <section style={{ padding: "44px 56px 96px", maxWidth: 1100 }}>
            {tab === "paper" && (
              <PaperRender data={data} isRunning={isRunning} />
            )}
            {tab === "plan" && data.metadata.plan && (
              <DrPlan plan={data.metadata.plan} />
            )}
            {tab === "subqueries" && (
              <DrSubqueries items={data.metadata.subqueriesProgress ?? []} />
            )}
            {tab === "sources" && (
              <DrSources chunks={data.chunksUsed ?? []} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PaperRender({ data, isRunning }: { data: DeepResearchData; isRunning: boolean }) {
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
        <span style={{ fontSize: 14, color: "var(--fg-muted)" }}>
          Generando paper…
        </span>
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
        if (line.startsWith("# ")) {
          return (
            <h1 key={idx}>
              {renderInline(line.slice(2), data.chunksUsed)}
            </h1>
          );
        }
        if (line.startsWith("## ")) {
          return <h2 key={idx}>{renderInline(line.slice(3), data.chunksUsed)}</h2>;
        }
        if (line.startsWith("### ")) {
          return <h3 key={idx}>{renderInline(line.slice(4), data.chunksUsed)}</h3>;
        }
        if (line.startsWith("- ")) {
          return (
            <li key={idx} style={{ marginLeft: 20 }}>
              {renderInline(line.slice(2), data.chunksUsed)}
            </li>
          );
        }
        if (line.trim() === "") return <div key={idx} style={{ height: 4 }} />;
        return <p key={idx}>{renderInline(line, data.chunksUsed)}</p>;
      })}
    </div>
  );
}

function DrPlan({ plan }: { plan: ResearchPlan }) {
  return (
    <div className="fade-in">
      <SectionHeader title="Alcance" caption="Definido por el agente al inicio" />
      <p
        className="serif"
        style={{
          fontSize: 19,
          color: "var(--fg)",
          lineHeight: 1.65,
          maxWidth: 720,
        }}
      >
        {plan.scope}
      </p>

      <div style={{ marginTop: 56 }}>
        <SectionHeader title="Entidades clave" />
        {Object.entries(plan.entities).map(([k, v]) => {
          const list = Array.isArray(v) ? v : [v];
          return (
            <div
              key={k}
              style={{
                padding: "16px 0",
                borderTop: "1px solid var(--line)",
                display: "grid",
                gridTemplateColumns: "160px 1fr",
                gap: 24,
              }}
            >
              <div className="label" style={{ alignSelf: "baseline" }}>
                {k}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {list.map((it, i) => (
                  <Pill key={i}>{it}</Pill>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DrSubqueries({ items }: { items: Subquery[] }) {
  return (
    <div className="fade-in">
      <SectionHeader
        title="Sub-consultas"
        caption={`${items.length} consultas ejecutadas en paralelo`}
      />
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((q, i) => {
          const done = q.status === "done";
          return (
            <li
              key={i}
              style={{
                padding: "20px 0",
                borderTop: "1px solid var(--line)",
                display: "grid",
                gridTemplateColumns: "30px 1fr 120px",
                gap: 18,
                alignItems: "baseline",
              }}
            >
              <span
                className="mono num"
                style={{ fontSize: 11, color: "var(--fg-faint)" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div
                className="serif"
                style={{ fontSize: 16, color: "var(--fg)", lineHeight: 1.4 }}
              >
                {q.query}
              </div>
              <div style={{ textAlign: "right" }}>
                {done ? (
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--success)" }}
                  >
                    ✓ {q.foundChunks ?? 0} chunks
                  </span>
                ) : q.status === "running" ? (
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--accent)" }}
                  >
                    ◐ ejecutando
                  </span>
                ) : q.status === "error" ? (
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--danger)" }}
                  >
                    error
                  </span>
                ) : (
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--fg-faint)" }}
                  >
                    · pendiente
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DrSources({ chunks }: { chunks: ChunkMeta[] }) {
  return (
    <div className="fade-in">
      <SectionHeader
        title="Fuentes recuperadas"
        caption="Chunks deduplicados y rerankeados por relevancia agregada"
      />
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
            <span
              className="mono"
              style={{ fontSize: 11, color: "var(--accent)", fontWeight: 500 }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div
                className="serif"
                style={{ fontSize: 15, color: "var(--fg)", lineHeight: 1.3 }}
              >
                {c.documentFilename?.replace(/\.pdf$/i, "") ?? "Fuente"}
              </div>
              <div
                className="mono"
                style={{ fontSize: 10.5, color: "var(--fg-subtle)", marginTop: 4 }}
              >
                p. {c.pageNumber ?? "—"}
              </div>
            </div>
            <div
              className="mono"
              style={{ fontSize: 11, color: "var(--fg-muted)", textAlign: "right" }}
            >
              sim {((c.similarity ?? 0) * 100).toFixed(0)}%
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderInline(text: string, chunks: ChunkMeta[]) {
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
