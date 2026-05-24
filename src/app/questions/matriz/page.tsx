"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  Typography,
  Tag,
  Space,
  Button,
  Select,
  theme,
  App,
  Empty,
  Skeleton,
  Checkbox,
  Tooltip,
  Tabs,
  Badge,
} from "antd";
import {
  ArrowLeftOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  SyncOutlined,
  ClockCircleOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { getPeriodColor, getCategoryColor } from "@/lib/theme";

const { Title, Text, Paragraph } = Typography;

type CellStatus = "PENDING" | "GENERATING" | "COMPLETE" | "ERROR" | null;

interface Template {
  id: string;
  name: string;
  category: string;
  icon: string;
}

interface MatrixRow {
  id: string;
  pregunta: string;
  periodoCode: string;
  periodoNombre: string;
  categoriaCode: string;
  categoriaNombre: string;
  subcategoriaCode: string;
  documentId: string;
  documentFilename: string;
  completedCount: number;
  stateLabel: "complete" | "partial" | "pending";
  byTemplate: Record<string, { deliverableId: string; status: CellStatus } | null>;
}

interface MatrixResponse {
  templates: Template[];
  totalTemplates: number;
  rows: MatrixRow[];
  counts: { all: number; complete: number; partial: number; pending: number };
}

export default function MatrixPage() {
  return (
    <Suspense fallback={<div className="app-page"><Skeleton active /></div>}>
      <MatrixContent />
    </Suspense>
  );
}

function MatrixContent() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [data, setData] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState<"all" | "pending" | "partial" | "complete">("all");
  const [documentId, setDocumentId] = useState<string>("");
  const [docs, setDocs] = useState<Array<{ id: string; filename: string }>>([]);
  const [selectedQs, setSelectedQs] = useState<Set<string>>(new Set());
  const [selectedTpls, setSelectedTpls] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/documents?limit=300")
      .then((r) => r.json())
      .then((d) => setDocs(d.documents ?? []))
      .catch(console.error);
  }, []);

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (documentId) p.set("documentId", documentId);
      if (stateFilter !== "all") p.set("status", stateFilter);
      const res = await fetch(`/api/questions/matrix?${p}`);
      const json = (await res.json()) as MatrixResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [documentId, stateFilter]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  useEffect(() => {
    setSelectedQs(new Set());
  }, [documentId, stateFilter]);

  const togQ = (id: string) => {
    setSelectedQs((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const togT = (id: string) => {
    setSelectedTpls((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const cellsToGenerate = useMemo(() => {
    if (!data) return 0;
    let count = 0;
    for (const qId of selectedQs) {
      const row = data.rows.find((r) => r.id === qId);
      if (!row) continue;
      for (const tId of selectedTpls) {
        const cell = row.byTemplate[tId];
        if (!cell || cell.status === "PENDING" || cell.status === "ERROR") count++;
      }
    }
    return count;
  }, [selectedQs, selectedTpls, data]);

  const submit = async () => {
    if (cellsToGenerate === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/deliverables/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIds: Array.from(selectedQs),
          templateIds: Array.from(selectedTpls),
        }),
      });
      if (!res.ok) throw new Error("HTTP error");
      message.success(`Generación encolada (${cellsToGenerate} producciones)`);
      setSelectedQs(new Set());
      setSelectedTpls(new Set());
      setTimeout(fetchMatrix, 1500);
    } catch {
      message.error("Error al encolar producciones");
    } finally {
      setSubmitting(false);
    }
  };

  const renderCell = (status: CellStatus) => {
    if (!status || status === "PENDING")
      return <ClockCircleOutlined style={{ color: token.colorTextTertiary }} />;
    if (status === "GENERATING")
      return <SyncOutlined spin style={{ color: token.colorPrimary }} />;
    if (status === "COMPLETE")
      return <CheckCircleFilled style={{ color: token.colorSuccess }} />;
    if (status === "ERROR")
      return <CloseCircleFilled style={{ color: token.colorError }} />;
    return null;
  };

  return (
    <div className="app-page-wide">
      <Link href="/questions">
        <Button type="text" icon={<ArrowLeftOutlined />} style={{ marginBottom: 12 }}>
          Volver a preguntas
        </Button>
      </Link>

      <Title level={2} className="serif-title" style={{ margin: 0 }}>
        <TableOutlined /> Matriz de producción
      </Title>
      <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 24px", maxWidth: 800 }}>
        Selecciona preguntas (filas) y templates (columnas) para generar producciones masivamente.
        Cada celda muestra el estado de ese par pregunta×template.
      </Paragraph>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={12}>
          <Select
            allowClear
            placeholder="Filtrar por documento"
            style={{ width: 280 }}
            value={documentId || undefined}
            onChange={(v) => setDocumentId(v ?? "")}
            showSearch
            optionFilterProp="label"
            options={docs.map((d) => ({ value: d.id, label: d.filename }))}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchMatrix}>Recargar</Button>
          {cellsToGenerate > 0 && (
            <Badge count={cellsToGenerate} offset={[-6, 6]}>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={submitting}
                onClick={submit}
              >
                Producir {cellsToGenerate} producciones
              </Button>
            </Badge>
          )}
        </Space>
      </Card>

      <Tabs
        activeKey={stateFilter}
        onChange={(k) => setStateFilter(k as typeof stateFilter)}
        items={[
          { key: "all", label: `Todas (${data?.counts.all ?? 0})` },
          { key: "pending", label: `Sin producción (${data?.counts.pending ?? 0})` },
          { key: "partial", label: `Parciales (${data?.counts.partial ?? 0})` },
          { key: "complete", label: `Completas (${data?.counts.complete ?? 0})` },
        ]}
      />

      {loading ? (
        <Card><Skeleton active paragraph={{ rows: 12 }} /></Card>
      ) : !data || data.rows.length === 0 ? (
        <Card>
          <Empty description="Sin preguntas con estos filtros" />
        </Card>
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 800, width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: token.colorFillQuaternary, borderBottom: `2px solid ${token.colorBorderSecondary}` }}>
                  <th style={{ padding: "10px 8px", fontSize: 12, textAlign: "center", borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                    <Checkbox
                      checked={selectedQs.size === data.rows.length && data.rows.length > 0}
                      indeterminate={selectedQs.size > 0 && selectedQs.size < data.rows.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedQs(new Set(data.rows.map((r) => r.id)));
                        else setSelectedQs(new Set());
                      }}
                    />
                  </th>
                  <th style={{ padding: "10px 8px", fontSize: 12, width: "30%", textAlign: "left", color: token.colorTextSecondary }}>Pregunta</th>
                  {data.templates.map((t) => (
                    <th key={t.id} style={{ padding: "10px 8px", fontSize: 12, width: 90, textAlign: "center", color: token.colorTextSecondary }}>
                      <Space vertical size={4}>
                        <Checkbox
                          checked={selectedTpls.has(t.id)}
                          onChange={() => togT(t.id)}
                        />
                        <Tooltip title={t.name}>
                          <div style={{ fontSize: 18 }}>{t.icon}</div>
                        </Tooltip>
                        <Text style={{ fontSize: 10, color: token.colorTextSecondary, display: "block", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.name}
                        </Text>
                      </Space>
                    </th>
                  ))}
                  <th style={{ padding: "10px 8px", fontSize: 12, width: 80, textAlign: "center", color: token.colorTextSecondary }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const periodColor = getPeriodColor(row.periodoCode);
                  const categoryColor = getCategoryColor(row.categoriaCode);
                  const selected = selectedQs.has(row.id);
                  return (
                    <tr
                      key={row.id}
                      style={{
                        background: selected ? `${token.colorPrimary}08` : "transparent",
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      }}
                    >
                      <td style={{ padding: "10px 8px", textAlign: "center" }}>
                        <Checkbox checked={selected} onChange={() => togQ(row.id)} />
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <Space vertical size={4} style={{ maxWidth: 480 }}>
                          <Text style={{ fontSize: 13, lineHeight: 1.45 }}>{row.pregunta}</Text>
                          <Space size={4} wrap>
                            <Tag style={{ background: `${periodColor}1A`, border: "none", color: periodColor, fontSize: 10, margin: 0 }}>
                              {row.periodoNombre}
                            </Tag>
                            <Tag style={{ background: `${categoryColor}1A`, border: "none", color: categoryColor, fontSize: 10, margin: 0 }}>
                              {row.categoriaNombre}
                            </Tag>
                          </Space>
                        </Space>
                      </td>
                      {data.templates.map((t) => {
                        const cell = row.byTemplate[t.id];
                        const isProducible =
                          selected &&
                          selectedTpls.has(t.id) &&
                          (!cell || cell.status === "PENDING" || cell.status === "ERROR");
                        return (
                          <td
                            key={t.id}
                            style={{
                              padding: "10px 8px",
                              textAlign: "center",
                              background: isProducible ? `${token.colorPrimary}1A` : "transparent",
                            }}
                          >
                            {cell?.deliverableId && cell.status === "COMPLETE" ? (
                              <Link href={`/producciones/${cell.deliverableId}`}>
                                {renderCell(cell.status)}
                              </Link>
                            ) : (
                              renderCell(cell?.status ?? null)
                            )}
                          </td>
                        );
                      })}
                      <td style={{ padding: "10px 8px", textAlign: "center" }}>
                        <Text style={{ fontSize: 12, color: row.completedCount > 0 ? token.colorSuccess : token.colorTextTertiary }}>
                          {row.completedCount}/{data.totalTemplates}
                        </Text>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
