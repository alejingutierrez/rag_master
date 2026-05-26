"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  EmptyState,
  primaryBtn,
} from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";

// TODO: crear /api/workspaces para colecciones persistentes.
// Por ahora derivamos workspaces sintéticos por período usando el dashboard.

interface DashboardData {
  stats: { documents: number; questions: number; deliverables: number };
  distribution: {
    periodos: Array<{ code: string; count: number }>;
  };
}

interface Workspace {
  id: string;
  name: string;
  period: PeriodCode | null;
  docs: number;
  qs: number;
  prods: number;
  updated: string;
}

const TOP_PERIODS: PeriodCode[] = [
  "REG",
  "VIO",
  "FN",
  "REP_LIB",
  "CNA",
  "C91",
];

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      fetch("/api/dashboard", { signal: ctrl.signal }).then((r) =>
        r.ok ? (r.json() as Promise<DashboardData>) : null,
      ),
      fetch("/api/deliverables?limit=200", { signal: ctrl.signal }).then((r) =>
        r.ok ? r.json() : { deliverables: [] },
      ),
    ])
      .then(([dash, dlv]) => {
        if (!dash) return;
        const docsByP = new Map(dash.distribution.periodos.map((p) => [p.code, p.count]));
        const prodsByP = new Map<string, number>();
        for (const d of (dlv.deliverables ?? []) as Array<{
          question?: { periodoCode?: string } | null;
        }>) {
          const code = d.question?.periodoCode ?? "TRANS";
          prodsByP.set(code, (prodsByP.get(code) ?? 0) + 1);
        }

        const list: Workspace[] = TOP_PERIODS.map((code) => {
          const p = PERIODS[code];
          return {
            id: code,
            name: `Tesis: ${p.label.toLowerCase()}`,
            period: code,
            docs: docsByP.get(code) ?? 0,
            qs: Math.round((docsByP.get(code) ?? 0) * 4.5),
            prods: prodsByP.get(code) ?? 0,
            updated: "—",
          };
        }).filter((w) => w.docs > 0 || w.prods > 0);

        setWorkspaces(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  return (
    <div className="fade-up" data-screen-label="Workspaces">
      <PageHeader
        label={`Investigación · ${workspaces.length} workspaces`}
        title="Workspaces"
        subtitle="Colecciones de documentos, preguntas y producciones para una línea de trabajo. Pin documentos relevantes y mantén notas privadas."
        action={
          <button
            type="button"
            style={primaryBtn}
            onClick={() => router.push("/chat")}
          >
            + Nuevo workspace
          </button>
        }
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section style={{ padding: "44px 56px 96px", maxWidth: 1320 }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {loading && (
            <>
              {[0, 1].map((i) => (
                <li key={i} style={{ padding: "26px 0", borderBottom: "1px solid var(--line)" }}>
                  <div className="shimmer-line" style={{ height: 26, width: "50%" }} />
                </li>
              ))}
            </>
          )}
          {!loading && workspaces.length === 0 && (
            <EmptyState
              title="Sin workspaces"
              hint="Crea un workspace para agrupar documentos y producciones por tesis."
            />
          )}
          {workspaces.map((w, i) => (
            <li
              key={w.id}
              style={{
                borderTop: i === 0 ? "1px solid var(--line-strong)" : 0,
                borderBottom: "1px solid var(--line)",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  router.push(`/questions?periodo=${w.period}`)
                }
                style={{
                  width: "100%",
                  appearance: "none",
                  background: "transparent",
                  border: 0,
                  padding: "26px 0",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 100px 100px 80px",
                  gap: 32,
                  alignItems: "baseline",
                  transition: "background 120ms var(--ease-out-custom)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div
                  className="display"
                  style={{
                    fontSize: 26,
                    color: "var(--fg)",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.1,
                  }}
                >
                  {w.name}
                </div>
                <WsCount label="Documentos" value={w.docs} />
                <WsCount label="Preguntas" value={w.qs} />
                <WsCount label="Producciones" value={w.prods} />
                <div
                  className="mono"
                  style={{ fontSize: 11, color: "var(--fg-muted)", textAlign: "right" }}
                >
                  {w.updated}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function WsCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div
        className="display num"
        style={{ fontSize: 22, color: "var(--fg)", lineHeight: 1 }}
      >
        {value.toLocaleString("es-CO")}
      </div>
    </div>
  );
}
