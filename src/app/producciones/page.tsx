"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  Typography,
  Tag,
  Space,
  Button,
  Select,
  Input,
  Pagination,
  Empty,
  theme,
  Row,
  Col,
  Skeleton,
  Modal,
  App,
  Segmented,
  Form,
} from "antd";
import {
  AppstoreOutlined,
  SearchOutlined,
  PlusOutlined,
  MessageOutlined,
  DatabaseOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { CHAT_TEMPLATES, CATEGORY_LABELS, getTemplateById, type TemplateCategory } from "@/lib/chat-templates";
import { getPeriodColor, getCategoryColor } from "@/lib/theme";

const { Title, Text, Paragraph } = Typography;

interface DeliverableItem {
  id: string;
  templateId: string;
  status: string;
  source: "chat" | "batch";
  modelUsed: string;
  createdAt: string;
  answerPreview: string;
  userQuestion: string | null;
  question: null | {
    id: string;
    pregunta: string;
    periodoCode: string;
    periodoNombre: string;
    categoriaCode: string;
    categoriaNombre: string;
    document?: { id: string; filename: string };
  };
}

export default function ProduccionesPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [items, setItems] = useState<DeliverableItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [templateId, setTemplateId] = useState<string | undefined>();
  const [category, setCategory] = useState<TemplateCategory | undefined>();
  const [source, setSource] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showNew, setShowNew] = useState(false);
  const LIMIT = 30;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("limit", String(LIMIT));
      if (templateId) p.set("templateId", templateId);
      if (source) p.set("source", source);
      const res = await fetch(`/api/deliverables?${p}`);
      const data = await res.json();
      let list = data.deliverables ?? [];
      if (category) {
        list = list.filter((d: DeliverableItem) => getTemplateById(d.templateId)?.category === category);
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter(
          (d: DeliverableItem) =>
            d.question?.pregunta?.toLowerCase().includes(q) ||
            d.userQuestion?.toLowerCase().includes(q) ||
            d.answerPreview?.toLowerCase().includes(q),
        );
      }
      setItems(list);
      setTotal(data.pagination?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, templateId, source, category, search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <div className="app-page-wide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <Title level={2} className="serif-title" style={{ margin: 0 }}>
            Producciones
          </Title>
          <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 0" }}>
            Respuestas generadas. {total} producciones en total.
          </Paragraph>
        </div>
        <Space>
          <Link href="/bibliography">
            <Button>Bibliografía</Button>
          </Link>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowNew(true)}>
            Nueva producción
          </Button>
        </Space>
      </div>

      <Card bordered style={{ marginBottom: 16 }}>
        <Space wrap size={10}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Buscar en preguntas y respuestas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 300 }}
          />
          <Select
            allowClear
            placeholder="Categoría"
            style={{ width: 160 }}
            value={category}
            onChange={setCategory}
            options={Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          />
          <Select
            allowClear
            placeholder="Template"
            style={{ width: 240 }}
            value={templateId}
            onChange={setTemplateId}
            showSearch
            optionFilterProp="label"
            options={CHAT_TEMPLATES.map((t) => ({ value: t.id, label: `${t.icon} ${t.name}` }))}
          />
          <Select
            allowClear
            placeholder="Origen"
            style={{ width: 140 }}
            value={source}
            onChange={setSource}
            options={[
              { value: "chat", label: <><MessageOutlined /> Chat</> },
              { value: "batch", label: <><DatabaseOutlined /> Batch</> },
            ]}
          />
          <Segmented
            value={view}
            onChange={(v) => setView(v as "grid" | "list")}
            options={[
              { value: "grid", icon: <AppstoreOutlined /> },
              { value: "list", icon: <UnorderedListOutlined /> },
            ]}
          />
        </Space>
      </Card>

      {loading ? (
        <Card bordered><Skeleton active paragraph={{ rows: 8 }} /></Card>
      ) : items.length === 0 ? (
        <Card bordered>
          <Empty description="Sin producciones con estos filtros" />
        </Card>
      ) : view === "grid" ? (
        <Row gutter={[12, 12]}>
          {items.map((d) => (
            <Col key={d.id} xs={24} md={12} lg={8} xl={6}>
              <ProductionCard item={d} />
            </Col>
          ))}
        </Row>
      ) : (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          {items.map((d) => (
            <ProductionRow key={d.id} item={d} />
          ))}
        </Space>
      )}

      <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
        <Pagination
          current={page}
          pageSize={LIMIT}
          total={total}
          onChange={setPage}
          showSizeChanger={false}
          showTotal={(t) => `${t} producciones`}
        />
      </div>

      <NewProductionModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onSuccess={() => {
          fetchItems();
          message.success("Producción encolada");
        }}
      />
    </div>
  );
}

