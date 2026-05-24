"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  Typography,
  Space,
  Tag,
  Skeleton,
  theme,
  Checkbox,
  Empty,
} from "antd";
import { NodeIndexOutlined } from "@ant-design/icons";
import { getPeriodColor, getCategoryColor } from "@/lib/theme";

const { Title, Text, Paragraph } = Typography;

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
  const { token } = theme.useToken();
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
    return <div className="app-page-wide"><Skeleton active /></div>;
  }

  return (
    <div className="app-page-wide">
      <Title level={2} className="serif-title" style={{ margin: 0 }}>
        <NodeIndexOutlined /> Grafo de conexiones
      </Title>
      <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 16px" }}>
        Red de relaciones entre documentos, preguntas, producciones y la taxonomía histórica.
        Pasa el cursor sobre un nodo para ver sus conexiones.
      </Paragraph>

      <Card style={{ marginBottom: 12 }}>
        <Space wrap size={16}>
          <Text strong style={{ fontSize: 12 }}>Mostrar:</Text>
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <Checkbox
              key={key}
              checked={enabledTypes.has(key)}
              onChange={(e) => {
                const next = new Set(enabledTypes);
                if (e.target.checked) next.add(key);
                else next.delete(key);
                setEnabledTypes(next);
              }}
            >
              <Space size={4}>
                <span style={{ width: 10, height: 10, borderRadius: 5, background: TYPE_COLORS[key], display: "inline-block" }} />
                {label}
              </Space>
            </Checkbox>
          ))}
        </Space>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        {filtered.nodes.length === 0 ? (
          <div style={{ padding: 60 }}><Empty description="Sin nodos visibles" /></div>
        ) : (
          <svg
            viewBox="0 0 900 700"
            style={{ width: "100%", height: 700, display: "block", background: token.colorFillQuaternary }}
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
                  stroke={highlighted ? token.colorPrimary : token.colorBorder}
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
                      fill={token.colorText}
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

      {hovered && (() => {
        const node = filtered.nodes.find((n) => n.id === hovered);
        if (!node) return null;
        return (
          <Card size="small" style={{ marginTop: 12 }}>
            <Space vertical size={4}>
              <Tag color={node.type === "document" ? "blue" : node.type === "question" ? "orange" : node.type === "production" ? "purple" : "default"}>
                {TYPE_LABELS[node.type].slice(0, -1)}
              </Tag>
              <Text strong>{node.label}</Text>
              {node.type === "document" && typeof node.metadata?.docId === "string" && (
                <Link href={`/documents/${node.metadata.docId}`}><Text type="success">Abrir documento →</Text></Link>
              )}
              {node.type === "question" && typeof node.metadata?.questionId === "string" && (
                <Link href={`/questions?focus=${node.metadata.questionId}`}><Text type="success">Ver pregunta →</Text></Link>
              )}
              {node.type === "production" && typeof node.metadata?.deliverableId === "string" && (
                <Link href={`/producciones/${node.metadata.deliverableId}`}><Text type="success">Ver producción →</Text></Link>
              )}
            </Space>
          </Card>
        );
      })()}
    </div>
  );
}
