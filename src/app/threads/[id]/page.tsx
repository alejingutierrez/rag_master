"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
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
  Modal,
  Form,
  Select,
  Timeline,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  BookOutlined,
  AppstoreOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";

const { Title, Text, Paragraph } = Typography;

interface Step {
  id: string;
  type: "question" | "production" | "note";
  refId?: string;
  text?: string;
  templateId?: string;
}

interface Thread {
  id: string;
  title: string;
  description?: string;
  steps: Step[];
  createdAt: string;
}

const STORAGE_KEY = "rag-master-threads";

function loadThreads(): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveThreads(t: Thread[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

export default function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [thread, setThread] = useState<Thread | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form] = Form.useForm();
  const [questions, setQuestions] = useState<Array<{ id: string; pregunta: string }>>([]);

  useEffect(() => {
    const all = loadThreads();
    const t = all.find((x) => x.id === id) ?? null;
    setThread(t);
  }, [id]);

  useEffect(() => {
    fetch("/api/questions?limit=200")
      .then((r) => r.json())
      .then((d) => setQuestions(d.questions ?? []))
      .catch(console.error);
  }, []);

  if (!thread) {
    return (
      <div className="app-page">
        <Empty description="Hilo no encontrado" />
      </div>
    );
  }

  const persist = (newSteps: Step[]) => {
    const updated = { ...thread, steps: newSteps };
    setThread(updated);
    const all = loadThreads().map((t) => (t.id === id ? updated : t));
    saveThreads(all);
  };

  const handleAdd = async () => {
    try {
      const v = await form.validateFields();
      const step: Step = {
        id: Math.random().toString(36).slice(2),
        type: v.type,
        refId: v.refId,
        text: v.text,
      };
      persist([...thread.steps, step]);
      message.success("Paso añadido");
      setShowAdd(false);
      form.resetFields();
    } catch {
      /* val */
    }
  };

  const removeStep = (stepId: string) => {
    persist(thread.steps.filter((s) => s.id !== stepId));
  };

  return (
    <div className="app-page">
      <Link href="/threads">
        <Button type="text" icon={<ArrowLeftOutlined />} style={{ marginBottom: 12 }}>
          Volver a hilos
        </Button>
      </Link>

      <Title level={2} className="serif-title" style={{ margin: 0 }}>
        {thread.title}
      </Title>
      {thread.description && (
        <Paragraph style={{ color: token.colorTextSecondary, margin: "8px 0 0" }}>
          {thread.description}
        </Paragraph>
      )}

      <div style={{ margin: "20px 0", display: "flex", justifyContent: "flex-end" }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowAdd(true)}>
          Añadir paso
        </Button>
      </div>

      <Card bordered>
        {thread.steps.length === 0 ? (
          <Empty description="Hilo vacío — añade preguntas, producciones o notas" />
        ) : (
          <Timeline
            items={thread.steps.map((s) => {
              const q = questions.find((qq) => qq.id === s.refId);
              return {
                dot:
                  s.type === "question" ? (
                    <BookOutlined style={{ fontSize: 16, color: token.colorWarning }} />
                  ) : s.type === "production" ? (
                    <AppstoreOutlined style={{ fontSize: 16, color: "#A855F7" }} />
                  ) : (
                    <EditOutlined style={{ fontSize: 16, color: token.colorPrimary }} />
                  ),
                children: (
                  <Card bordered size="small" bodyStyle={{ padding: 12 }} style={{ marginBottom: 8 }}>
                    <Space style={{ width: "100%", justifyContent: "space-between" }}>
                      <Tag color={s.type === "question" ? "orange" : s.type === "production" ? "purple" : "blue"}>
                        {s.type}
                      </Tag>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeStep(s.id)} />
                    </Space>
                    {s.type === "question" && q && (
                      <div style={{ marginTop: 8 }}>
                        <Text style={{ fontSize: 14, fontFamily: "var(--font-serif)" }}>{q.pregunta}</Text>
                        <div style={{ marginTop: 6 }}>
                          <Link href={`/questions?focus=${q.id}`}>
                            <Button type="link" size="small">Ver pregunta →</Button>
                          </Link>
                        </div>
                      </div>
                    )}
                    {s.type === "production" && s.refId && (
                      <div style={{ marginTop: 8 }}>
                        <Link href={`/producciones/${s.refId}`}>
                          <Button type="link" size="small">Ver producción →</Button>
                        </Link>
                      </div>
                    )}
                    {s.type === "note" && s.text && (
                      <div className="prose-academic" style={{ marginTop: 8, fontSize: 14 }}>
                        <ReactMarkdown>{s.text}</ReactMarkdown>
                      </div>
                    )}
                  </Card>
                ),
              };
            })}
          />
        )}
      </Card>

      <Modal
        open={showAdd}
        title="Añadir paso al hilo"
        onCancel={() => setShowAdd(false)}
        okText="Añadir"
        onOk={handleAdd}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="type" label="Tipo" initialValue="note" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "question", label: "Pregunta del corpus" },
                { value: "production", label: "ID de producción" },
                { value: "note", label: "Nota libre (Markdown)" },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
            {({ getFieldValue }) => {
              const type = getFieldValue("type");
              if (type === "question") {
                return (
                  <Form.Item name="refId" label="Pregunta" rules={[{ required: true }]}>
                    <Select
                      showSearch
                      optionFilterProp="label"
                      options={questions.slice(0, 200).map((q) => ({
                        value: q.id,
                        label: q.pregunta.slice(0, 80),
                      }))}
                    />
                  </Form.Item>
                );
              }
              if (type === "production") {
                return (
                  <Form.Item name="refId" label="ID de producción" rules={[{ required: true }]}>
                    <Input placeholder="ID de producción" />
                  </Form.Item>
                );
              }
              return (
                <Form.Item name="text" label="Texto (Markdown)" rules={[{ required: true }]}>
                  <Input.TextArea rows={5} />
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