function ProductionCard({ item }: { item: DeliverableItem }) {
  const { token } = theme.useToken();
  const tpl = getTemplateById(item.templateId);
  const periodColor = item.question?.periodoCode ? getPeriodColor(item.question.periodoCode) : token.colorTextTertiary;
  const categoryColor = item.question?.categoriaCode ? getCategoryColor(item.question.categoriaCode) : undefined;
  const title = item.question?.pregunta ?? item.userQuestion ?? "(producción libre)";

  return (
    <Link href={`/producciones/${item.id}`}>
      <Card
        hoverable
        bordered
        style={{ borderTop: `3px solid ${periodColor}`, height: "100%" }}
        bodyStyle={{ padding: 14 }}
      >
        <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}>
          <Space size={6}>
            <span style={{ fontSize: 18 }}>{tpl?.icon ?? "📝"}</span>
            <Text strong style={{ fontSize: 12 }}>
              {tpl?.name ?? item.templateId}
            </Text>
          </Space>
          <Tag color={item.source === "chat" ? "geekblue" : "purple"} style={{ fontSize: 10, margin: 0 }}>
            {item.source === "chat" ? "chat" : "batch"}
          </Tag>
        </Space>
        <Paragraph
          ellipsis={{ rows: 3 }}
          style={{ fontFamily: "var(--font-serif)", fontSize: 13.5, lineHeight: 1.55, color: token.colorText, margin: 0, marginBottom: 10 }}
        >
          {title}
        </Paragraph>
        <Paragraph
          ellipsis={{ rows: 3 }}
          style={{ fontSize: 12, lineHeight: 1.5, color: token.colorTextSecondary, margin: 0, marginBottom: 10 }}
        >
          {item.answerPreview}
        </Paragraph>
        <Space size={4} wrap>
          {item.question?.periodoNombre && (
            <Tag style={{ background: `${periodColor}1A`, border: "none", color: periodColor, fontSize: 10, margin: 0 }}>
              {item.question.periodoNombre}
            </Tag>
          )}
          {item.question?.categoriaNombre && categoryColor && (
            <Tag style={{ background: `${categoryColor}1A`, border: "none", color: categoryColor, fontSize: 10, margin: 0 }}>
              {item.question.categoriaNombre}
            </Tag>
          )}
          {item.status === "GENERATING" && <Tag color="processing" style={{ margin: 0, fontSize: 10 }}>generando</Tag>}
        </Space>
        <Text style={{ fontSize: 11, color: token.colorTextTertiary, display: "block", marginTop: 8 }}>
          {dayjs(item.createdAt).format("DD MMM YY · HH:mm")}
        </Text>
      </Card>
    </Link>
  );
}

function ProductionRow({ item }: { item: DeliverableItem }) {
  const { token } = theme.useToken();
  const tpl = getTemplateById(item.templateId);
  const periodColor = item.question?.periodoCode ? getPeriodColor(item.question.periodoCode) : token.colorTextTertiary;
  const title = item.question?.pregunta ?? item.userQuestion ?? "(producción libre)";

  return (
    <Link href={`/producciones/${item.id}`}>
      <Card hoverable bordered bodyStyle={{ padding: 12 }} style={{ borderLeft: `3px solid ${periodColor}` }}>
        <Row gutter={12} align="middle">
          <Col flex="auto">
            <Space direction="vertical" size={4} style={{ width: "100%" }}>
              <Space>
                <span style={{ fontSize: 16 }}>{tpl?.icon}</span>
                <Text strong style={{ fontSize: 13 }}>{tpl?.name}</Text>
                {item.question?.periodoNombre && (
                  <Tag style={{ background: `${periodColor}1A`, border: "none", color: periodColor, fontSize: 10, margin: 0 }}>
                    {item.question.periodoNombre}
                  </Tag>
                )}
              </Space>
              <Text style={{ fontSize: 13.5, color: token.colorText, fontFamily: "var(--font-serif)" }}>{title}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>{item.answerPreview.slice(0, 180)}…</Text>
            </Space>
          </Col>
          <Col>
            <Space direction="vertical" align="end" size={4}>
              <Tag color={item.source === "chat" ? "geekblue" : "purple"} style={{ fontSize: 10, margin: 0 }}>
                {item.source}
              </Tag>
              <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>
                {dayjs(item.createdAt).format("DD MMM YY")}
              </Text>
            </Space>
          </Col>
        </Row>
      </Card>
    </Link>
  );
}

function NewProductionModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: values.question,
          templateId: values.templateId,
          topK: 100,
          similarityThreshold: 0.25,
        }),
      });
      if (!res.ok) throw new Error("HTTP error");
      message.success("Producción iniciada");
      form.resetFields();
      onSuccess();
      onClose();
    } catch {
      message.error("Error al crear producción");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Nueva producción"
      okText="Generar"
      onOk={handleSubmit}
      confirmLoading={submitting}
      width={580}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="question"
          label="Pregunta"
          rules={[{ required: true, message: "Pregunta requerida" }]}
        >
          <Input.TextArea rows={4} placeholder="¿Qué quieres investigar?" />
        </Form.Item>
        <Form.Item
          name="templateId"
          label="Template"
          rules={[{ required: true, message: "Selecciona un template" }]}
          initialValue="mini-ensayo"
        >
          <Select
            options={CHAT_TEMPLATES.map((t) => ({ value: t.id, label: `${t.icon} ${t.name}` }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
