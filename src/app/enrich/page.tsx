"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  Typography,
  Tag,
  Space,
  Button,
  Input,
  Select,
  Progress,
  Empty,
  theme,
  App,
  Form,
  Row,
  Col,
  Tabs,
  Tooltip,
  Skeleton,
  Collapse,
  Alert,
} from "antd";
import {
  ExperimentOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  CheckCircleFilled,
  FileTextOutlined,
  SearchOutlined,
  PlusOutlined,
  CloseOutlined,
  BookOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import { getDocumentDisplayName, type EnrichmentMetadata } from "@/lib/enrichment-types";
import { PERIOD_OPTIONS, CATEGORY_OPTIONS } from "@/lib/taxonomy";
import { getPeriodColor, getCategoryColor } from "@/lib/theme";

const { Title, Text, Paragraph } = Typography;

interface DocumentSummary {
  id: string;
  filename: string;
  enriched: boolean;
  metadata: EnrichmentMetadata;
  status: string;
  _count: { chunks: number; questions?: number };
}

interface DocumentDetail extends DocumentSummary {
  chunks: Array<{ id: string; content: string; pageNumber: number; chunkIndex: number }>;
}

export default function EnrichPage() {
  return (
    <Suspense fallback={<div className="app-page-wide"><Skeleton active /></div>}>
      <EnrichContent />
    </Suspense>
  );
}

function EnrichContent() {
  const params = useSearchParams();
  const { token } = theme.useToken();
  const { message } = App.useApp();

  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "enriched" | "pending">("all");
  const [batchRunning, setBatchRunning] = useState(false);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents?limit=500&status=READY");
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch (e) {
      console.error(e);
      message.error("Error al cargar documentos");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Preselect via ?docId
  useEffect(() => {
    const docId = params.get("docId");
    if (docId) setSelectedId(docId);
  }, [params]);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/documents/${id}`);
      const data = await res.json();
      setDetail(data.document);
    } catch {
      message.error("Error al cargar documento");
    } finally {
      setLoadingDetail(false);
    }
  }, [message]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const filtered = useMemo(() => {
    let list = docs;
    if (filter === "enriched") list = list.filter((d) => d.enriched);
    else if (filter === "pending") list = list.filter((d) => !d.enriched);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((d) => {
        const name = getDocumentDisplayName(d).toLowerCase();
        return name.includes(q) || d.filename.toLowerCase().includes(q);
      });
    }
    return list;
  }, [docs, search, filter]);

  const enrichedCount = docs.filter((d) => d.enriched).length;
  const enrichmentPct = docs.length ? Math.round((enrichedCount / docs.length) * 100) : 0;
  const pendingCount = docs.length - enrichedCount;

  const runBatchEnrich = async () => {
    setBatchRunning(true);
    const pending = docs.filter((d) => !d.enriched);
    message.info(`Iniciando enriquecimiento de ${pending.length} documentos…`);
    let success = 0;
    for (const doc of pending) {
      try {
        await fetch(`/api/documents/${doc.id}/enrich`, { method: "POST" });
        success++;
      } catch {
        /* keep going */
      }
    }
    message.success(`${success} de ${pending.length} documentos enriquecidos`);
    setBatchRunning(false);
    loadDocs();
  };

  return (
    <div className="app-page-wide">
      <div style={{ marginBottom: 24 }}>
        <Title level={2} className="serif-title" style={{ margin: 0 }}>
          Enriquecer documentos
        </Title>
        <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 0" }}>
          Metadata bibliográfica, clasificación temporal/temática y resumen — con IA o manual.
        </Paragraph>
      </div>

      <Card bordered style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col xs={24} md={10}>
            <Space direction="vertical" size={4} style={{ width: "100%" }}>
              <Text style={{ fontSize: 12, color: token.colorTextTertiary }}>
                Cobertura de enriquecimiento
              </Text>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <Text style={{ fontSize: 26, fontWeight: 600 }}>{enrichmentPct}%</Text>
                <Text type="secondary">
                  {enrichedCount} de {docs.length} documentos
                </Text>
              </div>
              <Progress percent={enrichmentPct} showInfo={false} strokeColor={token.colorPrimary} />
            </Space>
          </Col>
          <Col xs={24} md={14} style={{ textAlign: "right" }}>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadDocs}>Recargar</Button>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={batchRunning}
                disabled={pendingCount === 0}
                onClick={runBatchEnrich}
              >
                Enriquecer {pendingCount} con IA
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={selectedId ? 8 : 24}>
          <Card
            bordered
            title={
              <Space>
                <FileTextOutlined />
                <span>Documentos</span>
                <Tag>{filtered.length}</Tag>
              </Space>
            }
            bodyStyle={{ padding: 0 }}
          >
            <div style={{ padding: 12, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="Buscar…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Select
                  style={{ width: "100%" }}
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "all", label: `Todos (${docs.length})` },
                    { value: "pending", label: `Pendientes (${pendingCount})` },
                    { value: "enriched", label: `Enriquecidos (${enrichedCount})` },
                  ]}
                />
              </Space>
            </div>

            <div style={{ maxHeight: 600, overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: 16 }}><Skeleton active /></div>
              ) : filtered.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin documentos" style={{ padding: 30 }} />
              ) : (
                filtered.map((doc) => {
                  const periodCode = doc.metadata?.primaryPeriod;
                  const color = periodCode ? getPeriodColor(periodCode) : token.colorTextTertiary;
                  const selected = doc.id === selectedId;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedId(doc.id)}
                      style={{
                        padding: "10px 14px",
                        cursor: "pointer",
                        background: selected ? token.colorFillSecondary : "transparent",
                        borderLeft: `3px solid ${selected ? color : "transparent"}`,
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                        transition: "background 0.15s",
                      }}
                    >
                      <Space style={{ width: "100%", justifyContent: "space-between" }}>
                        <Space size={10} style={{ minWidth: 0 }}>
                          <FileTextOutlined style={{ color }} />
                          <div style={{ minWidth: 0 }}>
                            <Text
                              strong
                              ellipsis
                              style={{ display: "block", fontSize: 13, color: token.colorText }}
                            >
                              {getDocumentDisplayName(doc)}
                            </Text>
                            <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>
                              {doc._count.chunks} chunks
                            </Text>
                          </div>
                        </Space>
                        {doc.enriched ? (
                          <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 14 }} />
                        ) : (
                          <Tag style={{ fontSize: 10, margin: 0 }}>—</Tag>
                        )}
                      </Space>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </Col>

        {selectedId && (
          <Col xs={24} lg={16}>
            {loadingDetail || !detail ? (
              <Card bordered><Skeleton active paragraph={{ rows: 8 }} /></Card>
            ) : (
              <EnrichmentEditor
                key={detail.id}
                doc={detail}
                onSaved={() => {
                  loadDocs();
                  loadDetail(detail.id);
                }}
                onClose={() => setSelectedId(null)}
              />
            )}
          </Col>
        )}
      </Row>
    </div>
  );
}

function EnrichmentEditor({
  doc,
  onSaved,
  onClose,
}: {
  doc: DocumentDetail;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [keywords, setKeywords] = useState<string[]>(doc.metadata?.keywords ?? []);
  const [newKw, setNewKw] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      bookTitle: doc.metadata?.bookTitle,
      author: doc.metadata?.author,
      isbn: doc.metadata?.isbn,
      pageCount: doc.metadata?.pageCount,
      publisher: doc.metadata?.publisher,
      publicationYear: doc.metadata?.publicationYear,
      edition: doc.metadata?.edition,
      summary: doc.metadata?.summary,
      primaryPeriod: doc.metadata?.primaryPeriod,
      secondaryPeriod: doc.metadata?.secondaryPeriod,
      primaryCategory: doc.metadata?.primaryCategory,
      secondaryCategory: doc.metadata?.secondaryCategory,
    });
    setKeywords(doc.metadata?.keywords ?? []);
  }, [doc.id, doc.metadata, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = { ...values, keywords };
      const res = await fetch(`/api/documents/${doc.id}/enrich`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: payload }),
      });
      if (!res.ok) throw new Error("Save failed");
      message.success("Metadata guardada");
      onSaved();
    } catch (e) {
      console.error(e);
      message.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleAI = async () => {
    setAiRunning(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/enrich`, { method: "POST" });
      if (!res.ok) throw new Error("AI failed");
      message.success("Documento enriquecido con IA");
      onSaved();
    } catch {
      message.error("Error al enriquecer con IA");
    } finally {
      setAiRunning(false);
    }
  };

  const addKw = () => {
    const k = newKw.trim();
    if (k && !keywords.includes(k)) {
      setKeywords([...keywords, k]);
      setNewKw("");
    }
  };

  return (
    <Card
      bordered
      title={
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} size="small" onClick={onClose} />
          <Space direction="vertical" size={0}>
            <Text strong className="serif-title" style={{ fontSize: 16 }}>
              {getDocumentDisplayName(doc)}
            </Text>
            {doc.enriched && <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>✓ Enriquecido</Tag>}
          </Space>
        </Space>
      }
      extra={
        <Space>
          <Link href={`/documents/${doc.id}`}>
            <Button icon={<FileTextOutlined />} size="small">Ver documento</Button>
          </Link>
          <Link href={`/questions/generate?documentId=${doc.id}`}>
            <Button icon={<BookOutlined />} size="small">Generar preguntas</Button>
          </Link>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        message={
          <Space>
            <RocketOutlined />
            <span>
              Usa <strong>Enriquecer con IA</strong> para extraer automáticamente bibliografía, periodo, categoría y resumen desde los primeros chunks. Después puedes ajustar a mano.
            </span>
          </Space>
        }
        action={
          <Button size="small" type="primary" icon={<ThunderboltOutlined />} loading={aiRunning} onClick={handleAI}>
            Enriquecer con IA
          </Button>
        }
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical">
        <Collapse
          defaultActiveKey={["bibliography", "classification", "summary"]}
          ghost
          items={[
            {
              key: "bibliography",
              label: <Text strong>Bibliografía</Text>,
              children: (
                <Row gutter={12}>
                  <Col xs={24}><Form.Item name="bookTitle" label="Título del libro"><Input /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="author" label="Autor"><Input /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="publisher" label="Editorial"><Input /></Form.Item></Col>
                  <Col xs={8}><Form.Item name="publicationYear" label="Año"><Input type="number" /></Form.Item></Col>
                  <Col xs={8}><Form.Item name="edition" label="Edición"><Input /></Form.Item></Col>
                  <Col xs={8}><Form.Item name="isbn" label="ISBN"><Input /></Form.Item></Col>
                  <Col xs={12}><Form.Item name="pageCount" label="Total de páginas"><Input type="number" /></Form.Item></Col>
                </Row>
              ),
            },
            {
              key: "classification",
              label: <Text strong>Clasificación histórica</Text>,
              children: (
                <Row gutter={12}>
                  <Col xs={24} md={12}>
                    <Form.Item name="primaryPeriod" label="Periodo primario">
                      <Select
                        allowClear
                        placeholder="Selecciona periodo…"
                        showSearch
                        optionFilterProp="label"
                        options={PERIOD_OPTIONS.map((p) => ({
                          value: p.code,
                          label: `${p.nombre} (${p.rango})`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="secondaryPeriod" label="Periodo secundario (opcional)">
                      <Select
                        allowClear
                        placeholder="Selecciona…"
                        showSearch
                        optionFilterProp="label"
                        options={PERIOD_OPTIONS.map((p) => ({
                          value: p.code,
                          label: `${p.nombre} (${p.rango})`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="primaryCategory" label="Categoría primaria">
                      <Select
                        allowClear
                        placeholder="Selecciona categoría…"
                        showSearch
                        optionFilterProp="label"
                        options={CATEGORY_OPTIONS.map((c) => ({ value: c.code, label: c.nombre }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="secondaryCategory" label="Categoría secundaria (opcional)">
                      <Select
                        allowClear
                        placeholder="Selecciona…"
                        showSearch
                        optionFilterProp="label"
                        options={CATEGORY_OPTIONS.map((c) => ({ value: c.code, label: c.nombre }))}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              ),
            },
            {
              key: "summary",
              label: <Text strong>Resumen y palabras clave</Text>,
              children: (
                <>
                  <Form.Item name="summary" label="Resumen">
                    <Input.TextArea
                      rows={5}
                      placeholder="Síntesis del contenido — periodo, tesis principal, enfoque metodológico, contexto."
                      style={{ fontFamily: "var(--font-serif)", fontSize: 14 }}
                    />
                  </Form.Item>
                  <Form.Item label="Palabras clave">
                    <Space.Compact style={{ width: "100%", marginBottom: 8 }}>
                      <Input
                        placeholder="Añade una keyword…"
                        value={newKw}
                        onChange={(e) => setNewKw(e.target.value)}
                        onPressEnter={(e) => { e.preventDefault(); addKw(); }}
                      />
                      <Button icon={<PlusOutlined />} onClick={addKw}>Añadir</Button>
                    </Space.Compact>
                    <Space wrap>
                      {keywords.length === 0 ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>Sin keywords aún.</Text>
                      ) : (
                        keywords.map((k) => (
                          <Tag
                            key={k}
                            closable
                            onClose={() => setKeywords(keywords.filter((x) => x !== k))}
                            closeIcon={<CloseOutlined />}
                            style={{ padding: "2px 8px" }}
                          >
                            {k}
                          </Tag>
                        ))
                      )}
                    </Space>
                  </Form.Item>
                </>
              ),
            },
          ]}
        />
      </Form>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          Guardar
        </Button>
      </div>
    </Card>
  );
}
