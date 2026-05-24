"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  Table,
  Typography,
  Tag,
  Space,
  Button,
  Input,
  Select,
  Tooltip,
  App,
  theme,
  Segmented,
  Skeleton,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  FileTextOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
  CloudUploadOutlined,
  ExperimentOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  LoadingOutlined,
  CloseCircleFilled,
} from "@ant-design/icons";
import dayjs from "@/lib/dayjs-config";
import { getDocumentDisplayName, type EnrichmentMetadata } from "@/lib/enrichment-types";
import { getPeriodColor } from "@/lib/theme";
import { getPeriodByCode } from "@/lib/taxonomy";
import { useUrlFilters } from "@/lib/use-url-state";

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const { Title, Text, Paragraph } = Typography;

interface DocumentRow {
  id: string;
  filename: string;
  fileSize: number;
  pageCount: number;
  status: string;
  createdAt: string;
  enriched: boolean;
  metadata: EnrichmentMetadata;
  _count: { chunks: number };
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  PENDING: { color: "default", label: "Pendiente", icon: <ClockCircleFilled /> },
  PROCESSING: { color: "processing", label: "Procesando", icon: <LoadingOutlined /> },
  READY: { color: "success", label: "Listo", icon: <CheckCircleFilled /> },
  ERROR: { color: "error", label: "Error", icon: <CloseCircleFilled /> },
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="app-page-wide"><Skeleton active /></div>}>
      <DocumentsContent />
    </Suspense>
  );
}

