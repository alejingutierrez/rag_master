"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Input, theme, Spin, Empty } from "antd";
import {
  HomeOutlined,
  FileTextOutlined,
  BookOutlined,
  AppstoreOutlined,
  MessageOutlined,
  CloudUploadOutlined,
  ExperimentOutlined,
  RadarChartOutlined,
  HeatMapOutlined,
  NodeIndexOutlined,
  BulbOutlined,
  UserOutlined,
  ClusterOutlined,
  ReadOutlined,
  RocketOutlined,
  SearchOutlined,
} from "@ant-design/icons";

type Item = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: React.ReactNode;
  group: "Navegar" | "Documentos" | "Preguntas" | "Producciones";
};

const STATIC_ITEMS: Item[] = [
  { id: "nav-home", label: "Inicio", href: "/", icon: <HomeOutlined />, group: "Navegar" },
  { id: "nav-upload", label: "Cargar PDFs", href: "/upload", icon: <CloudUploadOutlined />, group: "Navegar" },
  { id: "nav-docs", label: "Documentos", href: "/documents", icon: <FileTextOutlined />, group: "Navegar" },
  { id: "nav-enrich", label: "Enriquecer", href: "/enrich", icon: <ExperimentOutlined />, group: "Navegar" },
  { id: "nav-chat", label: "Consultar", href: "/chat", icon: <MessageOutlined />, group: "Navegar" },
  { id: "nav-deep", label: "Deep Research", href: "/deep-research", icon: <RocketOutlined />, group: "Navegar" },
  { id: "nav-hyp", label: "Sistema de hipótesis", href: "/hypothesis", icon: <BulbOutlined />, group: "Navegar" },
  { id: "nav-q", label: "Preguntas", href: "/questions", icon: <BookOutlined />, group: "Navegar" },
  { id: "nav-threads", label: "Hilos de investigación", href: "/threads", icon: <NodeIndexOutlined />, group: "Navegar" },
  { id: "nav-ws", label: "Workspaces", href: "/workspaces", icon: <ReadOutlined />, group: "Navegar" },
  { id: "nav-prod", label: "Producciones", href: "/producciones", icon: <AppstoreOutlined />, group: "Navegar" },
  { id: "nav-comp", label: "Comparador", href: "/compare", icon: <ClusterOutlined />, group: "Navegar" },
  { id: "nav-bib", label: "Bibliografía", href: "/bibliography", icon: <BookOutlined />, group: "Navegar" },
  { id: "nav-time", label: "Línea de tiempo", href: "/timeline", icon: <RadarChartOutlined />, group: "Navegar" },
  { id: "nav-graph", label: "Grafo de conexiones", href: "/graph", icon: <NodeIndexOutlined />, group: "Navegar" },
  { id: "nav-cov", label: "Cobertura temática", href: "/coverage", icon: <HeatMapOutlined />, group: "Navegar" },
  { id: "nav-ent", label: "Entidades", href: "/entities", icon: <UserOutlined />, group: "Navegar" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (href: string) => void;
}

export function CommandPalette({ open, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [dynamicItems, setDynamicItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { token } = theme.useToken();
  const inputRef = useRef<{ focus: () => void } | null>(null);
  const fetchAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Búsqueda dinámica en docs/preguntas/producciones
  useEffect(() => {
    if (!query || query.length < 2) {
      setDynamicItems([]);
      setLoading(false);
      return;
    }
    fetchAbort.current?.abort();
    const ctrl = new AbortController();
    fetchAbort.current = ctrl;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/global?q=${encodeURIComponent(query)}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) {
          setDynamicItems([]);
          return;
        }
        const data = await res.json();
        const items: Item[] = [];
        for (const d of data.documents ?? []) {
          items.push({
            id: `doc-${d.id}`,
            label: d.title || d.filename,
            hint: `${d.pageCount ?? 0} pp · documento`,
            href: `/documents/${d.id}`,
            icon: <FileTextOutlined />,
            group: "Documentos",
          });
        }
        for (const q of data.questions ?? []) {
          items.push({
            id: `q-${q.id}`,
            label: q.pregunta,
            hint: q.periodoNombre,
            href: `/questions?focus=${q.id}`,
            icon: <BookOutlined />,
            group: "Preguntas",
          });
        }
        for (const p of data.producciones ?? []) {
          items.push({
            id: `p-${p.id}`,
            label: p.title,
            hint: p.templateName,
            href: `/producciones/${p.id}`,
            icon: <AppstoreOutlined />,
            group: "Producciones",
          });
        }
        setDynamicItems(items);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setDynamicItems([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? STATIC_ITEMS.filter(
          (i) =>
            i.label.toLowerCase().includes(q) ||
            i.href.toLowerCase().includes(q),
        )
      : STATIC_ITEMS;
    return [...filtered, ...dynamicItems];
  }, [query, dynamicItems]);

  const groups = useMemo(() => {
    const out = new Map<string, Item[]>();
    for (const it of items) {
      const arr = out.get(it.group) ?? [];
      arr.push(it);
      out.set(it.group, arr);
    }
    return out;
  }, [items]);

  // Reset selección al filtrar
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[selectedIndex];
      if (item) onNavigate(item.href);
    }
  };

  let runningIndex = -1;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      maskClosable
      destroyOnClose
      width={640}
      style={{ top: 96 }}
      bodyStyle={{ padding: 0 }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Input
          ref={(r) => {
            inputRef.current = r;
          }}
          variant="borderless"
          placeholder="Buscar documentos, preguntas, producciones…"
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          suffix={loading ? <Spin size="small" /> : null}
        />
      </div>

      <div style={{ maxHeight: 460, overflowY: "auto", padding: "8px 0" }}>
        {items.length === 0 ? (
          <div style={{ padding: 40 }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={query ? "Sin resultados" : "Escribe para buscar"}
            />
          </div>
        ) : (
          Array.from(groups.entries()).map(([group, list]) => (
            <div key={group} style={{ marginBottom: 8 }}>
              <div
                style={{
                  padding: "6px 16px",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: token.colorTextTertiary,
                  fontWeight: 600,
                }}
              >
                {group}
              </div>
              {list.map((it) => {
                runningIndex += 1;
                const active = runningIndex === selectedIndex;
                return (
                  <div
                    key={it.id}
                    onMouseEnter={() => setSelectedIndex(runningIndex)}
                    onClick={() => onNavigate(it.href)}
                    style={{
                      padding: "8px 16px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      background: active ? token.colorFillSecondary : "transparent",
                      borderLeft: `2px solid ${active ? token.colorPrimary : "transparent"}`,
                    }}
                  >
                    <span style={{ color: token.colorTextSecondary, fontSize: 16 }}>
                      {it.icon}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          color: token.colorText,
                          fontSize: 13,
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {it.label}
                      </div>
                      {it.hint && (
                        <div
                          style={{
                            fontSize: 11,
                            color: token.colorTextTertiary,
                            marginTop: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {it.hint}
                        </div>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div
        style={{
          padding: "8px 16px",
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          fontSize: 11,
          color: token.colorTextTertiary,
          display: "flex",
          gap: 16,
          background: token.colorFillQuaternary,
        }}
      >
        <span><kbd>↑↓</kbd> navegar</span>
        <span><kbd>⏎</kbd> abrir</span>
        <span><kbd>esc</kbd> cerrar</span>
      </div>
    </Modal>
  );
}
