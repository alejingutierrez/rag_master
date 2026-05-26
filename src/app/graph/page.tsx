"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Network, ArrowRight } from "lucide-react";
import { Card, Skeleton, Badge, Checkbox } from "@/components/ui";
import { getPeriodColor, getCategoryColor } from "@/lib/theme";

interface GraphNode {
  id: string;
  label: string;
  type: "document" | "question" | "production" | "period" | "category";
  size?: number;
  metadata?: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
}

const TYPE_COLORS: Record<string, string> = {
  document: "#6366F1",
  question: "#F59E0B",
  production: "#A855F7",
  period: "#10B981",
  category: "#EC4899",
};

const TYPE_LABELS: Record<string, string> = {
  document: "Documentos",
  question: "Preguntas",
  production: "Producciones",
  period: "Periodos",
  category: "Categorías",
};

const TYPE_BADGE_VARIANT: Record<string, "info" | "warning" | "tinta" | "success" | "subtle"> = {
  document: "info",
  question: "warning",
  production: "tinta",
  period: "success",
  category: "subtle",
};

/**
 * Layout fuerza simple sin dependencias externas: ponemos periodos/categorías en
 * círculos exteriores, documentos/preguntas/producciones se distribuyen por su
 * relación. Es un layout determinista basado en angular slots.
 */
function layoutNodes(nodes: GraphNode[], edges: GraphEdge[]) {
  const W = 900;
  const H = 700;
  const cx = W / 2;
  const cy = H / 2;

  const positioned = new Map<string, { x: number; y: number }>();

  // Periodos en círculo exterior superior
  const periods = nodes.filter((n) => n.type === "period");
  periods.forEach((n, i) => {
    const angle = (i / periods.length) * Math.PI - Math.PI / 2;
    positioned.set(n.id, { x: cx + Math.cos(angle) * 330, y: cy + Math.sin(angle) * 220 });
  });

  // Categorías en círculo inferior
  const categories = nodes.filter((n) => n.type === "category");
  categories.forEach((n, i) => {
    const angle = (i / categories.length) * Math.PI + Math.PI / 2;
    positioned.set(n.id, { x: cx + Math.cos(angle) * 330, y: cy + Math.sin(angle) * 220 });
  });

  // Documentos en círculo intermedio izquierdo
  const docs = nodes.filter((n) => n.type === "document");
  docs.forEach((n, i) => {
    const ringR = 180;
    const angle = (i / docs.length) * 2 * Math.PI;
    positioned.set(n.id, { x: cx - 200 + Math.cos(angle) * ringR * 0.4, y: cy + Math.sin(angle) * ringR * 0.4 });
  });

  // Preguntas en círculo central
  const questions = nodes.filter((n) => n.type === "question");
  questions.forEach((n, i) => {
    const ringR = 100;
    const angle = (i / questions.length) * 2 * Math.PI;
    positioned.set(n.id, { x: cx + Math.cos(angle) * ringR, y: cy + Math.sin(angle) * ringR });
  });

  // Producciones cerca de su pregunta
  const productions = nodes.filter((n) => n.type === "production");
  productions.forEach((n) => {
    const incoming = edges.find((e) => e.target === n.id);
    if (incoming) {
      const src = positioned.get(incoming.source);
      if (src) {
        positioned.set(n.id, { x: src.x + (Math.random() - 0.5) * 60, y: src.y + (Math.random() - 0.5) * 60 + 40 });
        return;
      }
    }
    positioned.set(n.id, { x: cx + (Math.random() - 0.5) * 200, y: cy + 200 + (Math.random() - 0.5) * 100 });
  });

  return positioned;
}

