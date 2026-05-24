"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  Typography,
  Tag,
  Space,
  Button,
  Tabs,
  Tooltip,
  Input,
  Empty,
  Skeleton,
  Progress,
  theme,
  Row,
  Col,
  Statistic,
  Modal,
  App,
  Segmented,
  Alert,
} from "antd";
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  FileTextOutlined,
  ApartmentOutlined,
  ReadOutlined,
  ExperimentOutlined,
  BookOutlined,
  SearchOutlined,
  DeleteOutlined,
  CopyOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { getDocumentDisplayName, type EnrichmentMetadata } from "@/lib/enrichment-types";
import { getPeriodColor, getCategoryColor } from "@/lib/theme";
import { getPeriodByCode, getCategoryByCode } from "@/lib/taxonomy";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Chunk {
  id: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  chunkSize: number;
  overlap: number;
  strategy: string;
  metadata: Record<string, unknown>;
}

interface DocumentDetail {
  id: string;
  filename: string;
  s3Url: string;
  fileSize: number;
  pageCount: number;
  status: string;
  enriched: boolean;
  metadata: EnrichmentMetadata;
  error?: string;
  createdAt: string;
  updatedAt: string;
  chunks: Chunk[];
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [readingMode, setReadingMode] = useState<"by-page" | "continuous">("by-page");

