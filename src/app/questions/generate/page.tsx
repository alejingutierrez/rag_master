"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Card,
  Typography,
  Tag,
  Space,
  Button,
  Select,
  theme,
  Row,
  Col,
  Empty,
  Alert,
  Skeleton,
  Steps,
  Progress,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  RocketOutlined,
} from "@ant-design/icons";
import { getDocumentDisplayName } from "@/lib/enrichment-types";
import { computeTargetCount } from "@/lib/questions-config";
import { getPeriodColor, getCategoryColor } from "@/lib/theme";

const { Title, Text, Paragraph } = Typography;

interface DocumentWithQuestions {
  id: string;
  filename: string;
  metadata?: Record<string, unknown>;
  status: string;
  _count: { chunks: number; questions: number };
  latestDate?: string | null;
}

interface ProgressStep {
  step: string;
  message: string;
  done: boolean;
}

interface GeneratedQuestion {
  index: number;
  pregunta: string;
  periodoNombre: string;
  categoriaNombre: string;
  periodoCode?: string;
  categoriaCode?: string;
}

const STEPS_DEF = [
  { step: "fetching_chunks", message: "Obteniendo chunks del documento" },
  { step: "selecting_chunks", message: "Preparando contexto completo del libro" },
  { step: "calling_claude", message: "Llamando a Claude Opus 4.7" },
  { step: "parsing", message: "Procesando preguntas" },
];

export default function GenerateQuestionsPage() {
  return (
    <Suspense fallback={<div className="app-page"><Skeleton active /></div>}>
      <GenerateContent />
    </Suspense>
  );
}

