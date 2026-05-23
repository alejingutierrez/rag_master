"use client";

import { useEffect, useState } from "react";
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
  Row,
  Col,
  Empty,
  Skeleton,
  Modal,
  Form,
  Select,
} from "antd";
import {
  NodeIndexOutlined,
  PlusOutlined,
  DeleteOutlined,
  ArrowRightOutlined,
  BookOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

interface Thread {
  id: string;
  title: string;
  description?: string;
  steps: Array<{ type: "question" | "production" | "note"; id?: string; text?: string; templateId?: string }>;
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

export default function ThreadsPage() {
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    setThreads(loadThreads());
    setLoading(false);
  }, []);

  const createThread = async () => {
    try {
      const values = await form.validateFields();
      const t: Thread = {
        id: Math.random().toString(36).slice(2),
        title: values.title,
        description: values.description,
        steps: [],
        createdAt: new Date().toISOString(),
      };
      const updated = [...threads, t];
      setThreads(updated);
      saveThreads(updated);
      message.success("Hilo creado");
      setShowNew(false);
      form.resetFields();
    } catch {
      /* validation */
    }
  };

  const removeThread = (id: string) => {
    modal.confirm({
      title: "Eliminar hilo",
      content: "Esto borra el hilo localmente. Las preguntas y producciones referenciadas no se borran.",
      okText: "Eliminar",
      okButtonProps: { danger: true },
      onOk: () => {
        const updated = threads.filter((t) => t.id !== id);
        setThreads(updated);
        saveThreads(updated);
        message.success("Hilo eliminado");
      },
    });
  };

  if (loading) return <div className="app-page-wide"><Skeleton active /></div>;

  return (
    <div className="app-page-wide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <Title level={2} className="serif-title" style={{ margin: 0 }}>
            <NodeIndexOutlined /> Hilos de investigación
          </Title>
          <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 0", maxWidth: 720 }}>
            Encadena preguntas, producciones y notas en secuencias temáticas.
            Útil para construir argumentos largos o tesis encadenadas. Almacenamiento local.
          </Paragraph>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowNew(true)}>
          Nuevo hilo
        </Button>
      </div>

      {threads.length === 0 ? (
        <Card bordered>
          <Empty description="Aún no has creado hilos">
            <Button type="primary" onClick={() => setShowNew(true)}>
              Crear primer hilo
            </Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {threads.map((t) => (
            <Col key={t.id} xs={24} md={12} lg={8}>
              <Card
                bordered
                title={
                  <Space>
                    <NodeIndexOutlined />
                    <Text strong>{t.title}</Text>
                  </Space>
                }
                extra={
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeThread(t.id)} />
                }
                actions={[
                  <Link key="open" href={`/threads/${t.id}`}>
                    <Button type="link" icon={<ArrowRightOutlined />}>Abrir hilo</Button>
                  </Link>,
                ]}
              >
                {t.description && (
                  <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }} ellipsis={{ rows: 2 }}>
                    {t.description}
                  </Paragraph>
                )}
                <Space size={6} wrap>
                  <Tag icon={<BookOutlined />} style={{ fontSize: 10 }}>
                    {t.steps.filter((s) => s.type === "question").length} preguntas
                  </Tag>
                  <Tag icon={<AppstoreOutlined />} style={{ fontSize: 10 }}>
                    {t.steps.filter((s) => s.type === "production").length} producciones
                  </Tag>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        open={showNew}
        title="Nuevo hilo de investigación"
        onCancel={() => setShowNew(false)}
        okText="Crear"
        onOk={createThread}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Título" rules={[{ required: true }]}>
            <Input placeholder="Ej: La construcción del Estado-nación en el siglo XIX" />
          </Form.Item>
          <Form.Item name="description" label="Descripción (opcional)">
            <Input.TextArea rows={3} placeholder="Resumen del hilo de investigación…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
