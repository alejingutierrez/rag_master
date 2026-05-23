"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  Typography,
  Space,
  Tag,
  Button,
  Input,
  theme,
  Skeleton,
  Empty,
  Segmented,
  Alert,
  Row,
  Col,
} from "antd";
import {
  UserOutlined,
  EnvironmentOutlined,
  ReadOutlined,
  SearchOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

interface Entity {
  name: string;
  mentions: number;
  docCount: number;
  pageCount: number;
  type: "person" | "place" | "concept";
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  person: { icon: <UserOutlined />, color: "#6366F1", label: "Persona" },
  place: { icon: <EnvironmentOutlined />, color: "#10B981", label: "Lugar" },
  concept: { icon: <ReadOutlined />, color: "#A855F7", label: "Concepto" },
};

export default function EntitiesPage() {
  const { token } = theme.useToken();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "person" | "place" | "concept">("all");
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/entities?limit=200&minMentions=3&sample=400")
      .then((r) => r.json())
      .then((d) => setEntities(d.entities ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = entities;
    if (filter !== "all") list = list.filter((e) => e.type === filter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((e) => e.name.toLowerCase().includes(q));
    return list;
  }, [entities, filter, search]);

  const maxMentions = Math.max(1, ...entities.map((e) => e.mentions));

  return (
    <div className="app-page-wide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={2} className="serif-title" style={{ margin: 0 }}>
            <UserOutlined /> Entidades del corpus
          </Title>
          <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 0", maxWidth: 720 }}>
            Personas, lugares y conceptos extraídos automáticamente de los chunks (heurística, no NER profesional).
            Tamaño = frecuencia de aparición.
          </Paragraph>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Recargar</Button>
      </div>

      <Alert
        type="info"
        showIcon
        message="Implementación heurística"
        description="La extracción usa regex sobre secuencias capitalizadas. Para producción, integrar un NER en español (spaCy es, Stanza o Claude prompting estructurado)."
        closable
        style={{ marginBottom: 16 }}
      />

      <Card bordered style={{ marginBottom: 16 }}>
        <Space wrap size={10}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Buscar entidad…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as typeof filter)}
            options={[
              { value: "all", label: "Todas" },
              { value: "person", label: "Personas", icon: <UserOutlined /> },
              { value: "place", label: "Lugares", icon: <EnvironmentOutlined /> },
              { value: "concept", label: "Conceptos", icon: <ReadOutlined /> },
            ]}
          />
        </Space>
      </Card>

      {loading ? (
        <Card bordered><Skeleton active paragraph={{ rows: 8 }} /></Card>
      ) : filtered.length === 0 ? (
        <Empty description="Sin entidades" />
      ) : (
        <Row gutter={[12, 12]}>
          {filtered.map((e) => {
            const cfg = TYPE_CONFIG[e.type];
            const intensity = e.mentions / maxMentions;
            const size = 12 + intensity * 12;
            return (
              <Col key={e.name} xs={24} sm={12} md={8} lg={6}>
                <Card
                  bordered
                  hoverable
                  size="small"
                  bodyStyle={{ padding: 14 }}
                  style={{ borderLeft: `3px solid ${cfg.color}` }}
                >
                  <Space style={{ width: "100%", justifyContent: "space-between" }}>
                    <Space size={8} style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ color: cfg.color, fontSize: 16, flexShrink: 0 }}>{cfg.icon}</span>
                      <Text strong style={{ fontSize: size, lineHeight: 1.3 }}>{e.name}</Text>
                    </Space>
                    <Tag style={{ background: `${cfg.color}1A`, border: "none", color: cfg.color, fontSize: 10, fontFamily: "var(--font-mono)" }}>
                      {e.mentions}
                    </Tag>
                  </Space>
                  <Space size={6} style={{ marginTop: 8, fontSize: 11, color: token.colorTextTertiary }}>
                    <span>{e.docCount} docs</span>
                    <span>·</span>
                    <span>{e.pageCount} pp</span>
                  </Space>
                  <Link href={`/chat?q=${encodeURIComponent(e.name)}`}>
                    <Button type="link" size="small" style={{ padding: 0, marginTop: 6, fontSize: 11 }}>
                      Consultar →
                    </Button>
                  </Link>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
