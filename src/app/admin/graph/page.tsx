"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";

type NodeType = "document" | "question" | "production" | "period" | "category";

interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  color?: string;
  size?: number;
  metadata?: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

const W = 1000;
const H = 620;
const CX = W / 2;
const CY = H / 2;

export default function GraphPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/graph", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: GraphData | null) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const positioned = useMemo(() => {
    if (!data) return { periods: [], docs: [], questions: [], edges: [] };

    const periodNodes = data.nodes.filter((n) => n.type === "period");
    const docNodes = data.nodes.filter((n) => n.type === "document");
    const questionNodes = data.nodes.filter((n) => n.type === "question");

    const periodsPositioned: PositionedNode[] = periodNodes
      .slice(0, 15)
      .map((p, i, arr) => {
        const angle = (i / arr.length) * 2 * Math.PI - Math.PI / 2;
        return {
          ...p,
          x: CX + Math.cos(angle) * 280,
          y: CY + Math.sin(angle) * 240,
        };
      });

    const periodByCode = new Map(periodsPositioned.map((p) => [p.id, p]));

    const docsPositioned: PositionedNode[] = docNodes.slice(0, 30).map((d, i, arr) => {
      const angle = (i / arr.length) * 2 * Math.PI;
      const baseX = CX + Math.cos(angle) * 130;
      const baseY = CY + Math.sin(angle) * 110;
      // Pull toward period if known.
      const periodMeta = (d.metadata as Record<string, unknown> | undefined)?.periodoCode as
        | string
        | undefined;
      const p = periodMeta ? periodByCode.get(`period-${periodMeta}`) : null;
      if (p) {
        return {
          ...d,
          x: baseX + (p.x - CX) * 0.18,
          y: baseY + (p.y - CY) * 0.18,
        };
      }
      return { ...d, x: baseX, y: baseY };
    });

    const questionsPositioned: PositionedNode[] = questionNodes
      .slice(0, 16)
      .map((q, i, arr) => {
        const angle = (i / arr.length) * 2 * Math.PI + 0.3;
        return {
          ...q,
          x: CX + Math.cos(angle) * 55,
          y: CY + Math.sin(angle) * 48,
        };
      });

    // Resolve edges to positioned nodes for drawing.
    const allMap = new Map<string, PositionedNode>();
    [...periodsPositioned, ...docsPositioned, ...questionsPositioned].forEach((n) =>
      allMap.set(n.id, n),
    );
    const edges = data.edges
      .map((e) => ({ a: allMap.get(e.source), b: allMap.get(e.target) }))
      .filter((e): e is { a: PositionedNode; b: PositionedNode } => !!e.a && !!e.b)
      .slice(0, 200);

    return {
      periods: periodsPositioned,
      docs: docsPositioned,
      questions: questionsPositioned,
      edges,
    };
  }, [data]);

  return (
    <div className="fade-up" data-screen-label="Graph">
      <PageHeader
        label="Exploración · Vista relacional"
        title="Grafo"
        italic="de corpus"
        subtitle="Períodos canónicos (exterior), documentos vectorizados (medio), preguntas (centro). Las aristas reflejan pertenencia y referencias cruzadas."
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section style={{ padding: "32px 56px 96px", maxWidth: 1320 }}>
        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: 24,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <LegendDot
            color="var(--fg)"
            label={`Períodos · ${positioned.periods.length}`}
            ring
          />
          <LegendDot
            color="var(--accent)"
            label={`Documentos · ${positioned.docs.length}`}
          />
          <LegendDot
            color="var(--fg-muted)"
            label={`Preguntas · ${positioned.questions.length}`}
            size={4}
          />
        </div>

        {loading ? (
          <div
            style={{
              border: "1px solid var(--line)",
              background: "var(--bg-subtle)",
              height: 500,
            }}
          />
        ) : (
          <div style={{ border: "1px solid var(--line)", background: "var(--bg-subtle)" }}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: "100%", height: "auto", display: "block" }}
            >
              {/* edges */}
              {positioned.edges.map((e, i) => (
                <line
                  key={i}
                  x1={e.a.x}
                  y1={e.a.y}
                  x2={e.b.x}
                  y2={e.b.y}
                  stroke="var(--line-strong)"
                  strokeWidth="0.5"
                  opacity={0.6}
                />
              ))}
              {/* period nodes (rings) */}
              {positioned.periods.map((p) => {
                const code = (p.id.replace(/^period-/, "") as PeriodCode);
                const slug = PERIODS[code]?.slug ?? "trans";
                return (
                  <g key={p.id}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="14"
                      fill="var(--bg)"
                      stroke={`var(--p-${slug})`}
                      strokeWidth="2"
                    />
                    <text
                      x={p.x}
                      y={p.y - 24}
                      textAnchor="middle"
                      fontFamily="var(--font-mono)"
                      fontSize="9"
                      fill="var(--fg-muted)"
                      style={{ letterSpacing: "0.04em" }}
                    >
                      {code}
                    </text>
                  </g>
                );
              })}
              {/* doc nodes */}
              {positioned.docs.map((d) => (
                <circle
                  key={d.id}
                  cx={d.x}
                  cy={d.y}
                  r="6"
                  fill="var(--accent)"
                  stroke="var(--bg)"
                  strokeWidth="1.5"
                >
                  <title>{d.label}</title>
                </circle>
              ))}
              {/* question nodes */}
              {positioned.questions.map((q) => (
                <circle key={q.id} cx={q.x} cy={q.y} r="3" fill="var(--fg-muted)">
                  <title>{q.label}</title>
                </circle>
              ))}
            </svg>
          </div>
        )}
      </section>
    </div>
  );
}

function LegendDot({
  color,
  label,
  ring,
  size = 8,
}: {
  color: string;
  label: string;
  ring?: boolean;
  size?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: size + (ring ? 4 : 0),
          height: size + (ring ? 4 : 0),
          borderRadius: "50%",
          background: ring ? "transparent" : color,
          border: ring ? `2px solid ${color}` : 0,
        }}
      />
      <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>{label}</span>
    </div>
  );
}
