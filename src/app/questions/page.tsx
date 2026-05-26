"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PageHeader,
  FilterTabs,
  SearchInput,
  Pill,
  EmptyState,
  PeriodTag,
  StatusDot,
  primaryBtn,
  ghostBtn,
} from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";

type StateFilter = "all" | "pending" | "partial" | "complete";

interface Question {
  id: string;
  questionNumber: number;
  pregunta: string;
  periodoCode: string;
  periodoNombre: string;
  periodoRango: string;
  categoriaCode: string;
  categoriaNombre: string;
  yearPrincipal?: number | null;
  entidadesPersonas?: string[];
  entidadesLugares?: string[];
  entidadesConceptos?: string[];
  deliverables?: Array<{ id: string; templateId: string; status: string }>;
  document?: { id: string; filename: string };
}

interface StatsData {
  totalQuestions: number;
  byState?: { pending: number; partial: number; complete: number; all: number };
}

function deriveState(q: Question): "pending" | "partial" | "complete" {
  const dlv = q.deliverables ?? [];
  if (dlv.length === 0) return "pending";
  if (dlv.some((d) => d.status === "COMPLETE")) {
    return dlv.length >= 3 ? "complete" : "partial";
  }
  return "partial";
}

export default function QuestionsPage() {
  return (
    <Suspense fallback={<QuestionsLoading />}>
      <QuestionsContent />
    </Suspense>
  );
}

function QuestionsLoading() {
  return (
    <div className="fade-up" style={{ padding: "72px 56px" }}>
      <div className="shimmer-line" style={{ height: 16, width: 220, marginBottom: 24 }} />
      <div className="shimmer-line" style={{ height: 64, width: "60%" }} />
    </div>
  );
}

function QuestionsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const periodoParam = params.get("periodo") ?? "";

  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<string>(periodoParam);
  const [search, setSearch] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const p = new URLSearchParams({
      page: String(page),
      limit: "30",
      includeStats: "true",
      includeDeliverables: "true",
      sortBy: "cronologico",
    });
    if (periodFilter) p.set("periodo", periodFilter);
    if (search) p.set("search", search);
    if (stateFilter !== "all") p.set("state", stateFilter);

    fetch(`/api/questions?${p}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { questions: [], pagination: { totalPages: 1 } }))
      .then((data) => {
        setQuestions(data.questions ?? []);
        setStats(data.stats ?? null);
        setTotalPages(data.pagination?.totalPages ?? 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [page, periodFilter, search, stateFilter]);

  const counts = useMemo(() => {
    const total = stats?.totalQuestions ?? questions.length;
    return {
      all: total,
      pending: stats?.byState?.pending ?? 0,
      partial: stats?.byState?.partial ?? 0,
      complete: stats?.byState?.complete ?? 0,
    };
  }, [stats, questions]);

  return (
    <div className="fade-up" data-screen-label="Questions">
      <PageHeader
        label={`Investigación · ${counts.all} preguntas curadas`}
        title="Preguntas"
        italic="del corpus"
        subtitle="Cada documento genera 6–32 preguntas guiadas. Cada pregunta puede materializarse en una o más producciones (ensayo, paper, análisis comparado…)."
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              style={ghostBtn}
              onClick={() => router.push("/questions/matriz")}
            >
              Vista matriz
            </button>
            <button
              type="button"
              style={primaryBtn}
              onClick={() => router.push("/questions/generate")}
            >
              Generar →
            </button>
          </div>
        }
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section style={{ padding: "20px 56px", maxWidth: 1320 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <FilterTabs<StateFilter>
            value={stateFilter}
            onChange={(v) => {
              setStateFilter(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: `Todas · ${counts.all}` },
              { value: "complete", label: `Completas · ${counts.complete}` },
              { value: "partial", label: `Parciales · ${counts.partial}` },
              { value: "pending", label: `Pendientes · ${counts.pending}` },
            ]}
          />
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar preguntas…" />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 18 }}>
          <Pill active={periodFilter === ""} onClick={() => setPeriodFilter("")}>
            Todos los períodos
          </Pill>
          {(Object.keys(PERIODS) as PeriodCode[])
            .filter((c) => c !== "TRANS")
            .map((code) => (
              <Pill
                key={code}
                active={periodFilter === code}
                onClick={() => {
                  setPeriodFilter(code);
                  setPage(1);
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: `var(--p-${PERIODS[code].slug})`,
                  }}
                />
                {code}
              </Pill>
            ))}
        </div>
      </section>

      <section style={{ padding: "20px 56px 96px", maxWidth: 1320 }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {loading &&
            [0, 1, 2, 3].map((i) => (
              <li
                key={i}
                style={{
                  padding: "22px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div className="shimmer-line" style={{ height: 22, width: "70%", marginBottom: 8 }} />
                <div className="shimmer-line" style={{ height: 12, width: "40%" }} />
              </li>
            ))}
          {!loading &&
            questions.map((q, i) => (
              <QuestionRow key={q.id} q={q} i={i} onClick={() => router.push(`/chat?q=${encodeURIComponent(q.pregunta)}`)} />
            ))}
        </ul>

        {!loading && questions.length === 0 && (
          <EmptyState
            title="Sin resultados"
            hint="Ajusta los filtros o genera preguntas para un documento."
            action={
              <button
                type="button"
                style={primaryBtn}
                onClick={() => router.push("/questions/generate")}
              >
                Generar preguntas →
              </button>
            }
          />
        )}

        {totalPages > 1 && (
          <div
            style={{
              marginTop: 32,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 12,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--fg-muted)",
            }}
          >
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                appearance: "none",
                background: "transparent",
                border: "1px solid var(--line-strong)",
                padding: "4px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--fg-muted)",
                cursor: page <= 1 ? "default" : "pointer",
                opacity: page <= 1 ? 0.4 : 1,
              }}
            >
              ←
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{
                appearance: "none",
                background: "transparent",
                border: "1px solid var(--line-strong)",
                padding: "4px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--fg-muted)",
                cursor: page >= totalPages ? "default" : "pointer",
                opacity: page >= totalPages ? 0.4 : 1,
              }}
            >
              →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function QuestionRow({
  q,
  i,
  onClick,
}: {
  q: Question;
  i: number;
  onClick: () => void;
}) {
  const state = deriveState(q);
  const completed = (q.deliverables ?? []).filter((d) => d.status === "COMPLETE").length;
  const entities = [
    ...(q.entidadesPersonas ?? []),
    ...(q.entidadesLugares ?? []),
    ...(q.entidadesConceptos ?? []),
  ];
  return (
    <li
      style={{
        borderTop: i === 0 ? "1px solid var(--line-strong)" : 0,
        borderBottom: "1px solid var(--line)",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          appearance: "none",
          background: "transparent",
          border: 0,
          padding: "22px 0",
          cursor: "pointer",
          textAlign: "left",
          display: "grid",
          gridTemplateColumns: "60px 1fr 180px 140px",
          gap: 24,
          alignItems: "baseline",
          transition: "background 120ms var(--ease-out-custom)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-muted)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div className="mono num" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
          #{String(q.questionNumber).padStart(3, "0")}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            className="serif"
            style={{
              fontSize: 19,
              color: "var(--fg)",
              lineHeight: 1.3,
              letterSpacing: "-0.005em",
            }}
          >
            {q.pregunta}
          </div>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 10.5,
                color: "var(--fg-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {q.periodoNombre} · {q.categoriaCode}
            </span>
            {entities.slice(0, 2).map((e) => (
              <span key={e} style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>
                {e}
              </span>
            ))}
          </div>
        </div>
        <PeriodTag code={q.periodoCode} size="sm" />
        <QState state={state} completed={completed} />
      </button>
    </li>
  );
}

function QState({
  state,
  completed,
}: {
  state: "pending" | "partial" | "complete";
  completed: number;
}) {
  if (state === "complete") {
    return <StatusDot kind="success" label={`${completed} producciones`} />;
  }
  if (state === "partial") {
    return <StatusDot kind="warning" label={`${completed} parcial`} />;
  }
  return <StatusDot kind="muted" label="Pendiente" />;
}
