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
import { getAtelierFormat, ATELIER_FORMAT_LIST } from "@/lib/atelier-formats";

type KindFilter = "all" | "chat" | "batch" | "deep_research" | "atelier";

interface DeliverableCounts {
  all: number;
  bySource: Record<string, number>;
  byTemplate: Record<string, number>;
}

const selectStyle: React.CSSProperties = {
  appearance: "none",
  background: "transparent",
  border: "1px solid var(--line-strong)",
  padding: "7px 12px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--fg)",
  cursor: "pointer",
  borderRadius: 0,
};

/** Recorta a un título legible en el borde de palabra (el texto completo vive en el detalle). */
function shortTitle(text: string, max = 96): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

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
  counts?: DeliverableCounts;
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
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([]);
  const [counts, setCounts] = useState<DeliverableCounts | null>(null);
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
        if (typeFilter !== "all") p.set("templateId", typeFilter);
        if (search) p.set("search", search);
        const res = await fetch(`/api/deliverables?${p}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as DeliverablesResp;
        if (!mounted) return;
        setDeliverables(data.deliverables);
        setTotalPages(data.pagination.totalPages);
        if (data.counts) setCounts(data.counts);
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
  }, [page, kindFilter, typeFilter, search]);

  // Conteos por pestaña desde el servidor (estables: no dependen de la página
  // actual ni de la pestaña seleccionada).
  const tabCounts = useMemo(() => {
    const bs = counts?.bySource ?? {};
    return {
      all: counts?.all ?? 0,
      chat: bs.chat ?? 0,
      batch: bs.batch ?? 0,
      deep_research: bs.deep_research ?? 0,
      atelier: bs.atelier ?? 0,
    };
  }, [counts]);

  return (
    <div className="fade-up" data-screen-label="Producciones">
      <PageHeader
        label={`Producción · ${tabCounts.all} piezas · Alejandro Gutiérrez`}
        title="Producciones"
        italic="académicas"
        subtitle="Ensayos, papers, análisis comparados, cronologías. Cada producción se construye a partir de una pregunta del corpus o de una consulta libre."
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              style={ghostBtn}
              onClick={() => router.push("/admin/chat")}
            >
              Nueva consulta
            </button>
            <button
              type="button"
              style={primaryBtn}
              onClick={() => router.push("/admin/atelier")}
            >
              El Taller →
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
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <FilterTabs<KindFilter>
            value={kindFilter}
            onChange={(v) => {
              setKindFilter(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: `Todas · ${tabCounts.all}` },
              { value: "chat", label: `Chat · ${tabCounts.chat}` },
              { value: "batch", label: `Batch · ${tabCounts.batch}` },
              { value: "deep_research", label: `Deep Research · ${tabCounts.deep_research}` },
              { value: "atelier", label: `El Taller · ${tabCounts.atelier}` },
            ]}
          />
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            style={selectStyle}
            aria-label="Filtrar por tipo de producción"
          >
            <option value="all">Todos los tipos</option>
            {ATELIER_FORMAT_LIST.map((f) => {
              const n = counts?.byTemplate?.[f.id];
              return (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {n ? ` · ${n}` : ""}
                </option>
              );
            })}
          </select>
        </div>
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
            const tplName = getAtelierFormat(p.templateId)?.name ?? p.templateId;
            const fullTitle = p.question?.pregunta ?? p.userQuestion ?? "(producción)";
            const title = shortTitle(fullTitle);
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
                  onClick={() => router.push(`/admin/producciones/${p.id}`)}
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
                      {tplName}
                      {p.status === "GENERATING" ? " · generando" : ""}
                      {p.status === "ERROR" ? " · error" : ""}
                    </div>
                    <div
                      className="serif"
                      title={fullTitle}
                      style={{
                        fontSize: 22,
                        color: "var(--fg)",
                        lineHeight: 1.25,
                        letterSpacing: "-0.005em",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
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
                onClick={() => router.push("/admin/chat")}
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
