"use client";

import { useState } from "react";
import {
  Card,
  Typography,
  Space,
  Tag,
  Button,
  Input,
  theme,
  App,
  Empty,
  Steps,
  Alert,
  Tooltip,
} from "antd";
import {
  RocketOutlined,
  BulbOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Subquery {
  query: string;
  status: "pending" | "running" | "done";
  foundChunks?: number;
}

export default function DeepResearchPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<"idle" | "planning" | "executing" | "synthesizing" | "done" | "error">("idle");
  const [subqueries, setSubqueries] = useState<Subquery[]>([]);
  const [planThinking, setPlanThinking] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const q = question.trim();
    if (q.length < 12) {
      message.warning("Necesitas al menos 12 caracteres.");
      return;
    }
    setRunning(true);
    setStage("planning");
    setSubqueries([]);
    setAnswer("");
    setError(null);
    setPlanThinking("");

    try {
      const res = await fetch("/api/deep-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.body) throw new Error("Sin stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "step") {
              if (ev.step === "planning") setStage("planning");
              if (ev.step === "synthesizing") setStage("synthesizing");
            }
            if (ev.type === "plan") {
              setStage("executing");
              setPlanThinking(ev.plan.thinking || "");
              setSubqueries(ev.plan.subqueries.map((q: string) => ({ query: q, status: "pending" as const })));
            }
            if (ev.type === "subquery_start") {
              setSubqueries((sq) => sq.map((s, i) => (i === ev.index ? { ...s, status: "running" } : s)));
            }
            if (ev.type === "subquery_done") {
              setSubqueries((sq) =>
                sq.map((s, i) => (i === ev.index ? { ...s, status: "done", foundChunks: ev.foundChunks } : s)),
              );
            }
            if (ev.type === "answer_delta") {
              setAnswer((a) => a + ev.chunk);
            }
            if (ev.type === "complete") {
              setStage("done");
              setAnswer(ev.finalAnswer || "");
            }
            if (ev.type === "error") {
              setStage("error");
              setError(ev.message);
            }
          } catch {
            /* skip */
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setStage("error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="app-page-wide">
      <Title level={2} className="serif-title" style={{ margin: 0 }}>
        <RocketOutlined /> Deep Research
      </Title>
      <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 20px", maxWidth: 720 }}>
        Investigación agéntica con thinking extendido. El sistema descompone tu pregunta en sub-preguntas,
        ejecuta múltiples búsquedas RAG en paralelo y sintetiza una respuesta exhaustiva con Claude Opus 4.7.
        Tarda 2-5 minutos.
      </Paragraph>

      <Card style={{ marginBottom: 16 }}>
        <Space vertical size={12} style={{ width: "100%" }}>
          <TextArea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder='Ej: "¿Cómo se construyó el imaginario nacional en Colombia entre 1850 y 1900, y qué papel jugó la prensa liberal?"'
            autoSize={{ minRows: 3, maxRows: 6 }}
            disabled={running}
          />
          <Space>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              size="large"
              loading={running}
              disabled={question.trim().length < 12}
              onClick={run}
            >
              Iniciar Deep Research
            </Button>
            <Tooltip title="Opus 4.7 con thinking extendido + 5 subqueries en paralelo">
              <Text type="secondary" style={{ fontSize: 12 }}>
                <BulbOutlined /> Costoso pero profundo
              </Text>
            </Tooltip>
          </Space>
        </Space>
      </Card>

      {stage !== "idle" && (
        <Card title="Pipeline" style={{ marginBottom: 16 }}>
          <Steps
            size="small"
            current={
              stage === "planning" ? 0 :
              stage === "executing" ? 1 :
              stage === "synthesizing" ? 2 :
              stage === "done" ? 3 : 0
            }
            status={stage === "error" ? "error" : undefined}
            items={[
              { title: "Planificar subqueries", icon: <BulbOutlined /> },
              { title: "Búsqueda paralela", icon: <SearchOutlined /> },
              { title: "Síntesis", icon: <ThunderboltOutlined /> },
              { title: "Completado" },
            ]}
          />
        </Card>
      )}

      {planThinking && (
        <Card size="small" style={{ marginBottom: 16, background: token.colorFillQuaternary }}>
          <Text type="secondary" style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Plan
          </Text>
          <Paragraph style={{ marginTop: 6, marginBottom: 0, fontSize: 13, fontStyle: "italic" }}>
            {planThinking}
          </Paragraph>
        </Card>
      )}

      {subqueries.length > 0 && (
        <Card title={`Subqueries (${subqueries.length})`} style={{ marginBottom: 16 }}>
          <Space vertical size={6} style={{ width: "100%" }}>
            {subqueries.map((sq, i) => (
              <Card key={i} size="small" styles={{ body: { padding: 10 } }}>
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Space size={8} style={{ flex: 1 }}>
                    <Tag style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>#{i + 1}</Tag>
                    <Text style={{ fontSize: 13 }}>{sq.query}</Text>
                  </Space>
                  <Space size={6}>
                    {sq.foundChunks !== undefined && (
                      <Tag color="blue" style={{ fontSize: 10 }}>
                        {sq.foundChunks} fragmentos
                      </Tag>
                    )}
                    {sq.status === "pending" && <Tag style={{ fontSize: 10 }}>pendiente</Tag>}
                    {sq.status === "running" && <Tag color="processing" style={{ fontSize: 10 }}>buscando</Tag>}
                    {sq.status === "done" && <Tag color="success" style={{ fontSize: 10 }}>✓</Tag>}
                  </Space>
                </Space>
              </Card>
            ))}
          </Space>
        </Card>
      )}

      {error && <Alert type="error" showIcon message={error} closable style={{ marginBottom: 16 }} />}

      {answer && (
        <Card title="Síntesis" styles={{ body: { padding: "28px 32px" } }}>
          <div className="prose-academic">
            <ReactMarkdown>{answer}</ReactMarkdown>
          </div>
        </Card>
      )}

      {stage === "idle" && (
        <Card>
          <Empty description="Plantea una pregunta de investigación amplia para empezar" />
        </Card>
      )}
    </div>
  );
}
