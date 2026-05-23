"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  Typography,
  Tag,
  Space,
  Button,
  theme,
  App,
  Skeleton,
  Empty,
  Dropdown,
  Drawer,
  Row,
  Col,
} from "antd";
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  SyncOutlined,
  BookOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import ReactMarkdown from "react-markdown";
import { getTemplateById } from "@/lib/chat-templates";
import { getPeriodColor, getCategoryColor } from "@/lib/theme";

const { Title, Text, Paragraph } = Typography;

interface DeliverableDetail {
  id: string;
  templateId: string;
  answer: string;
  modelUsed: string;
  status: string;
  source: string;
  userQuestion: string | null;
  createdAt: string;
  updatedAt: string;
  chunksUsed: Array<{ documentFilename?: string; pageNumber?: number; similarity?: number; content?: string }>;
  question: null | {
    id?: string;
    pregunta: string;
    periodoCode: string;
    periodoNombre: string;
    categoriaCode: string;
    categoriaNombre: string;
    document?: { id?: string; filename: string };
  };
}

export default function ProduccionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [data, setData] = useState<DeliverableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch(`/api/deliverables/${id}`);
      if (!r.ok) {
        setError("Producción no encontrada");
        return;
      }
      const d = await r.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (data?.status !== "GENERATING") return;
    const t = setInterval(fetchData, 3000);
    return () => clearInterval(t);
  }, [data?.status, fetchData]);

  const wordCount = useMemo(() => {
    if (!data?.answer) return 0;
    return data.answer.trim().split(/\s+/).filter(Boolean).length;
  }, [data?.answer]);

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.answer);
    setCopied(true);
    message.success("Copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (format: "md" | "docx" | "pdf") => {
    if (!data) return;
    setDownloading(format);
    try {
      const res = await fetch(`/api/deliverables/${id}/export?format=${format}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const name = (data.question?.pregunta ?? "produccion").slice(0, 50).replace(/[^\w\s]/g, "");
      a.download = `${name}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(`Descargado .${format}`);
    } catch {
      message.error("Error al exportar");
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return <div className="app-page"><Skeleton active /></div>;
  }

  if (error || !data) {
    return (
      <div className="app-page">
        <Empty description={error || "Sin datos"} />
      </div>
    );
  }

  const tpl = getTemplateById(data.templateId);
  const periodColor = data.question?.periodoCode
    ? getPeriodColor(data.question.periodoCode)
    : token.colorPrimary;
  const categoryColor = data.question?.categoriaCode
    ? getCategoryColor(data.question.categoriaCode)
    : undefined;
  const title = data.question?.pregunta ?? data.userQuestion ?? "(producción libre)";

  return (
    <div className="app-page">
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.back()} style={{ marginBottom: 16 }}>
        Volver
      </Button>

      <Row gutter={[24, 16]}>
        <Col xs={24} lg={17}>
          <Card bordered style={{ borderTop: `3px solid ${periodColor}`, marginBottom: 16 }}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Space wrap>
                <Tag style={{ background: `${periodColor}1A`, border: "none", color: periodColor }}>
                  <span style={{ fontSize: 16, marginRight: 4 }}>{tpl?.icon}</span>
                  {tpl?.name}
                </Tag>
                {data.question?.periodoNombre && (
                  <Tag style={{ background: `${periodColor}1A`, border: "none", color: periodColor }}>
                    {data.question.periodoNombre}
                  </Tag>
                )}
                {data.question?.categoriaNombre && categoryColor && (
                  <Tag style={{ background: `${categoryColor}1A`, border: "none", color: categoryColor }}>
                    {data.question.categoriaNombre}
                  </Tag>
                )}
                {data.status === "GENERATING" && (
                  <Tag color="processing" icon={<SyncOutlined spin />}>
                    Generando
                  </Tag>
                )}
              </Space>
              <Title level={2} className="serif-title" style={{ margin: 0 }}>
                {title}
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {wordCount > 0 && `${wordCount} palabras · `}
                {data.chunksUsed?.length ?? 0} fuentes ·{" "}
                {dayjs(data.updatedAt).format("DD MMM YYYY HH:mm")} ·{" "}
                {data.modelUsed}
              </Text>
            </Space>
          </Card>

          <Card bordered bodyStyle={{ padding: "32px 36px" }}>
            {data.status === "GENERATING" && !data.answer ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <SyncOutlined spin style={{ fontSize: 28, color: token.colorPrimary }} />
                <Paragraph style={{ marginTop: 16 }}>Generando contenido…</Paragraph>
              </div>
            ) : (
              <div className="prose-academic">
                <ReactMarkdown
                  components={{
                    code({ children, ...props }) {
                      const txt = String(children).replace(/`/g, "");
                      const m = /^#(\d+)$/.exec(txt);
                      if (m) {
                        return (
                          <span
                            className="citation"
                            onClick={() => setShowSources(true)}
                            style={{ cursor: "pointer" }}
                          >
                            #{m[1]}
                          </span>
                        );
                      }
                      return <code {...props}>{children}</code>;
                    },
                  }}
                >
                  {data.answer.replace(/\[#(\d+)\]/g, (_match, n) => `\`#${n}\``)}
                </ReactMarkdown>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={7}>
          <Card bordered title="Acciones" style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Button
                block
                icon={copied ? <CheckCircleOutlined /> : <CopyOutlined />}
                onClick={handleCopy}
                disabled={!data.answer}
              >
                {copied ? "Copiado" : "Copiar Markdown"}
              </Button>
              <Dropdown
                menu={{
                  items: [
                    { key: "md", label: ".md", onClick: () => handleDownload("md") },
                    { key: "docx", label: ".docx", onClick: () => handleDownload("docx") },
                    { key: "pdf", label: ".pdf", onClick: () => handleDownload("pdf") },
                  ],
                }}
              >
                <Button block icon={<DownloadOutlined />} loading={!!downloading} disabled={!data.answer}>
                  Exportar como…
                </Button>
              </Dropdown>
              <Button
                block
                icon={<FileTextOutlined />}
                onClick={() => setShowSources(true)}
                disabled={(data.chunksUsed?.length ?? 0) === 0}
              >
                Ver fuentes ({data.chunksUsed?.length ?? 0})
              </Button>
              <Link href={`/bibliography?deliverable=${data.id}`}>
                <Button block icon={<BookOutlined />}>
                  Generar bibliografía
                </Button>
              </Link>
            </Space>
          </Card>

          <Card bordered title="Contexto" size="small">
            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              {data.question?.document && (
                <div>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Documento fuente
                  </Text>
                  <div style={{ marginTop: 4 }}>
                    {data.question.document.id ? (
                      <Link href={`/documents/${data.question.document.id}`}>
                        <Text style={{ fontSize: 13 }}>{data.question.document.filename}</Text>
                      </Link>
                    ) : (
                      <Text style={{ fontSize: 13 }}>{data.question.document.filename}</Text>
                    )}
                  </div>
                </div>
              )}
              <div>
                <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Origen
                </Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color={data.source === "chat" ? "geekblue" : "purple"}>{data.source}</Tag>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Modelo
                </Text>
                <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  {data.modelUsed.replace("us.anthropic.", "")}
                </div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Drawer
        title={`Fuentes citadas (${data.chunksUsed?.length ?? 0})`}
        open={showSources}
        onClose={() => setShowSources(false)}
        width={560}
      >
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          {(data.chunksUsed ?? []).map((c, i) => (
            <Card key={i} bordered size="small" bodyStyle={{ padding: 12 }}>
              <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 6 }}>
                <Space size={6}>
                  <Tag
                    style={{
                      fontFamily: "var(--font-mono)",
                      background: `${token.colorWarning}22`,
                      color: token.colorWarning,
                      border: "none",
                      fontSize: 11,
                      margin: 0,
                    }}
                  >
                    #{i + 1}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    p. {c.pageNumber}
                    {c.similarity !== undefined && ` · sim ${(c.similarity * 100).toFixed(0)}%`}
                  </Text>
                </Space>
              </Space>
              <Text strong style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
                {c.documentFilename}
              </Text>
              {c.content && (
                <Paragraph
                  ellipsis={{ rows: 4, expandable: true, symbol: "más" }}
                  style={{ fontFamily: "var(--font-serif)", fontSize: 13, lineHeight: 1.6, margin: 0, color: token.colorTextSecondary }}
                >
                  {c.content}
                </Paragraph>
              )}
            </Card>
          ))}
        </Space>
      </Drawer>
    </div>
  );
}
