"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  Typography,
  Space,
  Tag,
  Button,
  theme,
  App,
  Row,
  Col,
  Empty,
  Modal,
  Form,
  Input,
  Skeleton,
} from "antd";
import {
  ReadOutlined,
  PlusOutlined,
  DeleteOutlined,
  ArrowRightOutlined,
  FileTextOutlined,
  BookOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text, Paragraph } = Typography;

interface Workspace {
  id: string;
  name: string;
  description?: string;
  pinned: { documents: string[]; questions: string[]; productions: string[] };
  notes: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "rag-master-workspaces";

function loadWS(): Workspace[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveWS(w: Workspace[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(w));
}

export default function WorkspacesPage() {
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const [ws, setWs] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    setWs(loadWS());
    setLoading(false);
  }, []);

  const create = async () => {
    try {
      const v = await form.validateFields();
      const newWs: Workspace = {
        id: Math.random().toString(36).slice(2),
        name: v.name,
        description: v.description,
        pinned: { documents: [], questions: [], productions: [] },
        notes: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = [...ws, newWs];
      setWs(updated);
      saveWS(updated);
      message.success("Workspace creado");
      setShowNew(false);
      form.resetFields();
    } catch {
      /* validation */
    }
  };

  const remove = (id: string) => {
    modal.confirm({
      title: "Eliminar workspace",
      content: "Los items referenciados no se borran, solo el contenedor.",
      okText: "Eliminar",
      okButtonProps: { danger: true },
      onOk: () => {
        const updated = ws.filter((w) => w.id !== id);
        setWs(updated);
        saveWS(updated);
        message.success("Eliminado");
      },
    });
  };

  if (loading) return <div className="app-page-wide"><Skeleton active /></div>;

  return (
    <div className="app-page-wide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <Title level={2} className="serif-title" style={{ margin: 0 }}>
            <ReadOutlined /> Workspaces de investigación
          </Title>
          <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 0", maxWidth: 720 }}>
            Agrupa documentos, preguntas y producciones de un proyecto. Añade notas Markdown libres.
            Persistencia local — pensados como sesiones de trabajo nombradas.
          </Paragraph>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowNew(true)}>
          Nuevo workspace
        </Button>
      </div>

      {ws.length === 0 ? (
        <Card>
          <Empty description="Aún no has creado workspaces">
            <Button type="primary" onClick={() => setShowNew(true)}>Crear primero</Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {ws.map((w) => (
            <Col key={w.id} xs={24} md={12} lg={8}>
              <Card
                title={<Text strong>{w.name}</Text>}
                extra={
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => remove(w.id)} />
                }
                actions={[
                  <Link key="o" href={`/workspaces/${w.id}`}>
                    <Button type="link" icon={<ArrowRightOutlined />}>Abrir</Button>
                  </Link>,
                ]}
              >
                {w.description && (
                  <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }} ellipsis={{ rows: 2 }}>
                    {w.description}
                  </Paragraph>
                )}
                <Space size={6} wrap>
                  <Tag icon={<FileTextOutlined />} style={{ fontSize: 10 }}>{w.pinned.documents.length} docs</Tag>
                  <Tag icon={<BookOutlined />} style={{ fontSize: 10 }}>{w.pinned.questions.length} preguntas</Tag>
                  <Tag icon={<AppstoreOutlined />} style={{ fontSize: 10 }}>{w.pinned.productions.length} prods</Tag>
                </Space>
                <Text style={{ fontSize: 11, color: token.colorTextTertiary, display: "block", marginTop: 8 }}>
                  Actualizado {dayjs(w.updatedAt).format("DD MMM YY")}
                </Text>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal open={showNew} title="Nuevo workspace" onCancel={() => setShowNew(false)} okText="Crear" onOk={create}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input placeholder="Ej: Tesis sobre el Frente Nacional" />
          </Form.Item>
          <Form.Item name="description" label="Descripción (opcional)">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