  useEffect(() => {
    let cancelled = false;
    async function fetchDoc() {
      try {
        const res = await fetch(`/api/documents/${id}`);
        const data = await res.json();
        if (!cancelled) setDoc(data.document);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDoc();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (doc?.status !== "PROCESSING") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/documents/${id}`);
      const data = await res.json();
      setDoc(data.document);
    }, 3000);
    return () => clearInterval(t);
  }, [doc?.status, id]);

  const filteredChunks = useMemo(() => {
    if (!doc) return [];
    const q = search.trim().toLowerCase();
    if (!q) return doc.chunks;
    return doc.chunks.filter((c) => c.content.toLowerCase().includes(q));
  }, [doc, search]);

  const chunksByPage = useMemo(() => {
    if (!doc) return [];
    const map = new Map<number, Chunk[]>();
    for (const c of doc.chunks) {
      const arr = map.get(c.pageNumber) ?? [];
      arr.push(c);
      map.set(c.pageNumber, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [doc]);

  const handleReprocess = () => {
    modal.confirm({
      title: "Reprocesar documento",
      content: "Esto regenera todos los chunks y embeddings. Las preguntas ya generadas se mantienen pero las citas pueden cambiar.",
      okText: "Reprocesar",
      onOk: async () => {
        setReprocessing(true);
        try {
          await fetch(`/api/documents/${id}/reprocess`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chunkSize: 3000, chunkOverlap: 750, strategy: "FIXED" }),
          });
          const res = await fetch(`/api/documents/${id}`);
          const data = await res.json();
          setDoc(data.document);
          message.success("Reprocesamiento iniciado");
        } catch {
          message.error("Error al reprocesar");
        } finally {
          setReprocessing(false);
        }
      },
    });
  };

  const handleDelete = () => {
    modal.confirm({
      title: "Eliminar documento",
      content: "¿Eliminar este documento y todos sus chunks y preguntas? Esta acción no se puede deshacer.",
      okText: "Eliminar",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await fetch(`/api/documents/${id}`, { method: "DELETE" });
          message.success("Documento eliminado");
          router.push("/documents");
        } catch {
          message.error("Error al eliminar");
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="app-page">
        <Skeleton active style={{ marginBottom: 24 }} />
        <Skeleton.Input active style={{ width: "100%", height: 200, marginBottom: 16 }} />
        <Skeleton paragraph={{ rows: 8 }} active />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="app-page" style={{ textAlign: "center" }}>
        <Empty description="Documento no encontrado" />
      </div>
    );
  }

  const display = getDocumentDisplayName(doc);
  const periodCode = doc.metadata?.primaryPeriod;
  const period = periodCode ? getPeriodByCode(periodCode) : undefined;
  const categoryCode = doc.metadata?.primaryCategory;
  const category = categoryCode ? getCategoryByCode(categoryCode) : undefined;
  const color = periodCode ? getPeriodColor(periodCode) : token.colorPrimary;

  return (
    <div className="app-page">
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.back()} style={{ marginBottom: 16 }}>
        Volver
      </Button>

      {/* Hero card */}
      <Card
        style={{
          marginBottom: 20,
          borderLeft: `4px solid ${color}`,
        }}
      >
        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} md={16}>
            <Space size={14} align="start">
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  background: `${color}1A`,
                  color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  flexShrink: 0,
                }}
              >
                <FileTextOutlined />
              </div>
              <Space vertical size={4} style={{ minWidth: 0 }}>
                <Title level={3} className="serif-title" style={{ margin: 0 }}>
                  {display}
                </Title>
                {doc.metadata?.bookTitle && doc.filename !== doc.metadata.bookTitle && (
                  <Text type="secondary" style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>
                    {doc.filename}
                  </Text>
                )}
                {doc.metadata?.author && (
                  <Text style={{ fontSize: 14, color: token.colorTextSecondary }}>
                    {doc.metadata.author}
                    {doc.metadata.publicationYear && <> · {doc.metadata.publicationYear}</>}
                    {doc.metadata.publisher && <> · {doc.metadata.publisher}</>}
                  </Text>
                )}
                <Space size={6} wrap style={{ marginTop: 6 }}>
                  {period && (
                    <Tag style={{ background: `${color}1A`, border: "none", color, fontSize: 11 }}>
                      {period.nombre} · {period.rango}
                    </Tag>
                  )}
                  {category && (
                    <Tag
                      style={{
                        background: `${getCategoryColor(category.code)}1A`,
                        border: "none",
                        color: getCategoryColor(category.code),
                        fontSize: 11,
                      }}
                    >
                      {category.nombre}
                    </Tag>
                  )}
                  {doc.enriched && <Tag color="purple">✓ Enriquecido</Tag>}
                </Space>
              </Space>
            </Space>
          </Col>
          <Col xs={24} md={8}>
            <Space vertical size={8} align="end" style={{ width: "100%" }}>
              <Space wrap>
                <Link href={`/enrich?docId=${doc.id}`}>
                  <Button icon={<ExperimentOutlined />}>Enriquecer</Button>
                </Link>
                <Link href={`/questions?documentId=${doc.id}`}>
                  <Button icon={<BookOutlined />}>Ver preguntas</Button>
                </Link>
                <Button
                  icon={<ReloadOutlined />}
                  loading={reprocessing}
                  onClick={handleReprocess}
                  disabled={doc.status === "PROCESSING"}
                >
                  Reprocesar
                </Button>
                <Button icon={<DeleteOutlined />} danger onClick={handleDelete}>
                  Eliminar
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>

        {doc.error && (
          <Alert
            type="error"
            showIcon
            message={doc.error}
            style={{ marginTop: 16 }}
          />
        )}

        {doc.status === "PROCESSING" && (
          <Alert
            type="info"
            showIcon
            message="Procesamiento en curso"
            description="Los chunks y embeddings se están generando. La página se actualizará automáticamente."
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: 16 } }}>
            <Statistic title="Páginas" value={doc.pageCount} prefix={<ReadOutlined style={{ color: token.colorTextTertiary }} />} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: 16 } }}>
            <Statistic title="Chunks" value={doc.chunks.length} prefix={<ApartmentOutlined style={{ color: token.colorTextTertiary }} />} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: 16 } }}>
            <Statistic title="Tamaño" value={formatBytes(doc.fileSize)} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: 16 } }}>
            <Statistic title="Cargado" value={dayjs(doc.createdAt).format("DD MMM YY")} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "overview",
              label: <span><InfoCircleOutlined /> Resumen</span>,
              children: <OverviewTab doc={doc} />,
            },
            {
              key: "reading",
              label: <span><ReadOutlined /> Lectura inmersiva</span>,
              children: (
                <ReadingTab
                  chunksByPage={chunksByPage}
                  mode={readingMode}
                  onModeChange={setReadingMode}
                />
              ),
            },
            {
              key: "chunks",
              label: (
                <span>
                  <ApartmentOutlined /> Chunks
                  <Tag style={{ marginLeft: 6 }}>{doc.chunks.length}</Tag>
                </span>
              ),
              children: <ChunksTab chunks={filteredChunks} search={search} onSearch={setSearch} />,
            },
          ]}
        />
      </Card>
    </div>
  );
}

function OverviewTab({ doc }: { doc: DocumentDetail }) {
  const { token } = theme.useToken();
  const m = doc.metadata ?? {};
  const summary = typeof m.summary === "string" ? m.summary : null;
  const keywords = Array.isArray(m.keywords) ? m.keywords : [];
  return (
    <div>
      {summary ? (
        <Card style={{ marginBottom: 16, background: token.colorFillQuaternary }}>
          <Text type="secondary" style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Resumen
          </Text>
          <Paragraph style={{ marginTop: 8, fontFamily: "var(--font-serif)", fontSize: 15, lineHeight: 1.7 }}>
            {summary}
          </Paragraph>
        </Card>
      ) : (
        <Alert
          type="info"
          showIcon
          message="Sin resumen"
          description={
            <span>
              Este documento aún no está enriquecido.{" "}
              <Link href={`/enrich?docId=${doc.id}`}>Enriquecer ahora</Link>
            </span>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card size="small" title="Bibliografía">
            <MetaList
              items={[
                ["Autor", m.author],
                ["Título", m.bookTitle],
                ["ISBN", m.isbn],
                ["Editorial", m.publisher],
                ["Año", m.publicationYear],
                ["Edición", m.edition],
                ["Páginas", m.pageCount],
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" title="Clasificación">
            <MetaList
              items={[
                ["Periodo primario", m.primaryPeriod && getPeriodByCode(m.primaryPeriod)?.nombre],
                ["Periodo secundario", m.secondaryPeriod && getPeriodByCode(m.secondaryPeriod)?.nombre],
                ["Categoría primaria", m.primaryCategory && getCategoryByCode(m.primaryCategory)?.nombre],
                ["Categoría secundaria", m.secondaryCategory && getCategoryByCode(m.secondaryCategory)?.nombre],
              ]}
            />
            {keywords.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Palabras clave
                </Text>
                <div style={{ marginTop: 6 }}>
                  {keywords.map((k) => (
                    <Tag key={k} style={{ marginBottom: 4 }}>{k}</Tag>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function MetaList({ items }: { items: Array<[string, string | number | undefined | null]> }) {
  const { token } = theme.useToken();
  const filtered = items.filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (filtered.length === 0) return <Text type="secondary">Sin información.</Text>;
  return (
    <Space vertical size={6} style={{ width: "100%" }}>
      {filtered.map(([k, v]) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, fontSize: 13 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{k}</Text>
          <Text style={{ color: token.colorText }}>{v}</Text>
        </div>
      ))}
    </Space>
  );
}

function ReadingTab({
  chunksByPage,
  mode,
  onModeChange,
}: {
  chunksByPage: Array<[number, Chunk[]]>;
  mode: "by-page" | "continuous";
  onModeChange: (m: "by-page" | "continuous") => void;
}) {
  const { token } = theme.useToken();
  if (chunksByPage.length === 0) {
    return <Empty description="Sin chunks generados" />;
  }

  if (mode === "continuous") {
    return (
      <div>
        <Space style={{ marginBottom: 16 }}>
          <Segmented
            value={mode}
            onChange={(v) => onModeChange(v as "by-page" | "continuous")}
            options={[
              { value: "by-page", label: "Por página" },
              { value: "continuous", label: "Continuo" },
            ]}
          />
        </Space>
        <div className="prose-academic" style={{ maxWidth: 760, margin: "0 auto" }}>
          {chunksByPage.map(([p, chunks]) => (
            <div key={p}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "32px 0 16px" }}>
                <div style={{ height: 1, background: token.colorBorderSecondary, flex: 1 }} />
                <Tag style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>Página {p}</Tag>
                <div style={{ height: 1, background: token.colorBorderSecondary, flex: 1 }} />
              </div>
              {chunks.map((c) => (
                <p key={c.id}>{c.content}</p>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Segmented
          value={mode}
          onChange={(v) => onModeChange(v as "by-page" | "continuous")}
          options={[
            { value: "by-page", label: "Por página" },
            { value: "continuous", label: "Continuo" },
          ]}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {chunksByPage.length} página{chunksByPage.length !== 1 ? "s" : ""} con chunks
        </Text>
      </Space>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        {chunksByPage.map(([p, chunks]) => (
          <Card
            key={p}
            size="small"
            style={{ marginBottom: 12 }}
            title={
              <Space>
                <Tag style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>Página {p}</Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {chunks.length} chunk{chunks.length !== 1 ? "s" : ""}
                </Text>
              </Space>
            }
          >
            <div className="prose-academic" style={{ maxWidth: "100%" }}>
              {chunks.map((c) => (
                <p key={c.id} style={{ marginBottom: "0.8em" }}>
                  {c.content}
                </p>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ChunksTab({
  chunks,
  search,
  onSearch,
}: {
  chunks: Chunk[];
  search: string;
  onSearch: (v: string) => void;
}) {
  const { token } = theme.useToken();
  return (
    <div>
      <Input
        allowClear
        placeholder="Buscar dentro de chunks…"
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 480 }}
      />
      {chunks.length === 0 ? (
        <Empty description={search ? "Sin coincidencias" : "Sin chunks"} />
      ) : (
        <Space vertical size={10} style={{ width: "100%" }}>
          {chunks.map((c) => (
            <Card
              key={c.id}
              size="small"
              extra={
                <Space size={6}>
                  <Tag style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>#{c.chunkIndex}</Tag>
                  <Tag style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>p. {c.pageNumber}</Tag>
                  <Tag style={{ fontSize: 10 }}>{c.chunkSize} ch</Tag>
                </Space>
              }
              title={
                <Text style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 500 }}>
                  Chunk {c.chunkIndex + 1}
                </Text>
              }
            >
              <Paragraph
                ellipsis={{ rows: 6, expandable: true, symbol: "Mostrar más" }}
                style={{ fontFamily: "var(--font-serif)", fontSize: 14, lineHeight: 1.65, margin: 0 }}
              >
                <Highlight text={c.content} query={search} />
              </Paragraph>
            </Card>
          ))}
        </Space>
      )}
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const { token } = theme.useToken();
  if (!query) return <>{text}</>;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        re.test(p) ? (
          <mark
            key={i}
            style={{
              background: `${token.colorWarning}33`,
              color: token.colorText,
              padding: "0 2px",
              borderRadius: 2,
            }}
          >
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
