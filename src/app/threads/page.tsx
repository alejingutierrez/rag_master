"use client";

import { useEffect, useMemo, useState } from "react";
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

interface Thread {
  id: string;
  title: string;
  desc: string;
  steps: number;
  prods: number;
  period: PeriodCode;
  updated: string;
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
      return {
        id: key,
        title,
        desc: catLabel
          ? `Línea sobre ${catLabel.toLowerCase()} en ${periodLabel}.`
          : `Hilo de investigación en ${periodLabel} (${arr.length} producción${arr.length === 1 ? "" : "es"}).`,
        steps: arr.length,
        prods: arr.length,
        period: (period in PERIODS ? period : "TRANS") as PeriodCode,
        updated: new Date(latest).toLocaleDateString("es-CO", {
          day: "2-digit",
          month: "short",
        }),
      };
    });
}

export default function ThreadsPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

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
        subtitle="Secuencias de preguntas + producciones + notas, agrupadas por tesis. Útil para mantener una línea argumental coherente entre sesiones."
        action={
          <button
            type="button"
            style={primaryBtn}
            onClick={() => router.push("/chat")}
          >
            + Nuevo hilo
          </button>
        }
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section
        style={{
          padding: "44px 56px 96px",
          maxWidth: 1320,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 0,
        }}
      >
        {loading && (
          <>
            {[0, 1].map((i) => (
              <div key={i} style={{ padding: "32px 32px 32px 0", borderTop: "1px solid var(--line)" }}>
                <div className="shimmer-line" style={{ height: 28, width: "80%", marginBottom: 10 }} />
                <div className="shimmer-line" style={{ height: 14, width: "60%" }} />
              </div>
            ))}
          </>
        )}
        {!loading && threads.length === 0 && (
          <div style={{ gridColumn: "1 / -1" }}>
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
          </div>
        )}
        {threads.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => router.push(`/producciones?source=batch`)}
            style={{
              appearance: "none",
              background: "transparent",
              border: 0,
              borderTop: i < 2 ? 0 : "1px solid var(--line)",
              borderLeft: i % 2 === 1 ? "1px solid var(--line)" : 0,
              padding: "32px 32px 32px 0",
              paddingLeft: i % 2 === 1 ? 32 : 0,
              textAlign: "left",
              cursor: "pointer",
              transition: "background 120ms var(--ease-out-custom)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
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
              {t.steps} pasos · {t.prods} producciones
            </div>
          </button>
        ))}
      </section>
    </div>
  );
}
