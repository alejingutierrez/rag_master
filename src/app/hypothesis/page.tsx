"use client";

import { useRef, useState } from "react";
import {
  Card,
  Typography,
  Space,
  Tag,
  Button,
  Input,
  theme,
  App,
  Row,
  Col,
  Empty,
  Spin,
  Alert,
} from "antd";
import {
  BulbOutlined,
  RocketOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ReloadOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface SideResult {
  status: "idle" | "loading" | "complete" | "error";
  answer: string;
  citations: Array<{ id: string; documentFilename?: string; pageNumber: number; similarity: number }>;
  totalChunksUsed?: number;
}

export default function HypothesisPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [hypothesis, setHypothesis] = useState("");
  const [forResult, setForResult] = useState<SideResult>({ status: "idle", answer: "", citations: [] });
  const [againstResult, setAgainstResult] = useState<SideResult>({ status: "idle", answer: "", citations: [] });
  const [running, setRunning] = useState(false);
  const forPoller = useRef<ReturnType<typeof setInterval> | null>(null);
  const againstPoller = useRef<ReturnType<typeof setInterval> | null>(null);

  const runSide = async (
    setResult: (r: SideResult) => void,
    pollerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
    question: string,
  ) => {
    setResult({ status: "loading", answer: "", citations: [] });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          topK: 100,
          similarityThreshold: 0.25,
          templateId: "mini-ensayo",
        }),
      });
      if (!res.ok) throw new Error("HTTP error");
      const data = await res.json();
      setResult({
        status: "loading",
        answer: "",
        citations: data.chunks ?? [],
        totalChunksUsed: data.totalChunksUsed,
      });
      pollerRef.current = setInterval(async () => {
        const poll = await fetch(`/api/chat/${data.id}`);
        if (!poll.ok) return;
        const pd = await poll.json();
        if (pd.status === "COMPLETE") {
          clearInterval(pollerRef.current!);
          pollerRef.current = null;
          setResult({
            status: "complete",
            answer: pd.answer,
            citations: data.chunks ?? [],
            totalChunksUsed: data.totalChunksUsed,
          });
        } else if (pd.status === "ERROR") {
          clearInterval(pollerRef.current!);
          pollerRef.current = null;
          setResult({ status: "error", answer: pd.answer || "Error", citations: [] });
        }
      }, 2000);
    } catch {
      setResult({ status: "error", answer: "Error de red", citations: [] });
    }
  };

  const run = async () => {
    const h = hypothesis.trim();
    if (h.length < 10) {
      message.warning("La hipótesis necesita al menos 10 caracteres.");
      return;
    }
    setRunning(true);
    if (forPoller.current) clearInterval(forPoller.current);
    if (againstPoller.current) clearInterval(againstPoller.current);

    await Promise.all([
      runSide(
        setForResult,
        forPoller,
        `Evalúa la siguiente hipótesis histórica y busca evidencia EN FAVOR. Cita pasajes específicos del corpus que la respalden, con razonamiento claro.\n\nHIPÓTESIS:\n"${h}"\n\nResponde con un mini-ensayo de evidencia favorable, argumentando por qué los hechos del corpus respaldan esta tesis. Incluye citas [#N] obligatorias.`,
      ),
      runSide(
        setAgainstResult,
        againstPoller,
        `Evalúa la siguiente hipótesis histórica y busca evidencia EN CONTRA. Cita pasajes que la cuestionen, matizan o refutan, con razonamiento claro.\n\nHIPÓTESIS:\n"${h}"\n\nResponde con un mini-ensayo crítico que problematice esta tesis basándote en evidencia del corpus. Incluye citas [#N] obligatorias.`,
      ),
    ]);

    const checkDone = setInterval(() => {
      if (!forPoller.current && !againstPoller.current) {
        clearInterval(checkDone);
        setRunning(false);
      }
    }, 1000);
  };

  return (
    <div className="app-page-wide">
      <div style={{ marginBottom: 20 }}>
        <Title level={2} className="serif-title" style={{ margin: 0 }}>
          <BulbOutlined /> Sistema de hipótesis
        </Title>
        <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 0", maxWidth: 720 }}>
          Plantea una hipótesis histórica y el sistema buscará evidencia <Text strong style={{ color: token.colorSuccess }}>a favor</Text>
          {" "}y <Text strong style={{ color: token.colorError }}>en contra</Text> en el corpus, presentándolas lado a lado.
          Útil para tesis, historiografía o argumentación.
        </Paragraph>
      </div>

      <Card bordered style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <TextArea
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            placeholder='Ej: "El Frente Nacional consolidó la exclusión política y sembró las condiciones del conflicto armado contemporáneo."'
            autoSize={{ minRows: 3, maxRows: 6 }}
            disabled={running}
          />
          <Space>
            <Button
              type="primary"
              icon={<RocketOutlined />}
              size="large"
              loading={running}
              disabled={hypothesis.trim().length < 10}
              onClick={run}
            >
              Buscar evidencia
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Se ejecutan dos consultas RAG en paralelo. ~30–60s.
            </Text>
          </Space>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SideCard
            title="Evidencia a favor"
            icon={<CheckCircleFilled />}
            color={token.colorSuccess}
            result={forResult}
          />
        </Col>
        <Col xs={24} lg={12}>
          <SideCard
            title="Evidencia en contra"
            icon={<CloseCircleFilled />}
            color={token.colorError}
            result={againstResult}
          />
        </Col>
      </Row>
    </div>
  );
}

function SideCard({
  title,
  icon,
  color,
  result,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  result: SideResult;
}) {
  const { token } = theme.useToken();
  return (
    <Card
      bordered
      style={{ borderTop: `3px solid ${color}`, minHeight: 380 }}
      title={
        <Space>
          <span style={{ color }}>{icon}</span>
          <Text strong>{title}</Text>
        </Space>
      }
      extra={
        result.status === "complete" && (
          <Tag style={{ background: `${color}1A`, border: "none", color }}>
            {result.citations.length} fuentes
          </Tag>
        )
      }
    >
      {result.status === "idle" && <Empty description="Sin ejecutar" />}
      {result.status === "loading" && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spin />
          <Paragraph type="secondary" style={{ marginTop: 12 }}>
            Buscando en el corpus…
          </Paragraph>
        </div>
      )}
      {result.status === "error" && <Alert type="error" message={result.answer} />}
      {result.status === "complete" && (
        <div className="prose-academic" style={{ fontSize: 14, maxWidth: "100%" }}>
          <ReactMarkdown>{result.answer}</ReactMarkdown>
        </div>
      )}
    </Card>
  );
}
