"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Card,
  Typography,
  Tag,
  Space,
  Button,
  Input,
  Select,
  Drawer,
  Empty,
  theme,
  App,
  Tooltip,
  Avatar,
  Spin,
} from "antd";
import {
  MessageOutlined,
  SendOutlined,
  FileTextOutlined,
  UserOutlined,
  RobotOutlined,
  ClusterOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import { CHAT_TEMPLATES, DEFAULT_TEMPLATE_ID, getTemplateById, CATEGORY_LABELS } from "@/lib/chat-templates";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Message {
  role: "user" | "assistant";
  content: string;
  templateId?: string;
  citations?: ChunkCitation[];
}

interface ChunkCitation {
  id: string;
  documentId: string;
  documentFilename?: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
  content: string;
}

const RAG_CONFIG = { topK: 100, similarityThreshold: 0.25 };

const STARTERS = [
  "¿Cómo evolucionó el modelo bipartidista durante la Regeneración?",
  "Compara el rol de la Iglesia en el siglo XIX colombiano con su papel actual.",
  "¿Qué impacto tuvieron las reformas de López Pumarejo en la sociedad?",
  "Explica las causas estructurales de la Guerra de los Mil Días.",
];

export default function ChatPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [citations, setCitations] = useState<ChunkCitation[]>([]);
  const [totalChunksUsed, setTotalChunksUsed] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [showCitations, setShowCitations] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<ChunkCitation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    };
  }, []);

  const handleAsk = useCallback(
    async (q: string) => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (typeTimerRef.current) clearInterval(typeTimerRef.current);

      setIsLoading(true);
      setStreamingText("");
      setCitations([]);
      setMessages((p) => [...p, { role: "user", content: q }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q,
            topK: RAG_CONFIG.topK,
            similarityThreshold: RAG_CONFIG.similarityThreshold,
            templateId: selectedTemplateId,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setMessages((p) => [
            ...p,
            { role: "assistant", content: (err as { error?: string }).error || "Error al procesar la pregunta." },
          ]);
          setIsLoading(false);
          return;
        }
        const { id, chunks, totalChunksUsed: total } = await res.json();
        setCitations(chunks || []);
        setTotalChunksUsed(total || 0);

        pollTimerRef.current = setInterval(async () => {
          try {
            const poll = await fetch(`/api/chat/${id}`);
            if (!poll.ok) return;
            const data = await poll.json();
            if (data.status === "COMPLETE" && data.answer) {
              clearInterval(pollTimerRef.current!);
              pollTimerRef.current = null;
              const full = data.answer as string;
              let i = 0;
              typeTimerRef.current = setInterval(() => {
                i = Math.min(i + 40, full.length);
                setStreamingText(full.slice(0, i));
                if (i >= full.length) {
                  clearInterval(typeTimerRef.current!);
                  typeTimerRef.current = null;
                  setMessages((p) => [
                    ...p,
                    { role: "assistant", content: full, templateId: selectedTemplateId, citations: chunks },
                  ]);
                  setStreamingText("");
                  setIsLoading(false);
                }
              }, 25);
            } else if (data.status === "ERROR") {
              clearInterval(pollTimerRef.current!);
              pollTimerRef.current = null;
              setMessages((p) => [...p, { role: "assistant", content: data.answer || "Error al generar respuesta." }]);
              setStreamingText("");
              setIsLoading(false);
            }
          } catch {
            /* will retry */
          }
        }, 2000);
      } catch (err) {
        console.error(err);
        setMessages((p) => [...p, { role: "assistant", content: "Error de conexión." }]);
        setIsLoading(false);
      }
    },
    [selectedTemplateId],
  );

  const submit = async () => {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput("");
    await handleAsk(q);
  };

  const template = getTemplateById(selectedTemplateId);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div
          style={{
            padding: "16px 28px",
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <Space size={14}>
            <MessageOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
            <div>
              <Text strong style={{ fontSize: 16 }} className="serif-title">Consultar el corpus</Text>
              <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                RAG híbrido con citas · Claude Opus 4.7
              </div>
            </div>
          </Space>
          <Space>
            <Select
              value={selectedTemplateId}
              onChange={setSelectedTemplateId}
              style={{ width: 280 }}
              disabled={isLoading}
              options={Object.entries(
                CHAT_TEMPLATES.reduce<Record<string, typeof CHAT_TEMPLATES>>((acc, t) => {
                  (acc[t.category] = acc[t.category] || []).push(t);
                  return acc;
                }, {}),
              ).map(([cat, templates]) => ({
                label: CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS],
                options: templates.map((t) => ({
                  value: t.id,
                  label: (
                    <Space>
                      <span>{t.icon}</span>
                      <span>{t.name}</span>
                    </Space>
                  ),
                })),
              }))}
            />
            <Tooltip title="Ver citas de la última respuesta">
              <Button
                icon={<FileTextOutlined />}
                onClick={() => setShowCitations(true)}
                disabled={citations.length === 0}
              >
                Fuentes ({totalChunksUsed > citations.length ? `${citations.length}/${totalChunksUsed}` : citations.length})
              </Button>
            </Tooltip>
            <Link href="/compare">
              <Button icon={<ClusterOutlined />}>Comparar</Button>
            </Link>
          </Space>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          <div style={{ maxWidth: 880, margin: "0 auto" }}>
            {messages.length === 0 && !isLoading && (
              <EmptyState onPick={(q) => setInput(q)} template={template?.name} />
            )}

            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                message={m}
                onCiteClick={(idx) => {
                  if (m.citations && m.citations[idx - 1]) setSelectedCitation(m.citations[idx - 1]);
                }}
              />
            ))}

            {isLoading && streamingText && (
              <MessageBubble
                message={{ role: "assistant", content: streamingText, citations }}
                streaming
                onCiteClick={(idx) => citations[idx - 1] && setSelectedCitation(citations[idx - 1])}
              />
            )}

            {isLoading && !streamingText && (
              <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "20px 0" }}>
                <Avatar style={{ background: `${token.colorPrimary}22`, color: token.colorPrimary }} icon={<RobotOutlined />} />
                <Card size="small" styles={{ body: { padding: "12px 16px" } }}>
                  <Space>
                    <Spin size="small" />
                    <Text type="secondary">Buscando en el corpus y razonando…</Text>
                  </Space>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div
          style={{
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            padding: "16px 28px",
            background: token.colorBgContainer,
          }}
        >
          <div style={{ maxWidth: 880, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <TextArea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Pregunta usando "${template?.name}"… Mínimo 4 palabras significativas.`}
                autoSize={{ minRows: 2, maxRows: 6 }}
                disabled={isLoading}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              <Button
                type="primary"
                size="large"
                icon={<SendOutlined />}
                loading={isLoading}
                onClick={submit}
                disabled={!input.trim()}
                style={{ height: "auto" }}
              />
            </div>
            <Text style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 6, display: "block" }}>
              <kbd>⏎</kbd> enviar · <kbd>⇧⏎</kbd> nueva línea · La respuesta puede tardar 30-90s con thinking extendido.
            </Text>
          </div>
        </div>
      </div>

      <Drawer
        title="Fuentes citadas"
        open={showCitations}
        onClose={() => setShowCitations(false)}
        width={520}
      >
        {citations.length === 0 ? (
          <Empty description="Sin citas" />
        ) : (
          <Space vertical size={10} style={{ width: "100%" }}>
            {citations.map((c, i) => (
              <CitationCard key={c.id} idx={i + 1} citation={c} onExpand={() => setSelectedCitation(c)} />
            ))}
          </Space>
        )}
      </Drawer>

      <Drawer
        title={
          selectedCitation && (
            <Space vertical size={0}>
              <Text strong style={{ fontSize: 14 }}>Cita #{citations.indexOf(selectedCitation) + 1}</Text>
              <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>
                {selectedCitation.documentFilename} · p. {selectedCitation.pageNumber}
              </Text>
            </Space>
          )
        }
        open={!!selectedCitation}
        onClose={() => setSelectedCitation(null)}
        width={620}
      >
        {selectedCitation && (
          <>
            <Space wrap style={{ marginBottom: 16 }}>
              <Tag>chunk #{selectedCitation.chunkIndex}</Tag>
              <Tag color="blue">sim {(selectedCitation.similarity * 100).toFixed(1)}%</Tag>
              <Link href={`/documents/${selectedCitation.documentId}`}>
                <Button size="small" icon={<FileTextOutlined />}>Abrir documento</Button>
              </Link>
            </Space>
            <Card styles={{ body: { padding: 16 } }}>
              <Paragraph
                style={{ fontFamily: "var(--font-serif)", fontSize: 14.5, lineHeight: 1.7, margin: 0 }}
              >
                {selectedCitation.content}
              </Paragraph>
            </Card>
          </>
        )}
      </Drawer>
    </div>
  );
}

function EmptyState({ onPick, template }: { onPick: (q: string) => void; template?: string }) {
  const { token } = theme.useToken();
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: `${token.colorPrimary}1A`,
          color: token.colorPrimary,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          marginBottom: 18,
        }}
      >
        <MessageOutlined />
      </div>
      <Title level={3} className="serif-title" style={{ margin: 0 }}>
        ¿Qué quieres investigar?
      </Title>
      <Paragraph style={{ color: token.colorTextSecondary, fontSize: 14, marginTop: 8 }}>
        Formato actual: <Text strong>{template}</Text>. Respuestas con citas trazables al corpus.
      </Paragraph>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginTop: 24, maxWidth: 640, marginInline: "auto" }}>
        {STARTERS.map((q) => (
          <Card
            key={q}
            hoverable
            styles={{ body: { padding: 14 } }}
            onClick={() => onPick(q)}
          >
            <Text style={{ fontSize: 13, textAlign: "left", display: "block", color: token.colorText }}>
              {q}
            </Text>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  streaming,
  onCiteClick,
}: {
  message: Message;
  streaming?: boolean;
  onCiteClick?: (idx: number) => void;
}) {
  const { token } = theme.useToken();
  const isUser = message.role === "user";
  const tpl = message.templateId ? getTemplateById(message.templateId) : undefined;
  const renderedContent = useCitations(message.content, onCiteClick);

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        margin: "18px 0",
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      <Avatar
        style={{
          background: isUser ? `${token.colorPrimary}22` : "#A855F722",
          color: isUser ? token.colorPrimary : "#A855F7",
          flexShrink: 0,
        }}
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
      />
      <div style={{ maxWidth: "calc(100% - 64px)" }}>
        <Card
          styles={{ body: { padding: "12px 16px" } }}
          style={{
            background: isUser ? `${token.colorPrimary}10` : token.colorBgContainer,
            borderColor: isUser ? `${token.colorPrimary}33` : token.colorBorder,
          }}
        >
          {isUser ? (
            <Text style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{message.content}</Text>
          ) : (
            <div className="prose-academic" style={{ fontSize: 14.5, maxWidth: "100%" }}>
              {renderedContent}
              {streaming && (
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 16,
                    background: token.colorPrimary,
                    marginLeft: 2,
                    verticalAlign: "middle",
                  }}
                />
              )}
            </div>
          )}
        </Card>
        {!isUser && !streaming && message.content && (
          <Space size={6} style={{ marginTop: 6, fontSize: 11, color: token.colorTextTertiary }}>
            {tpl && <Tag style={{ margin: 0, fontSize: 10 }}>{tpl.icon} {tpl.name}</Tag>}
            <Tooltip title="Copiar">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => navigator.clipboard.writeText(message.content)}
              />
            </Tooltip>
          </Space>
        )}
      </div>
    </div>
  );
}

function useCitations(content: string, onCiteClick?: (idx: number) => void) {
  const { token } = theme.useToken();
  const enhanced = content.replace(/\[#(\d+)\]/g, (_match, n) => `\`#${n}\``);
  return (
    <ReactMarkdown
      components={{
        code({ children, ...props }) {
          const txt = String(children).replace(/`/g, "");
          const m = /^#(\d+)$/.exec(txt);
          if (m) {
            const idx = Number(m[1]);
            return (
              <span
                className="citation"
                onClick={() => onCiteClick?.(idx)}
                style={{
                  background: `${token.colorWarning}22`,
                  color: token.colorWarning,
                  cursor: onCiteClick ? "pointer" : "default",
                }}
              >
                #{idx}
              </span>
            );
          }
          return <code {...props}>{children}</code>;
        },
      }}
    >
      {enhanced}
    </ReactMarkdown>
  );
}

function CitationCard({
  idx,
  citation,
  onExpand,
}: {
  idx: number;
  citation: ChunkCitation;
  onExpand: () => void;
}) {
  const { token } = theme.useToken();
  return (
    <Card size="small" hoverable onClick={onExpand} styles={{ body: { padding: 12 } }}>
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
            #{idx}
          </Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>
            p. {citation.pageNumber} · sim {(citation.similarity * 100).toFixed(0)}%
          </Text>
        </Space>
      </Space>
      <Text strong ellipsis style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
        {citation.documentFilename}
      </Text>
      <Paragraph
        ellipsis={{ rows: 3 }}
        style={{ fontFamily: "var(--font-serif)", fontSize: 13, lineHeight: 1.6, margin: 0, color: token.colorTextSecondary }}
      >
        {citation.content}
      </Paragraph>
    </Card>
  );
}