export default function GraphPage() {
  const [data, setData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(
    new Set(["document", "question", "production", "period", "category"]),
  );
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/graph")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    const nodes = data.nodes.filter((n) => enabledTypes.has(n.type));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = data.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
    return { nodes, edges };
  }, [data, enabledTypes]);

  const positions = useMemo(() => layoutNodes(filtered.nodes, filtered.edges), [filtered]);

  const hoverConnected = useMemo(() => {
    if (!hovered) return new Set<string>();
    const ids = new Set<string>([hovered]);
    for (const e of filtered.edges) {
      if (e.source === hovered) ids.add(e.target);
      if (e.target === hovered) ids.add(e.source);
    }
    return ids;
  }, [hovered, filtered]);

  if (loading || !data) {
    return (
      <div className="max-w-[var(--container-wide)] mx-auto px-8 py-8">
        <Skeleton variant="line" className="h-8 w-72 mb-3" />
        <Skeleton variant="line" className="h-4 w-[480px] mb-6" />
        <Skeleton variant="line" className="h-[700px] w-full" />
      </div>
    );
  }

  const hoveredNode = hovered ? filtered.nodes.find((n) => n.id === hovered) : null;

  return (
    <div className="max-w-[var(--container-wide)] mx-auto px-8 py-8">
      {/* Hero */}
      <header className="mb-6">
        <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
          Red semántica
        </div>
        <h1
          className="serif-title text-[36px] leading-tight mt-1.5 mb-2 text-[var(--color-ink-1000)] flex items-center gap-3"
          style={{ fontWeight: 700 }}
        >
          <Network className="size-8 text-[var(--accent)]" />
          Grafo de conexiones
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--fg-muted)] max-w-[720px]">
          Red de relaciones entre documentos, preguntas, producciones y la taxonomía histórica.
          Pasa el cursor sobre un nodo para ver sus conexiones.
        </p>
      </header>

      {/* Filter controls */}
      <Card variant="default" size="sm" className="mb-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[12px] font-semibold text-[var(--fg-default)] uppercase tracking-wide">
            Mostrar
          </span>
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <label
              key={key}
              className="inline-flex items-center gap-2 cursor-pointer select-none"
            >
              <Checkbox
                checked={enabledTypes.has(key)}
                onCheckedChange={(checked) => {
                  const next = new Set(enabledTypes);
                  if (checked) next.add(key);
                  else next.delete(key);
                  setEnabledTypes(next);
                }}
              />
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ background: TYPE_COLORS[key] }}
                />
                <span className="text-[13px] text-[var(--fg-default)]">{label}</span>
              </span>
            </label>
          ))}
        </div>
      </Card>

      {/* Graph canvas */}
      <Card variant="default" size="md" className="p-0 overflow-hidden">
        {filtered.nodes.length === 0 ? (
          <div className="py-16 text-center">
            <Network className="size-10 text-[var(--fg-subtle)] mx-auto mb-3" />
            <div className="text-[14px] text-[var(--fg-muted)]">Sin nodos visibles</div>
            <div className="text-[12px] text-[var(--fg-subtle)] mt-1">
              Activa al menos una categoría arriba para visualizar la red.
            </div>
          </div>
        ) : (
          <svg
            viewBox="0 0 900 700"
            style={{
              width: "100%",
              height: 700,
              display: "block",
              background: "var(--bg-muted)",
            }}
            onMouseLeave={() => setHovered(null)}
          >
            {/* Edges */}
            {filtered.edges.map((e, i) => {
              const s = positions.get(e.source);
              const t = positions.get(e.target);
              if (!s || !t) return null;
              const highlighted = hovered && (e.source === hovered || e.target === hovered);
              return (
                <line
                  key={i}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={highlighted ? "var(--accent)" : "var(--border-default)"}
                  strokeWidth={highlighted ? 1.8 : 0.5}
                  strokeOpacity={hovered ? (highlighted ? 0.9 : 0.05) : 0.3}
                />
              );
            })}
            {/* Nodes */}
            {filtered.nodes.map((n) => {
              const pos = positions.get(n.id);
              if (!pos) return null;
              const baseColor =
                n.type === "period" && typeof n.metadata?.code === "string"
                  ? getPeriodColor(n.metadata.code as string)
                  : n.type === "category" && typeof n.metadata?.code === "string"
                  ? getCategoryColor(n.metadata.code as string)
                  : TYPE_COLORS[n.type];
              const isHovered = n.id === hovered;
              const isConnected = hoverConnected.has(n.id);
              const opacity = hovered ? (isConnected ? 1 : 0.15) : 1;
              const radius =
                n.type === "period" || n.type === "category"
                  ? 14
                  : n.type === "document"
                  ? 11
                  : n.type === "question"
                  ? 7 + Math.min(6, n.size ?? 0)
                  : 5;

              return (
                <g
                  key={n.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  style={{ cursor: "pointer", opacity }}
                  onMouseEnter={() => setHovered(n.id)}
                >
                  <circle
                    r={isHovered ? radius * 1.3 : radius}
                    fill={baseColor}
                    fillOpacity={n.type === "period" || n.type === "category" ? 0.85 : 0.75}
                    stroke={baseColor}
                    strokeWidth={isHovered ? 2 : 1}
                  />
                  {(n.type === "period" || n.type === "category" || isHovered) && (
                    <text
                      y={radius + 14}
                      textAnchor="middle"
                      fontSize={n.type === "period" || n.type === "category" ? 10 : 9}
                      fill="var(--fg-default)"
                      fontWeight={n.type === "period" || n.type === "category" ? 600 : 400}
                      style={{ pointerEvents: "none" }}
                    >
                      {n.label.length > 30 ? n.label.slice(0, 28) + "…" : n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </Card>

      {/* Hover details */}
      {hoveredNode && (
        <Card variant="default" size="sm" className="mt-3">
          <div className="flex flex-col gap-2">
            <Badge variant={TYPE_BADGE_VARIANT[hoveredNode.type] ?? "subtle"} size="xs">
              {TYPE_LABELS[hoveredNode.type].slice(0, -1)}
            </Badge>
            <div className="text-[14px] font-semibold text-[var(--fg-default)] leading-snug">
              {hoveredNode.label}
            </div>
            {hoveredNode.type === "document" && typeof hoveredNode.metadata?.docId === "string" && (
              <Link
                href={`/documents/${hoveredNode.metadata.docId}`}
                className="text-[13px] text-[var(--accent)] hover:underline inline-flex items-center gap-1 w-fit"
              >
                Abrir documento <ArrowRight className="size-3" />
              </Link>
            )}
            {hoveredNode.type === "question" && typeof hoveredNode.metadata?.questionId === "string" && (
              <Link
                href={`/questions?focus=${hoveredNode.metadata.questionId}`}
                className="text-[13px] text-[var(--accent)] hover:underline inline-flex items-center gap-1 w-fit"
              >
                Ver pregunta <ArrowRight className="size-3" />
              </Link>
            )}
            {hoveredNode.type === "production" && typeof hoveredNode.metadata?.deliverableId === "string" && (
              <Link
                href={`/producciones/${hoveredNode.metadata.deliverableId}`}
                className="text-[13px] text-[var(--accent)] hover:underline inline-flex items-center gap-1 w-fit"
              >
                Ver producción <ArrowRight className="size-3" />
              </Link>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
