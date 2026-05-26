"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  FilterTabs,
  SearchInput,
  EmptyState,
  PeriodTag,
  primaryBtn,
  ghostBtn,
} from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import { getTemplateById } from "@/lib/chat-templates";

type KindFilter = "all" | "chat" | "batch" | "deep_research";

interface DeliverableItem {
  id: string;
  templateId: string;
  status: string;
  source?: string;
  modelUsed?: string;
  createdAt: string;
  updatedAt: string;
  answerPreview?: string;
  userQuestion?: string | null;
  metadata?: Record<string, unknown>;
  question?: {
    id: string;
    pregunta: string;
    periodoCode: string;
    periodoNombre: string;
    categoriaCode: string;
    document?: { id: string; filename: string };
  } | null;
}

interface DeliverablesResp {
  deliverables: DeliverableItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function ProduccionesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 56 }} />}>
      <ProduccionesContent />
    </Suspense>
  );
}

function ProduccionesContent() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();
    const load = async () => {
      try {
        const p = new URLSearchParams({
          page: String(page),
          limit: "30",
        });
        if (kindFilter !== "all") p.set("source", kindFilter);
        if (search) p.set("search", search);
        const res = await fetch(`/api/deliverables?${p}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as DeliverablesResp;
        if (!mounted) return;
        setDeliverables(data.deliverables);
        setTotalPages(data.pagination.totalPages);
      } catch (e) {
        if ((e as Error).name !== "AbortError") console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const interval = setInterval(() => {
      if (deliverables.some((d) => d.status === "GENERATING" || d.status === "PENDING")) {
        load();
      }
    }, 5000);
    return () => {
      mounted = false;
      ctrl.abort();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, kindFilter, search]);

  const counts = useMemo(
    () => ({
      all: deliverables.length,
      chat: deliverables.filter((d) => d.source === "chat").length,
      batch: deliverables.filter((d) => d.source === "batch").length,
      deep_research: deliverables.filter((d) => d.source === "deep_research").length,
    }),
    [deliverables],
  );

  return (
    <div className="fade-up" data-screen-label="Producciones">
      <PageHeader
        label={`Producción · ${counts.all} piezas`}
        title="Producciones"
        italic="académicas"
        subtitle="Ensayos, papers, análisis comparados, cronologías. Cada producción se construye a partir de una pregunta del corpus o de una consulta libre."
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              style={ghostBtn}
              onClick={() => router.push("/chat")}
            >
              Nueva consulta
            </button>
            <button
              type="button"
              style={primaryBtn}
              onClick={() => router.push("/deep-research")}
            >
              Deep Research →
            </button>
          </div>
        }
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section
        style={{
          padding: "20px 56px",
          maxWidth: 1320,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <FilterTabs<KindFilter>
          value={kindFilter}
          onChange={(v) => {
            setKindFilter(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: `Todas · ${counts.all}` },
            { value: "chat", label: `Chat · ${counts.chat}` },
            { value: "batch", label: `Batch · ${counts.batch}` },
            { value: "deep_research", label: `Deep Research · ${counts.deep_research}` },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar producción…" />
      </section>

      <section style={{ padding: "20px 56px 48px", maxWidth: 1320 }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {loading && deliverables.length === 0 && (
            <>
              {[0, 1, 2].map((i) => (
                <li key={i} style={{ padding: "26px 0", borderBottom: "1px solid var(--line)" }}>
                  <div className="shimmer-line" style={{ height: 22, width: "60%", marginBottom: 8 }} />
                  <div className="shimmer-line" style={{ height: 12, width: "30%" }} />
                </li>
              ))}
            </>
          )}
          {deliverables.map((p, i) => {
            const tpl = getTemplateById(p.templateId);
            const title = p.question?.pregunta ?? p.userQuestion ?? "(producción)";
            const period = p.question?.periodoCode as PeriodCode | undefined;
            const date = new Date(p.createdAt).toLocaleDateString("es-CO", {
              day: "2-digit",
              month: "short",
            });
            const words =
              (p.answerPreview ?? "").trim().split(/\s+/).filter(Boolean).length;
            return (
              <li
                key={p.id}
                style={{
                  borderTop: i === 0 ? "1px solid var(--line-strong)" : 0,
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <button
                  type="button"
                  onClick={() => router.push(`/producciones/${p.id}`)}
                  style={{
                    width: "100%",
                    appearance: "none",
                    background: "transparent",
                    border: 0,
                    padding: "26px 0",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "grid",
                    gridTemplateColumns: "1fr 220px 110px 80px",
                    gap: 32,
                    alignItems: "baseline",
                    transition: "background 120ms var(--ease-out-custom)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-muted)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: "var(--fg-faint)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 6,
                      }}
                    >
                      {tpl?.name ?? p.templateId}
                      {p.modelUsed ? ` · ${p.modelUsed}` : ""}
                      {p.status === "GENERATING" ? " · generando" : ""}
                      {p.status === "ERROR" ? " · error" : ""}
                    </div>
                    <div
                      className="serif"
                      style={{
                        fontSize: 22,
                        color: "var(--fg)",
                        lineHeight: 1.25,
                        letterSpacing: "-0.005em",
                      }}
                    >
                      {title}
                    </div>
                  </div>
                  {period && period in PERIODS ? (
                    <PeriodTag code={period} size="sm" />
                  ) : (
                    <span />
                  )}
                  <div
                    className="mono num"
                    style={{
                      fontSize: 12.5,
                      color: "var(--fg-muted)",
                      textAlign: "right",
                    }}
                  >
                    {words > 0 ? words.toLocaleString("es-CO") : "—"}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--fg-muted)",
                      textAlign: "right",
                    }}
                  >
                    {date}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {!loading && deliverables.length === 0 && (
          <EmptyState
            title="Sin producciones"
            hint="Lanza una consulta o un deep research para crear tu primera pieza."
            action={
              <button
                type="button"
                style={primaryBtn}
                onClick={() => router.push("/chat")}
              >
                Nueva consulta →
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
