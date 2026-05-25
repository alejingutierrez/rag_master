"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Tabs,
  Skeleton,
  Popover,
  Row,
  Col,
  Divider,
} from "antd";
import {
  BookOutlined,
  BulbOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  CompassOutlined,
  StopOutlined,
  HistoryOutlined,
  TeamOutlined,
  CalendarOutlined,
  FileSearchOutlined,
  ExperimentOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Subquery {
  query: string;
  status: "pending" | "running" | "done" | "error";
  foundChunks?: number;
}

interface ChunkMeta {
  id: string;
  documentFilename?: string;
  pageNumber?: number;
  similarity?: number;
  content?: string;
}

interface ResearchPlan {
  thinking: string;
  scope: string;
  entities: {
    personas: string[];
    instituciones: string[];
    lugares: string[];
    conceptos: string[];
    temporalidad: string;
  };
  subqueries: string[];
}

export default function DeepResearchPage() {
  return (
    <Suspense fallback={<div className="app-page-wide"><Skeleton active /></div>}>
      <DeepResearchContent />
    </Suspense>
  );
}

function DeepResearchContent() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const router = useRouter();
  const params = useSearchParams();
  const idFromUrl = params.get("id");

  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<
    "idle" | "planning" | "executing" | "fusing" | "synthesizing" | "annexes" | "persisting" | "done" | "error"
  >("idle");
  const [plan, setPlan] = useState<ResearchPlan | null>(null);
  const [subqueries, setSubqueries] = useState<Subquery[]>([]);
  const [answer, setAnswer] = useState("");
  const [chunks, setChunks] = useState<ChunkMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deliverableId, setDeliverableId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("paper");

  const abortRef = useRef<AbortController | null>(null);

  // ─── Carga deep-research previo si viene ?id= ─────────────────────────
  const loadFromUrl = useCallback(async (id: string) => {
    setRunning(false);
    setStage("done");
    setError(null);
    setSubqueries([]);
    try {
      const res = await fetch(`/api/deep-research?id=${id}`);
      if (!res.ok) throw new Error("No se encontró el deep research");
      const data = await res.json();
      setQuestion(data.userQuestion ?? "");
      setAnswer(data.answer ?? "");
      setChunks(data.chunksUsed ?? []);
      setDeliverableId(data.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (idFromUrl) loadFromUrl(idFromUrl);
  }, [idFromUrl, loadFromUrl]);

  // ─── Cancelar ─────────────────────────────────────────────────────────
  const cancel = () => {
    abortRef.current?.abort();
    setRunning(false);
    setStage("idle");
    message.info("Investigación cancelada");
  };

  // ─── Ejecutar ─────────────────────────────────────────────────────────
  const run = async () => {
    const q = question.trim();
    if (q.length < 12) {
      message.warning("Necesitas al menos 12 caracteres.");
      return;
    }
    setRunning(true);
    setStage("planning");
    setPlan(null);
    setSubqueries([]);
    setAnswer("");
    setChunks([]);
    setError(null);
    setDeliverableId(null);
    setActiveTab("paper");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/deep-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
        signal: ctrl.signal,
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
              if (
                ev.step === "planning" ||
                ev.step === "executing" ||
                ev.step === "fusing" ||
                ev.step === "synthesizing" ||
                ev.step === "annexes" ||
                ev.step === "persisting"
              ) {
                setStage(ev.step);
              }
            }
            if (ev.type === "plan") {
              setPlan(ev.plan);
              setSubqueries(
                ev.plan.subqueries.map((q: string) => ({ query: q, status: "pending" as const }))
              );
            }
            if (ev.type === "subquery_start") {
              setSubqueries((sq) =>
                sq.map((s, i) => (i === ev.index ? { ...s, status: "running" } : s))
              );
            }
            if (ev.type === "subquery_done") {
              setSubqueries((sq) =>
                sq.map((s, i) =>
                  i === ev.index
                    ? { ...s, status: ev.error ? "error" : "done", foundChunks: ev.foundChunks }
                    : s
                )
              );
            }
            if (ev.type === "answer_delta") {
              setAnswer((a) => a + ev.chunk);
            }
            if (ev.type === "complete") {
              setStage("done");
              setAnswer(ev.finalAnswer || "");
              setDeliverableId(ev.deliverableId);
              // Reflejar en URL para que sea compartible y recargable
              if (ev.deliverableId) {
                router.replace(`/deep-research?id=${ev.deliverableId}`);
              }
            }
            if (ev.type === "error") {
              setStage("error");
              setError(ev.message);
            }
          } catch {
            /* skip parse errors */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Error");
      setStage("error");
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  // ─── Parsear secciones del answer ─────────────────────────────────────
  const sections = parseSections(answer);

  const stepIndex =
    stage === "planning" ? 0 :
    stage === "executing" ? 1 :
    stage === "fusing" ? 2 :
    stage === "synthesizing" ? 3 :
    stage === "annexes" ? 4 :
    stage === "persisting" ? 5 :
    stage === "done" ? 6 : 0;

  return (
    <div className="app-page-wide">
      <div style={{ marginBottom: 20 }}>
        <Title level={2} className="serif-title" style={{ margin: 0 }}>
          <CompassOutlined style={{ marginRight: 10 }} />
          Deep Research
        </Title>
        <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 0", maxWidth: 760 }}>
          Investigación agéntica para preguntas amplias. Un planificador descompone tu pregunta
          en 6-8 sub-investigaciones, ejecuta RAG completo (expansion + BM25 + RRF + rerank)
          en cada una, fusiona la evidencia y sintetiza un <em>paper académico</em> con
          cronología, tabla de actores y vacíos del corpus. Tarda 3-7 min y se guarda como producción.
        </Paragraph>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space vertical size={12} style={{ width: "100%" }}>
          <TextArea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              '"¿Cómo se construyó el imaginario nacional en Colombia entre 1850 y 1900, y qué papel jugó la prensa liberal en la disputa con la Iglesia?"'
            }
            autoSize={{ minRows: 4, maxRows: 8 }}
            disabled={running}
          />
          <Space wrap>
            {!running ? (
              <Button
                type="primary"
                icon={<ExperimentOutlined />}
                size="large"
                disabled={question.trim().length < 12}
                onClick={run}
              >
                Iniciar investigación
              </Button>
            ) : (
              <Button danger icon={<StopOutlined />} size="large" onClick={cancel}>
                Cancelar
              </Button>
            )}
            <Tooltip title="Opus 4.7 planifica y sintetiza; Sonnet 4.6 genera los anexos">
              <Text type="secondary" style={{ fontSize: 12 }}>
                <BulbOutlined /> Largo y costoso, pero riguroso
              </Text>
            </Tooltip>
            {deliverableId && (
              <Button
                type="link"
                icon={<BookOutlined />}
                onClick={() => router.push(`/producciones/${deliverableId}`)}
              >
                Abrir en producciones
              </Button>
            )}
          </Space>
        </Space>
      </Card>

      {stage !== "idle" && stage !== "done" && (
        <Card style={{ marginBottom: 16 }}>
          <Steps
            size="small"
            current={stepIndex}
            status={stage === "error" ? "error" : "process"}
            items={[
              { title: "Planificar", icon: <BulbOutlined /> },
              { title: "Recuperar evidencia", icon: <SearchOutlined /> },
              { title: "Fusionar", icon: <ThunderboltOutlined /> },
              { title: "Sintetizar paper", icon: <BookOutlined /> },
              { title: "Anexos", icon: <FileSearchOutlined /> },
              { title: "Guardar" },
            ]}
          />
        </Card>
      )}

      {plan && (
        <Card
          size="small"
          style={{ marginBottom: 16, background: token.colorFillQuaternary, border: "none" }}
          styles={{ body: { padding: 16 } }}
        >
          <Text type="secondary" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Plan del investigador
          </Text>
          {plan.thinking && (
            <Paragraph style={{ marginTop: 8, marginBottom: 8, fontSize: 13, fontStyle: "italic", color: token.colorText }}>
              {plan.thinking}
            </Paragraph>
          )}
          {plan.scope && (
            <Paragraph style={{ marginBottom: 8, fontSize: 13 }}>
              <Text strong>Alcance: </Text>
              {plan.scope}
            </Paragraph>
          )}
          {plan.entities && (
            <Row gutter={[8, 4]} style={{ marginTop: 8 }}>
              {plan.entities.temporalidad && (
                <Col><Tag color="geekblue" icon={<CalendarOutlined />}>{plan.entities.temporalidad}</Tag></Col>
              )}
              {plan.entities.personas?.slice(0, 8).map((p) => (
                <Col key={p}><Tag color="magenta">{p}</Tag></Col>
              ))}
              {plan.entities.instituciones?.slice(0, 6).map((p) => (
                <Col key={p}><Tag color="orange">{p}</Tag></Col>
              ))}
              {plan.entities.lugares?.slice(0, 6).map((p) => (
                <Col key={p}><Tag color="green">{p}</Tag></Col>
              ))}
              {plan.entities.conceptos?.slice(0, 6).map((p) => (
                <Col key={p}><Tag color="purple">{p}</Tag></Col>
              ))}
            </Row>
          )}
        </Card>
      )}

      {subqueries.length > 0 && (
        <Card
          title={`Sub-investigaciones (${subqueries.length})`}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Space vertical size={6} style={{ width: "100%" }}>
            {subqueries.map((sq, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  background: token.colorFillQuaternary,
                  borderRadius: 6,
                }}
              >
                <Tag style={{ fontFamily: "var(--font-mono)", fontSize: 10, margin: 0 }}>#{i + 1}</Tag>
                <Text style={{ fontSize: 13, flex: 1 }}>{sq.query}</Text>
                {sq.foundChunks !== undefined && (
                  <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>
                    {sq.foundChunks} frags
                  </Tag>
                )}
                {sq.status === "pending" && <Tag style={{ fontSize: 10, margin: 0 }}>pendiente</Tag>}
                {sq.status === "running" && <Tag color="processing" style={{ fontSize: 10, margin: 0 }}>buscando…</Tag>}
                {sq.status === "done" && <Tag color="success" style={{ fontSize: 10, margin: 0 }}>✓</Tag>}
                {sq.status === "error" && <Tag color="error" style={{ fontSize: 10, margin: 0 }}>error</Tag>}
              </div>
            ))}
          </Space>
        </Card>
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          closable
          style={{ marginBottom: 16 }}
          onClose={() => setError(null)}
        />
      )}

      {(answer || stage === "synthesizing" || stage === "annexes" || stage === "persisting") && (
        <Card styles={{ body: { padding: 0 } }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type="card"
            size="middle"
            style={{ padding: "8px 16px 0" }}
            items={[
              {
                key: "paper",
                label: <span><BookOutlined /> Paper</span>,
                children: (
                  <div style={{ padding: "20px 32px 40px" }}>
                    <MarkdownWithCitations text={sections.paper} chunks={chunks} />
                  </div>
                ),
              },
              {
                key: "cronologia",
                label: <span><CalendarOutlined /> Cronología</span>,
                disabled: !sections.cronologia,
                children: (
                  <div style={{ padding: "20px 32px 40px" }}>
                    {sections.cronologia ? (
                      <MarkdownWithCitations text={sections.cronologia} chunks={chunks} />
                    ) : (
                      <Empty description="Aún no generada" />
                    )}
                  </div>
                ),
              },
              {
                key: "actores",
                label: <span><TeamOutlined /> Actores</span>,
                disabled: !sections.actores,
                children: (
                  <div style={{ padding: "20px 32px 40px" }}>
                    {sections.actores ? (
                      <MarkdownWithCitations text={sections.actores} chunks={chunks} />
                    ) : (
                      <Empty description="Aún no generada" />
                    )}
                  </div>
                ),
              },
              {
                key: "vacios",
                label: <span><FileSearchOutlined /> Vacíos</span>,
                disabled: !sections.vacios,
                children: (
                  <div style={{ padding: "20px 32px 40px" }}>
                    {sections.vacios ? (
                      <MarkdownWithCitations text={sections.vacios} chunks={chunks} />
                    ) : (
                      <Empty description="Aún no generada" />
                    )}
                  </div>
                ),
              },
              {
                key: "fuentes",
                label: <span><HistoryOutlined /> Fuentes ({chunks.length})</span>,
                disabled: chunks.length === 0,
                children: (
                  <div style={{ padding: "16px 24px 40px" }}>
                    {chunks.length > 0 ? (
                      <Space vertical size={8} style={{ width: "100%" }}>
                        {chunks.map((c, i) => (
                          <Card key={c.id ?? i} size="small" styles={{ body: { padding: 12 } }}>
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
                                style={{
                                  fontFamily: "var(--font-serif)",
                                  fontSize: 13,
                                  lineHeight: 1.6,
                                  margin: 0,
                                  color: token.colorTextSecondary,
                                }}
                              >
                                {c.content}
                              </Paragraph>
                            )}
                          </Card>
                        ))}
                      </Space>
                    ) : (
                      <Empty description="Sin fuentes registradas" />
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      )}

      {stage === "idle" && !answer && (
        <Card>
          <Empty description="Plantea una pregunta amplia de investigación para empezar" />
        </Card>
      )}
    </div>
  );
}

/**
 * Parsea el `answer` (markdown completo) y separa por secciones para los tabs.
 *
 * El backend de deep-research compone:
 *   [paper-academico, con # Título + ## El problema ... ## Conclusión]
 *   ---
 *   ## Cronología (tabla)
 *   ---
 *   ## Actores principales (tabla)
 *   ---
 *   ## Lo que el corpus no responde (lista)
 *   ---
 *   ## Referencias (APA)
 */
function parseSections(text: string): {
  paper: string;
  cronologia: string;
  actores: string;
  vacios: string;
  referencias: string;
} {
  if (!text) return { paper: "", cronologia: "", actores: "", vacios: "", referencias: "" };

  const markers: Array<{ name: keyof ReturnType<typeof parseSections>; regex: RegExp }> = [
    { name: "cronologia", regex: /^##\s+Cronolog[íi]a\s*$/m },
    { name: "actores", regex: /^##\s+Actores\s+principales\s*$/m },
    { name: "vacios", regex: /^##\s+Lo\s+que\s+el\s+corpus\s+no\s+responde\s*$/m },
    { name: "referencias", regex: /^##\s+Referencias\s*$/m },
  ];

  const positions: Array<{ name: string; start: number }> = [];
  for (const m of markers) {
    const match = m.regex.exec(text);
    if (match) positions.push({ name: m.name, start: match.index });
  }
  positions.sort((a, b) => a.start - b.start);

  const sections = { paper: "", cronologia: "", actores: "", vacios: "", referencias: "" };

  if (positions.length === 0) {
    sections.paper = text;
    return sections;
  }

  sections.paper = stripTrailingSeparator(text.slice(0, positions[0].start));
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].start;
    const end = i + 1 < positions.length ? positions[i + 1].start : text.length;
    sections[positions[i].name as keyof typeof sections] = stripTrailingSeparator(text.slice(start, end));
  }
  return sections;
}

function stripTrailingSeparator(s: string): string {
  return s.replace(/\n*-{3,}\s*$/g, "").trim();
}

/**
 * Renderiza markdown sustituyendo [#N] por un Popover con hover que muestra
 * documento, página y snippet del chunk citado.
 */
function MarkdownWithCitations({
  text,
  chunks,
}: {
  text: string;
  chunks: ChunkMeta[];
}) {
  const { token } = theme.useToken();
  // Sustituimos [#N] por una sintaxis inline `#N` que ReactMarkdown rendea
  // como <code> y nosotros interceptamos en el componente custom.
  const prepared = text.replace(/\[#(\d+(?:\s*,\s*\d+)*)\]/g, (_m, nums) => {
    // Soporta [#3, #7, #12] con múltiples números
    const list = String(nums)
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    return list.map((n) => `\`#${n}\``).join(" ");
  });

  return (
    <div className="prose-academic">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ children, ...props }) {
            const txt = String(children).replace(/`/g, "");
            const m = /^#(\d+)$/.exec(txt);
            if (m) {
              const idx = parseInt(m[1], 10) - 1;
              const chunk = chunks[idx];
              if (!chunk) {
                return <code {...props}>{children}</code>;
              }
              const popoverContent = (
                <div style={{ maxWidth: 360 }}>
                  <Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                    {chunk.documentFilename ?? "Documento sin nombre"}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    p. {chunk.pageNumber}
                    {chunk.similarity !== undefined &&
                      ` · sim ${(chunk.similarity * 100).toFixed(0)}%`}
                  </Text>
                  {chunk.content && (
                    <>
                      <Divider style={{ margin: "8px 0" }} />
                      <Paragraph
                        style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: 12.5,
                          lineHeight: 1.5,
                          margin: 0,
                          color: token.colorTextSecondary,
                        }}
                      >
                        {chunk.content}
                      </Paragraph>
                    </>
                  )}
                </div>
              );
              return (
                <Popover content={popoverContent} mouseEnterDelay={0.15} placement="top">
                  <span
                    className="citation"
                    style={{
                      cursor: "help",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.8em",
                      padding: "1px 5px",
                      borderRadius: 4,
                      background: `${token.colorWarning}1F`,
                      color: token.colorWarning,
                      border: `1px solid ${token.colorWarning}40`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    #{m[1]}
                  </span>
                </Popover>
              );
            }
            return <code {...props}>{children}</code>;
          },
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
