"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  Typography,
  Space,
  Tag,
  Skeleton,
  theme,
  Row,
  Col,
  Tooltip,
  Button,
  Empty,
} from "antd";
import {
  RadarChartOutlined,
  FileTextOutlined,
  BookOutlined,
  AppstoreOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { PERIOD_OPTIONS } from "@/lib/taxonomy";
import { getPeriodColor } from "@/lib/theme";

const { Title, Text, Paragraph } = Typography;

interface TimelineData {
  questions: Array<{ periodoCode: string; periodoNombre: string; periodoRango: string; count: number }>;
  docsByPeriod: Array<{ code: string; count: number }>;
  deliverablesByPeriod: Array<{ code: string; count: number }>;
}

export default function TimelinePage() {
  const { token } = theme.useToken();
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/timeline")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <div className="app-page-wide"><Skeleton active /></div>;
  }

  const qByCode = Object.fromEntries(data.questions.map((q) => [q.periodoCode, q.count]));
  const docsByCode = Object.fromEntries(data.docsByPeriod.map((d) => [d.code, d.count]));
  const delivsByCode = Object.fromEntries(data.deliverablesByPeriod.map((d) => [d.code, d.count]));

  // Excluir TRANS para el eje cronológico
  const chronological = PERIOD_OPTIONS.filter((p) => p.code !== "TRANS");
  const maxCount = Math.max(1, ...chronological.map((p) => qByCode[p.code] ?? 0));

  const selectedPeriod = selected ? PERIOD_OPTIONS.find((p) => p.code === selected) : null;

  return (
    <div className="app-page-wide">
      <div style={{ marginBottom: 24 }}>
        <Title level={2} className="serif-title" style={{ margin: 0 }}>
          <RadarChartOutlined /> Línea de tiempo histórica
        </Title>
        <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 0" }}>
          Recorrido cronológico por 14 períodos de la historia colombiana, desde lo prehispánico hasta el posconflicto.
          Cada barra muestra la densidad de preguntas; los anillos, documentos y producciones.
        </Paragraph>
      </div>

      <Card bordered style={{ marginBottom: 16 }}>
        {/* Timeline horizontal */}
        <div style={{ overflowX: "auto", paddingBottom: 12 }}>
          <div style={{ minWidth: 1100, display: "flex", gap: 8, paddingTop: 32 }}>
            {chronological.map((p) => {
              const qCount = qByCode[p.code] ?? 0;
              const docCount = docsByCode[p.code] ?? 0;
              const delivCount = delivsByCode[p.code] ?? 0;
              const heightPct = (qCount / maxCount) * 100;
              const color = getPeriodColor(p.code);
              const isSelected = selected === p.code;

              return (
                <div
                  key={p.code}
                  onClick={() => setSelected(isSelected ? null : p.code)}
                  style={{
                    flex: 1,
                    minWidth: 72,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <div style={{ height: 220, display: "flex", alignItems: "flex-end", width: "100%", position: "relative" }}>
                    <Tooltip
                      title={
                        <div>
                          <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                          <div style={{ fontSize: 11, opacity: 0.85 }}>{p.rango}</div>
                          <div style={{ marginTop: 4, fontSize: 11 }}>
                            {qCount} preguntas · {docCount} docs · {delivCount} producciones
                          </div>
                        </div>
                      }
                    >
                      <div
                        style={{
                          width: "100%",
                          minHeight: 4,
                          height: `${Math.max(4, heightPct)}%`,
                          background: `linear-gradient(to top, ${color}, ${color}88)`,
                          borderRadius: 4,
                          opacity: isSelected ? 1 : 0.85,
                          border: isSelected ? `2px solid ${color}` : "none",
                          boxShadow: isSelected ? `0 0 0 4px ${color}33` : "none",
                          transition: "all 0.2s",
                          position: "relative",
                        }}
                      >
                        {qCount > 0 && heightPct > 15 && (
                          <Text
                            style={{
                              position: "absolute",
                              top: 6,
                              left: 0,
                              right: 0,
                              textAlign: "center",
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#fff",
                              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                            }}
                          >
                            {qCount}
                          </Text>
                        )}
                      </div>
                    </Tooltip>
                  </div>

                  <div style={{ height: 1, background: color, width: "100%", margin: "8px 0" }} />

                  <Text style={{ fontSize: 10, color: token.colorTextTertiary, fontFamily: "var(--font-mono)" }}>
                    {p.rango}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: isSelected ? color : token.colorText,
                      fontWeight: isSelected ? 600 : 500,
                      textAlign: "center",
                      lineHeight: 1.25,
                      marginTop: 4,
                      maxWidth: 90,
                    }}
                  >
                    {p.nombre.split(" ").slice(0, 3).join(" ")}
                  </Text>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leyenda */}
        <Space size={20} style={{ marginTop: 16 }}>
          <Space size={6}>
            <div style={{ width: 12, height: 12, background: token.colorPrimary, borderRadius: 2 }} />
            <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>Preguntas (altura)</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Click en un período para explorar
          </Text>
        </Space>
      </Card>

      {/* Detalle del período seleccionado */}
      {selectedPeriod ? (
        <Card
          bordered
          title={
            <Space>
              <Tag
                style={{
                  background: `${getPeriodColor(selectedPeriod.code)}1A`,
                  border: "none",
                  color: getPeriodColor(selectedPeriod.code),
                  fontSize: 14,
                  padding: "4px 10px",
                }}
              >
                {selectedPeriod.nombre}
              </Tag>
              <Text type="secondary">{selectedPeriod.rango}</Text>
            </Space>
          }
          extra={
            <Space>
              <Link href={`/questions?periodo=${selectedPeriod.code}`}>
                <Button type="link" size="small">
                  Ver preguntas <ArrowRightOutlined />
                </Button>
              </Link>
            </Space>
          }
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card bordered size="small">
                <Space direction="vertical" size={4}>
                  <BookOutlined style={{ fontSize: 20, color: getPeriodColor(selectedPeriod.code) }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Preguntas</Text>
                  <Text style={{ fontSize: 26, fontWeight: 600 }}>{qByCode[selectedPeriod.code] ?? 0}</Text>
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card bordered size="small">
                <Space direction="vertical" size={4}>
                  <FileTextOutlined style={{ fontSize: 20, color: getPeriodColor(selectedPeriod.code) }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Documentos</Text>
                  <Text style={{ fontSize: 26, fontWeight: 600 }}>{docsByCode[selectedPeriod.code] ?? 0}</Text>
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card bordered size="small">
                <Space direction="vertical" size={4}>
                  <AppstoreOutlined style={{ fontSize: 20, color: getPeriodColor(selectedPeriod.code) }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Producciones</Text>
                  <Text style={{ fontSize: 26, fontWeight: 600 }}>{delivsByCode[selectedPeriod.code] ?? 0}</Text>
                </Space>
              </Card>
            </Col>
          </Row>
        </Card>
      ) : (
        <Empty description="Selecciona un período para ver detalles" />
      )}
    </div>
  );
}