function DocumentsContent() {
  const { token } = theme.useToken();
  const { modal, message } = App.useApp();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [filters, updateFilters, resetFilters] = useUrlFilters({
    search: "",
    status: "",
    enriched: "",
    view: "table",
    page: "1",
    pageSize: "20",
  });

  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.max(10, Number(filters.pageSize) || 20);

  const [refreshTick, setRefreshTick] = useState(0);
  const fetchDocuments = () => setRefreshTick((n) => n + 1);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
        if (filters.status) params.set("status", filters.status);
        if (filters.enriched) params.set("enriched", filters.enriched);
        if (filters.search) params.set("search", filters.search);
        const res = await fetch(`/api/documents?${params}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (ctrl.signal.aborted) return;
        setDocuments(data.documents ?? []);
        setTotal(data.pagination?.total ?? 0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error(e);
          message.error("Error al cargar documentos");
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [page, pageSize, filters.status, filters.enriched, filters.search, refreshTick, message]);

  // Auto-refresh mientras procesa
  useEffect(() => {
    if (!documents.some((d) => d.status === "PROCESSING")) return;
    const id = setInterval(() => setRefreshTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, [documents]);

  // Filtrado local complementario (sin acentos) — el server ya filtra search,
  // pero esto pule resultados si el server hace LIKE simple.
  const filtered = useMemo(() => {
    const q = stripDiacritics(filters.search.trim());
    if (!q) return documents;
    return documents.filter((d) => {
      const display = stripDiacritics(getDocumentDisplayName(d));
      const file = stripDiacritics(d.filename);
      const author = d.metadata?.author ? stripDiacritics(d.metadata.author) : "";
      return display.includes(q) || file.includes(q) || author.includes(q);
    });
  }, [documents, filters.search]);


  const handleDelete = (id: string, name: string) => {
    modal.confirm({
      title: "Eliminar documento",
      content: (
        <span>
          ¿Eliminar <strong>{name}</strong> y todos sus chunks? Esta acción no se puede deshacer.
        </span>
      ),
      okText: "Eliminar",
      okButtonProps: { danger: true },
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await fetch(`/api/documents/${id}`, { method: "DELETE" });
          message.success("Documento eliminado");
          fetchDocuments();
        } catch {
          message.error("Error al eliminar");
        }
      },
    });
  };

  const columns: ColumnsType<DocumentRow> = [
    {
      title: "Documento",
      dataIndex: "filename",
      key: "filename",
      width: 360,
      ellipsis: true,
      render: (_v, doc) => {
        const display = getDocumentDisplayName(doc);
        const periodCode = doc.metadata?.primaryPeriod;
        const period = periodCode ? getPeriodByCode(periodCode) : undefined;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: periodCode ? `${getPeriodColor(periodCode)}1A` : token.colorFillSecondary,
                color: periodCode ? getPeriodColor(periodCode) : token.colorTextSecondary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              <FileTextOutlined />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Link href={`/documents/${doc.id}`}>
                <Tooltip title={display} placement="topLeft">
                  <Text
                    strong
                    style={{
                      color: token.colorText,
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {display}
                  </Text>
                </Tooltip>
              </Link>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: token.colorTextTertiary, marginTop: 2 }}>
                {doc.metadata?.author && (
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
                    {doc.metadata.author}
                  </span>
                )}
                {period && (
                  <Tag
                    style={{
                      background: `${getPeriodColor(period.code)}1A`,
                      border: "none",
                      color: getPeriodColor(period.code),
                      fontSize: 10,
                      margin: 0,
                    }}
                  >
                    {period.nombre}
                  </Tag>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: "Estado",
      dataIndex: "status",
      key: "status",
      width: 140,
      filters: Object.entries(STATUS_CONFIG).map(([k, v]) => ({ text: v.label, value: k })),
      onFilter: (value, record) => record.status === value,
      render: (s: string) => {
        const cfg = STATUS_CONFIG[s] ?? STATUS_CONFIG.PENDING;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: "Chunks",
      dataIndex: ["_count", "chunks"],
      key: "chunks",
      width: 90,
      sorter: (a, b) => a._count.chunks - b._count.chunks,
      render: (n: number) => <Text style={{ fontFamily: "var(--font-mono)" }}>{n}</Text>,
    },
    {
      title: "Páginas",
      dataIndex: "pageCount",
      key: "pageCount",
      width: 90,
      sorter: (a, b) => a.pageCount - b.pageCount,
    },
    {
      title: "Tamaño",
      dataIndex: "fileSize",
      key: "size",
      width: 110,
      sorter: (a, b) => a.fileSize - b.fileSize,
      render: (n: number) => <Text type="secondary">{formatBytes(n)}</Text>,
    },
    {
      title: "Enriquecido",
      dataIndex: "enriched",
      key: "enriched",
      width: 120,
      filters: [{ text: "Sí", value: "true" }, { text: "No", value: "false" }],
      onFilter: (value, record) => String(record.enriched) === value,
      render: (e: boolean) =>
        e ? <Tag color="purple">✓ Sí</Tag> : <Tag>—</Tag>,
    },
    {
      title: "Cargado",
      dataIndex: "createdAt",
      key: "date",
      width: 110,
      sorter: (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
      render: (d: string) => (
        <Tooltip title={dayjs(d).format("DD MMM YYYY HH:mm")}>
          <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(d).format("DD MMM")}</Text>
        </Tooltip>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 110,
      align: "right",
      render: (_v, doc) => (
        <Space size={4}>
          <Tooltip title="Ver detalle">
            <Link href={`/documents/${doc.id}`}>
              <Button type="text" icon={<EyeOutlined />} size="small" />
            </Link>
          </Tooltip>
          <Tooltip title="Eliminar">
            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
              size="small"
              onClick={() => handleDelete(doc.id, getDocumentDisplayName(doc))}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="app-page-wide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <Title level={2} className="serif-title" style={{ margin: 0 }}>
            Documentos
          </Title>
          <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 0" }}>
            Corpus vectorizado. {total} documentos.
          </Paragraph>
        </div>
        <Space>
          <Link href="/enrich">
            <Button icon={<ExperimentOutlined />}>Enriquecer</Button>
          </Link>
          <Link href="/upload">
            <Button type="primary" icon={<CloudUploadOutlined />}>Cargar más</Button>
          </Link>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={12}>
          <Input
            allowClear
            placeholder="Buscar por título, autor…"
            prefix={<SearchOutlined />}
            style={{ width: 280 }}
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value, page: "1" })}
          />
          <Select
            allowClear
            placeholder="Estado"
            style={{ width: 140 }}
            value={filters.status || undefined}
            onChange={(v) => updateFilters({ status: v ?? "", page: "1" })}
            options={Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <Select
            allowClear
            placeholder="Enriquecimiento"
            style={{ width: 180 }}
            value={filters.enriched || undefined}
            onChange={(v) => updateFilters({ enriched: v ?? "", page: "1" })}
            options={[
              { value: "true", label: "Enriquecidos" },
              { value: "false", label: "Pendientes de enriquecer" },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchDocuments()}>Recargar</Button>
          {(filters.search || filters.status || filters.enriched) && (
            <Button type="text" onClick={resetFilters}>Limpiar filtros</Button>
          )}
          <Segmented
            value={filters.view}
            onChange={(v) => updateFilters({ view: String(v) })}
            options={[
              { value: "table", icon: <UnorderedListOutlined /> },
              { value: "grid", icon: <AppstoreOutlined /> },
            ]}
          />
        </Space>
      </Card>

      <Card styles={{ body: { padding: filters.view === "table" ? 0 : 16 } }}>
        {filters.view === "table" ? (
          <Table<DocumentRow>
            rowKey="id"
            dataSource={filtered}
            columns={columns}
            loading={loading}
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: (p, s) => {
                updateFilters({ page: String(p), pageSize: String(s) });
              },
              showSizeChanger: true,
              showTotal: (t) => `${t} documentos`,
              pageSizeOptions: ["10", "20", "50", "100"],
            }}
            scroll={{ x: 900 }}
          />
        ) : (
          <GridView documents={filtered} onDelete={handleDelete} />
        )}
      </Card>
    </div>
  );
}

function GridView({ documents, onDelete }: { documents: DocumentRow[]; onDelete: (id: string, name: string) => void }) {
  const { token } = theme.useToken();
  if (documents.length === 0) {
    return <div style={{ padding: 60, textAlign: "center", color: token.colorTextTertiary }}>Sin documentos</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
      {documents.map((doc) => {
        const display = getDocumentDisplayName(doc);
        const periodCode = doc.metadata?.primaryPeriod;
        const color = periodCode ? getPeriodColor(periodCode) : token.colorPrimary;
        const period = periodCode ? getPeriodByCode(periodCode) : undefined;
        const cfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.PENDING;

        return (
          <Card
            key={doc.id}
            hoverable
            styles={{ body: { padding: 16 } }}
            style={{ borderTop: `3px solid ${color}` }}
          >
            <Space vertical size={8} style={{ width: "100%" }}>
              <Space style={{ justifyContent: "space-between", width: "100%" }}>
                <FileTextOutlined style={{ color, fontSize: 22 }} />
                <Tag color={cfg.color} icon={cfg.icon} style={{ fontSize: 10 }}>{cfg.label}</Tag>
              </Space>
              <Link href={`/documents/${doc.id}`}>
                <Text strong style={{ fontSize: 14, color: token.colorText, display: "block", minHeight: 38 }}>
                  {display}
                </Text>
              </Link>
              {doc.metadata?.author && (
                <Text type="secondary" style={{ fontSize: 12 }}>{doc.metadata.author}</Text>
              )}
              {period && (
                <Tag style={{ background: `${color}1A`, border: "none", color, fontSize: 10, alignSelf: "flex-start" }}>
                  {period.nombre}
                </Tag>
              )}
              <Space split={<Text type="secondary">·</Text>} style={{ fontSize: 12, color: token.colorTextTertiary }}>
                <Text type="secondary">{doc._count.chunks} chunks</Text>
                <Text type="secondary">{doc.pageCount} pp</Text>
                <Text type="secondary">{formatBytes(doc.fileSize)}</Text>
              </Space>
              <Space style={{ justifyContent: "flex-end", width: "100%", marginTop: 4 }}>
                <Link href={`/documents/${doc.id}`}>
                  <Button size="small" icon={<EyeOutlined />}>Ver</Button>
                </Link>
                <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(doc.id, display)} />
              </Space>
            </Space>
          </Card>
        );
      })}
    </div>
  );
}