function GenerateContent() {
  const params = useSearchParams();
  const { token } = theme.useToken();
  const initialDocId = params.get("documentId") ?? "";

  const [docs, setDocs] = useState<DocumentWithQuestions[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>(initialDocId);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/documents?limit=300&status=READY");
      const d = await r.json();
      const list: DocumentWithQuestions[] = d.documents ?? [];
      const enriched = await Promise.all(
        list.map(async (doc) => {
          try {
            const qRes = await fetch(`/api/documents/${doc.id}/questions`);
            const qData = await qRes.json();
            return {
              ...doc,
              _count: { ...doc._count, questions: qData.count ?? 0 },
              latestDate: qData.latestDate,
            };
          } catch {
            return { ...doc, _count: { ...doc._count, questions: 0 } };
          }
        }),
      );
      setDocs(enriched);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const selected = docs.find((d) => d.id === selectedDoc);
  const hasQuestions = (selected?._count.questions ?? 0) > 0;
  const projectedN = selected ? computeTargetCount(selected._count.chunks) : 0;

  const handleGenerate = async () => {
    if (!selectedDoc) return;
    setGenerating(true);
    setProgress([]);
    setQuestions([]);
    setError(null);
    setDone(false);

    const verifyAfterFailure = async () => {
      try {
        const res = await fetch(`/api/documents/${selectedDoc}/questions`);
        const d = await res.json();
        if ((d.count ?? 0) > 0) {
          setDone(true);
          setError("Conexión perdida con el stream, pero las preguntas se generaron correctamente. Recarga para verlas.");
          loadDocs();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    let sawComplete = false;
    let sawAny = false;
    try {
      const res = await fetch(`/api/documents/${selectedDoc}/questions/generate`, { method: "POST" });
      if (!res.body) throw new Error("Sin stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "progress") {
              setProgress((p) => {
                const exists = p.find((s) => s.step === ev.step);
                if (exists) return p.map((s) => (s.step === ev.step ? { ...s, done: true } : s));
                const def = STEPS_DEF.find((s) => s.step === ev.step);
                return [...p.map((s) => ({ ...s, done: true })), { step: ev.step, message: def?.message ?? ev.message, done: false }];
              });
            }
            if (ev.type === "question") {
              sawAny = true;
              setProgress((p) => p.map((s) => ({ ...s, done: true })));
              setQuestions((p) => [
                ...p,
                {
                  index: ev.index,
                  pregunta: ev.question.pregunta,
                  periodoNombre: ev.question.periodoNombre,
                  categoriaNombre: ev.question.categoriaNombre,
                  periodoCode: ev.question.periodoCode,
                  categoriaCode: ev.question.categoriaCode,
                },
              ]);
            }
            if (ev.type === "complete") {
              sawComplete = true;
              setProgress((p) => p.map((s) => ({ ...s, done: true })));
              setDone(true);
              loadDocs();
            }
            if (ev.type === "error") setError(ev.message);
          } catch {
            /* skip */
          }
        }
      }
      if (!sawComplete) {
        const recovered = await verifyAfterFailure();
        if (!recovered) setError(sawAny ? "Stream interrumpido. Verifica recargando." : "Stream cerrado sin preguntas. Reintenta.");
      }
    } catch (err) {
      const recovered = await verifyAfterFailure();
      if (!recovered) setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="app-page"><Skeleton active /></div>;
  }

  const ready = docs.filter((d) => d.status === "READY");
  const withQ = docs.filter((d) => d._count.questions > 0).length;
  const progressPct = projectedN > 0 ? Math.round((questions.length / projectedN) * 100) : 0;

  return (
    <div className="app-page">
      <Link href="/questions">
        <Button type="text" icon={<ArrowLeftOutlined />} style={{ marginBottom: 12 }}>
          Volver a preguntas
        </Button>
      </Link>

      <Title level={2} className="serif-title" style={{ margin: 0 }}>
        Generar preguntas de investigación
      </Title>
      <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 24px", maxWidth: 720 }}>
        Claude Opus 4.7 lee el corpus completo del documento y genera preguntas de investigación clasificadas
        por período histórico, categoría temática y subcategoría. El número se adapta al tamaño del libro.
      </Paragraph>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card bordered bodyStyle={{ padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 600 }}>{ready.length}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>Documentos disponibles</Text>
          </Card>
        </Col>
        <Col xs={8}>
          <Card bordered bodyStyle={{ padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: token.colorSuccess }}>{withQ}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>Con preguntas</Text>
          </Card>
        </Col>
        <Col xs={8}>
          <Card bordered bodyStyle={{ padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: token.colorWarning }}>{ready.length - withQ}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>Pendientes</Text>
          </Card>
        </Col>
      </Row>

      <Card bordered title="Seleccionar documento" style={{ marginBottom: 16 }}>
        <Select
          showSearch
          allowClear
          style={{ width: "100%" }}
          value={selectedDoc || undefined}
          onChange={(v) => {
            setSelectedDoc(v ?? "");
            setProgress([]);
            setQuestions([]);
            setError(null);
            setDone(false);
          }}
          placeholder="— Selecciona un documento —"
          optionFilterProp="label"
          options={ready.map((d) => ({
            value: d.id,
            label: `${d._count.questions > 0 ? "✓ " : "○ "}${getDocumentDisplayName(d)}${d._count.questions > 0 ? ` (${d._count.questions} preguntas)` : ""}`,
          }))}
          disabled={generating}
        />

        {selected && (
          <Card bordered bodyStyle={{ padding: 14 }} style={{ marginTop: 16, background: token.colorFillQuaternary }}>
            <Row gutter={16} align="middle">
              <Col flex="auto">
                <Space direction="vertical" size={4}>
                  <Text strong>{getDocumentDisplayName(selected)}</Text>
                  <Space size={6}>
                    <Tag>{selected._count.chunks} chunks</Tag>
                    {hasQuestions ? (
                      <Tag color="success">
                        <CheckCircleFilled /> {selected._count.questions} preguntas
                      </Tag>
                    ) : (
                      <Tag>Sin preguntas</Tag>
                    )}
                    {hasQuestions && (
                      <Link href={`/questions?documentId=${selected.id}`}>
                        <Button type="link" size="small">Ver preguntas →</Button>
                      </Link>
                    )}
                  </Space>
                </Space>
              </Col>
              <Col>
                <Space direction="vertical" size={4} align="end">
                  <Text type="secondary" style={{ fontSize: 11 }}>N adaptativo</Text>
                  <div style={{ fontSize: 28, fontWeight: 600, color: token.colorPrimary, fontFamily: "var(--font-mono)" }}>
                    {projectedN}
                  </div>
                </Space>
              </Col>
            </Row>
          </Card>
        )}

        <Button
          type="primary"
          icon={<RocketOutlined />}
          size="large"
          block
          loading={generating}
          disabled={!selectedDoc || generating}
          onClick={handleGenerate}
          style={{ marginTop: 16 }}
        >
          {generating ? "Generando…" : hasQuestions ? `Regenerar ${projectedN} preguntas` : `Generar ${projectedN} preguntas`}
        </Button>
      </Card>

      {(generating || progress.length > 0) && (
        <Card bordered title="Progreso" style={{ marginBottom: 16 }}>
          <Steps
            size="small"
            current={progress.length}
            direction="vertical"
            items={STEPS_DEF.map((s, i) => {
              const done = progress.find((p) => p.step === s.step)?.done;
              const isCurrent = !done && progress.find((p) => p.step === s.step);
              return {
                title: s.message,
                status: done ? "finish" : isCurrent ? "process" : i < progress.length ? "finish" : "wait",
              };
            })}
          />
          {questions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ fontSize: 13 }}>Preguntas generadas</Text>
                <Text strong>{questions.length} / {projectedN}</Text>
              </Space>
              <Progress percent={progressPct} strokeColor={token.colorPrimary} showInfo={false} />
            </div>
          )}
        </Card>
      )}

      {error && <Alert type="warning" showIcon message={error} closable style={{ marginBottom: 16 }} />}

      {done && (
        <Alert
          type="success"
          showIcon
          message={`${questions.length} preguntas generadas correctamente`}
          action={
            <Link href={`/questions?documentId=${selectedDoc}`}>
              <Button size="small" type="primary">Ver todas →</Button>
            </Link>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {questions.length > 0 && (
        <Card bordered title={`Preguntas en streaming (${questions.length})`}>
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            {questions.map((q) => {
              const periodColor = q.periodoCode ? getPeriodColor(q.periodoCode) : token.colorPrimary;
              const categoryColor = q.categoriaCode ? getCategoryColor(q.categoriaCode) : token.colorPrimary;
              return (
                <Card key={q.index} bordered size="small" bodyStyle={{ padding: 12 }} style={{ borderLeft: `3px solid ${periodColor}` }}>
                  <Space direction="vertical" size={4} style={{ width: "100%" }}>
                    <Space>
                      <Tag style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>#{q.index}</Tag>
                      <Tag style={{ background: `${periodColor}1A`, border: "none", color: periodColor, fontSize: 10 }}>
                        {q.periodoNombre}
                      </Tag>
                      <Tag style={{ background: `${categoryColor}1A`, border: "none", color: categoryColor, fontSize: 10 }}>
                        {q.categoriaNombre}
                      </Tag>
                    </Space>
                    <Text style={{ fontSize: 13.5, lineHeight: 1.5 }}>{q.pregunta}</Text>
                  </Space>
                </Card>
              );
            })}
          </Space>
        </Card>
      )}

      {ready.length === 0 && (
        <Card bordered>
          <Empty
            description={
              <span>
                Sin documentos listos.{" "}
                <Link href="/upload">Sube un PDF</Link> para empezar.
              </span>
            }
          />
        </Card>
      )}
    </div>
  );
}
