"use client";

import { useEffect, useState, useRef } from "react";
import {
  Card,
  Typography,
  Tag,
  Space,
  Button,
  Input,
  Select,
  theme,
  App,
  Row,
  Col,
  Spin,
  Empty,
  Tooltip,
} from "antd";
import {
  ClusterOutlined,
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import { CHAT_TEMPLATES, DEFAULT_TEMPLATE_ID, getTemplateById } from "@/lib/chat-templates";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface CompareResult {
  templateId: string;
  status: "idle" | "loading" | "complete" | "error";
  answer: string;
  citations: Array<{ id: string; documentFilename?: string; pageNumber: number; similarity: number }>;
  totalChunksUsed?: number;
  error?: string;
}

const RAG_CONFIG = { topK: 100, similarityThreshold: 0.25 };

export default function ComparePage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [question, setQuestion] = useState("");
  const [templates, setTemplates] = useState<string[]>([
    "mini-ensayo",
    "ensayo-largo",
    "guion-tres-actos",
  ]);
  const [results, setResults] = useState<Record<string, CompareResult>>({});
  const [isRunning, setIsRunning] = useState(false);
  const pollersRef = useRef<Record<string, ReturnType<typeof setInterval> | null>>({});

  // Cleanup global on unmount
  useEffect(() => {
    return () => {
      for (const t of Object.values(pollersRef.current)) {
        if (t) clearInterval(t);
      }
    };
  }, []);

  const run = async () => {
    const q = question.trim();
    if (!q) return;
    setIsRunning(true);
    // reset
    const initial: Record<string, CompareResult> = {};
    for (const t of templates) {
      initial[t] = { templateId: t, status: "loading", answer: "", citations: [] };
    }
    setResults(initial);

    // Disparar todas las requests en paralelo
    await Promise.all(
      templates.map(async (templateId) => {
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: q,
              topK: RAG_CONFIG.topK,
              similarityThreshold: RAG_CONFIG.similarityThreshold,
              templateId,
            }),
          });
          if (!res.ok) {
            setResults((r) => ({ ...r, [templateId]: { ...r[templateId], status: "error", error: "HTTP error" } }));
            return;
          }
          const data = await res.json();
          setResults((r) => ({
            ...r,
            [templateId]: {
              ...r[templateId],
              citations: data.chunks || [],
              totalChunksUsed: data.totalChunksUsed,
            },
          }));

          // Poll
          pollersRef.current[templateId] = setInterval(async () => {
            try {
              const poll = await fetch(`/api/chat/${data.id}`);
              if (!poll.ok) return;
              const pd = await poll.json();
              if (pd.status === "COMPLETE") {
                clearInterval(pollersRef.current[templateId]!);
                pollersRef.current[templateId] = null;
                setResults((r) => ({ ...r, [templateId]: { ...r[templateId], status: "complete", answer: pd.answer } }));
              } else if (pd.status === "ERROR") {
                clearInterval(pollersRef.current[templateId]!);
                pollersRef.current[templateId] = null;
                setResults((r) => ({ ...r, [templateId]: { ...r[templateId], status: "error", error: pd.answer } }));
              }
            } catch {
              /* retry */
            }
          }, 2000);
        } catch {
          setResults((r) => ({ ...r, [templateId]: { ...r[templateId], status: "error", error: "Error de red" } }));
        }
      }),
    );

    // Espera hasta que todos terminen
    const checkDone = setInterval(() => {
      const all = Object.values(pollersRef.current).every((v) => v === null);
      if (all) {
        clearInterval(checkDone);
        setIsRunning(false);
      }
    }, 1000);
  };

  const addTemplate = (tplId: string) => {
    if (templates.includes(tplId) || templates.length >= 3) return;
    setTemplates([...templates, tplId]);
  };

  const removeTemplate = (tplId: string) => {
    setTemplates(templates.filter((t) => t !== tplId));
  };

  return (
    <div className="app-page-wide">
      <Space vertical size={4} style={{ marginBottom: 24 }}>
        <Title level={2} className="serif-title" style={{ margin: 0 }}>
          <ClusterOutlined /> Comparador de templates
        </Title>
        <Paragraph style={{ color: token.colorTextSecondary, margin: 0 }}>
          Envía una misma pregunta a hasta 3 templates simultáneamente y compara las respuestas lado a lado.
        </Paragraph>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space vertical size={14} style={{ width: "100%" }}>
          <TextArea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Escribe la pregunta de investigación…"
            autoSize={{ minRows: 2, maxRows: 6 }}
            disabled={isRunning}
          />
          <Space wrap>
            {templates.map((tid) => {
              const t = getTemplateById(tid);
              return (
                <Tag
                  key={tid}
                  closable
                  onClose={() => removeTemplate(tid)}
                  closeIcon={<DeleteOutlined />}
                  style={{ padding: "4px 10px", fontSize: 12 }}
                >
                  {t?.icon} {t?.name}
                </Tag>
              );
            })}
            {templates.length < 3 && (
              <Select
                style={{ width: 220 }}
                size="small"
                placeholder={<><PlusOutlined /> Añadir template</>}
                value={undefined}
                onChange={addTemplate}
                options={CHAT_TEMPLATES.filter((t) => !templates.includes(t.id)).map((t) => ({
                  value: t.id,
                  label: `${t.icon} ${t.name}`,
                }))}
              />
            )}
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={run}
              loading={isRunning}
              disabled={!question.trim() || templates.length === 0}
            >
              Comparar
            </Button>
          </Space>
        </Space>
      </Card>

      {templates.length === 0 ? (
        <Empty description="Añade al menos un template para comparar" />
      ) : (
        <Row gutter={[12, 12]}>
          {templates.map((tid) => (
            <Col key={tid} xs={24} lg={24 / templates.length as 8 | 12 | 24}>
              <ResultColumn templateId={tid} result={results[tid]} />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}

function ResultColumn({ templateId, result }: { templateId: string; result?: CompareResult }) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const tpl = getTemplateById(templateId);

  return (
    <Card
      style={{ height: "100%" }}
      styles={{ body: { padding: 0 } }}
      title={
        <Space>
          <span style={{ fontSize: 18 }}>{tpl?.icon}</span>
          <div>
            <Text strong style={{ fontSize: 13 }}>{tpl?.name}</Text>
            <div style={{ fontSize: 11, color: token.colorTextTertiary }}>{tpl?.description}</div>
          </div>
        </Space>
      }
      extra={
        result?.status === "complete" && (
          <Space size={4}>
            <Tag style={{ fontSize: 10, margin: 0 }}>
              {result.citations.length} citas
            </Tag>
            <Tooltip title="Copiar markdown">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(result.answer);
                  message.success("Copiado");
                }}
              />
            </Tooltip>
          </Space>
        )
      }
    >
      <div style={{ padding: 16, maxHeight: 640, overflowY: "auto" }}>
        {!result || result.status === "idle" ? (
          <Empty description="Sin resultado" />
        ) : result.status === "loading" ? (
          <Space vertical size={12} style={{ width: "100%", alignItems: "center", padding: 30 }}>
            <Spin />
            <Text type="secondary" style={{ fontSize: 12 }}>Generando…</Text>
          </Space>
        ) : result.status === "error" ? (
          <Text type="danger">{result.error || "Error"}</Text>
        ) : (
          <div className="prose-academic" style={{ fontSize: 13.5, maxWidth: "100%" }}>
            <ReactMarkdown>{result.answer}</ReactMarkdown>
          </div>
        )}
      </div>
    </Card>
  );
}
