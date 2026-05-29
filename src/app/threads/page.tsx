"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  PeriodTag,
  EmptyState,
  primaryBtn,
} from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";

// Vista derivada: agrupa deliverables por período + categoría usando la taxonomía
// resuelta por el backend (resolvedPeriodoCode), que funciona también para
// deliverables sin question vinculada (chat libre, deep research).
// TODO: cuando exista /api/threads persistente, reemplazar esta vista derivada.

interface DeliverableLite {
  id: string;
  templateId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  userQuestion?: string | null;
  source?: string | null;
  resolvedPeriodoCode?: string | null;
  resolvedCategoriaCode?: string | null;
  question?: {
    id: string;
    pregunta: string;
    periodoCode: string;
    periodoNombre: string;
    categoriaCode: string;
    categoriaNombre: string;
  } | null;
}

interface ThreadItem {
  id: string;
  title: string;
  updated: string;
}

interface Thread {
  id: string;
  title: string;
  desc: string;
  steps: number;
  prods: number;
  period: PeriodCode;
  updated: string;
  items: ThreadItem[];
}

function buildThreads(items: DeliverableLite[]): Thread[] {
  const byKey = new Map<string, DeliverableLite[]>();
  for (const d of items) {
    const period = d.question?.periodoCode ?? d.resolvedPeriodoCode ?? null;
    if (!period) continue;
    const cat = d.question?.categoriaCode ?? d.resolvedCategoriaCode ?? "GEN";
    const key = `${period}-${cat}`;
    const arr = byKey.get(key) ?? [];
    arr.push(d);
    byKey.set(key, arr);
  }
  return Array.from(byKey.entries())
    .filter(([, arr]) => arr.length >= 1)
    .slice(0, 12)
    .map(([key, arr]) => {
      const [period] = key.split("-");
      const periodLabel = period in PERIODS ? PERIODS[period as PeriodCode].label : period;
      // Ordenar por updatedAt desc para que first sea el más reciente.
      arr.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
      const first = arr[0];
      const latest = first.updatedAt;
      const title =
        first.question?.pregunta ??
        first.userQuestion ??
        `Hilo · ${periodLabel}`;
      const catLabel =
        first.question?.categoriaNombre ??
        (first.resolvedCategoriaCode ? null : null);
      const items: ThreadItem[] = arr.map((d) => ({
        id: d.id,
        title:
          d.question?.pregunta ??
          d.userQuestion ??
          `Producción · ${d.templateId}`,
        updated: new Date(d.updatedAt).toLocaleDateString("es-CO", {
          day: "2-digit",
          month: "short",
        }),
      }));
      return {
        id: key,
        title,
        desc: catLabel
          ? `Línea sobre ${catLabel.toLowerCase()} en ${periodLabel}.`
          : `Hilo de investigación en ${periodLabel} (${arr.length} ${arr.length === 1 ? "producción" : "producciones"}).`,
        steps: arr.length,
        prods: arr.length,
        period: (period in PERIODS ? period : "TRANS") as PeriodCode,
        updated: new Date(latest).toLocaleDateString("es-CO", {
          day: "2-digit",
          month: "short",
        }),
        items,
      };
    });
}

export default function ThreadsPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/deliverables?limit=200", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { deliverables: [] }))
      .then((d) => setThreads(buildThreads(d.deliverables ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  return (
    <div className="fade-up" data-screen-label="Threads">
      <PageHeader
        label={`Investigación · ${threads.length} hilos`}
        title="Hilos"
        italic="de investigación"
        subtitle="Agrupación automática de producciones por período y categoría temática. Vista derivada del corpus; abre un hilo para ver sus producciones."
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section style={{ padding: "44px 56px 96px", maxWidth: 1320 }}>
        {loading && (
          <>
            {[0, 1].map((i) => (
              <div key={i} style={{ padding: "32px 0", borderTop: "1px solid var(--line)" }}>
                <div className="shimmer-line" style={{ height: 28, width: "60%", marginBottom: 10 }} />
                <div className="shimmer-line" style={{ height: 14, width: "40%" }} />
              </div>
            ))}
          </>
        )}
        {!loading && threads.length === 0 && (
          <EmptyState
            title="Sin hilos todavía"
            hint="Genera producciones para que aparezcan hilos derivados."
            action={
              <button
                type="button"
                style={primaryBtn}
                onClick={() => router.push("/chat")}
              >
                Iniciar consulta →
              </button>
            }
          />
        )}
        {threads.map((t, i) => {
          const open = expanded === t.id;
          return (
            <div
              key={t.id}
              style={{
                borderTop: i === 0 ? "1px solid var(--line-strong)" : "1px solid var(--line)",
              }}
            >
              <button
                type="button"
                onClick={() => setExpanded(open ? null : t.id)}
                aria-expanded={open}
                style={{
                  width: "100%",
                  appearance: "none",
                  background: "transparent",
                  border: 0,
                  padding: "28px 0",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "background 120ms var(--ease-out-custom)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
                  <PeriodTag code={t.period} size="sm" />
                  <span className="mono" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                    {t.updated}
                  </span>
                </div>
                <h3
                  className="display"
                  style={{
                    fontSize: 28,
                    margin: 0,
                    color: "var(--fg)",
                    lineHeight: 1.1,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {t.title}
                </h3>
                <p
                  className="serif"
                  style={{
                    fontSize: 15.5,
                    color: "var(--fg-muted)",
                    margin: "10px 0 18px",
                    lineHeight: 1.5,
                    fontStyle: "italic",
                  }}
                >
                  {t.desc}
                </p>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--fg-muted)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {t.prods} {t.prods === 1 ? "producción" : "producciones"} · {open ? "ocultar ▴" : "ver ▾"}
                </div>
              </button>

              {open && (
                <ul style={{ listStyle: "none", margin: "0 0 28px", padding: 0 }}>
                  {t.items.map((it) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => router.push(`/producciones/${it.id}`)}
                        style={{
                          width: "100%",
                          appearance: "none",
                          background: "transparent",
                          border: 0,
                          borderTop: "1px solid var(--line)",
                          padding: "16px 0 16px 24px",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "grid",
                          gridTemplateColumns: "1fr 80px",
                          gap: 24,
                          alignItems: "baseline",
                          transition: "opacity 120ms var(--ease-out-custom)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.62")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                      >
                        <span
                          className="serif"
                          style={{
                            fontSize: 15,
                            color: "var(--fg)",
                            lineHeight: 1.4,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {it.title}
                        </span>
                        <span
                          className="mono"
                          style={{ fontSize: 11, color: "var(--fg-faint)", textAlign: "right" }}
                        >
                          {it.updated}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
