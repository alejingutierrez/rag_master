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
import { PERIOD_OPTIONS, PERIOD_YEAR_BOUNDS } from "@/lib/taxonomy";
import { getPeriodColor, getCategoryColor } from "@/lib/theme";

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

      <Card style={{ marginBottom: 16 }}>
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
              <Card size="small">
                <Space vertical size={4}>
                  <BookOutlined style={{ fontSize: 20, color: getPeriodColor(selectedPeriod.code) }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Preguntas</Text>
                  <Text style={{ fontSize: 26, fontWeight: 600 }}>{qByCode[selectedPeriod.code] ?? 0}</Text>
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card size="small">
                <Space vertical size={4}>
                  <FileTextOutlined style={{ fontSize: 20, color: getPeriodColor(selectedPeriod.code) }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Documentos</Text>
                  <Text style={{ fontSize: 26, fontWeight: 600 }}>{docsByCode[selectedPeriod.code] ?? 0}</Text>
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card size="small">
                <Space vertical size={4}>
                  <AppstoreOutlined style={{ fontSize: 20, color: getPeriodColor(selectedPeriod.code) }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Producciones</Text>
                  <Text style={{ fontSize: 26, fontWeight: 600 }}>{delivsByCode[selectedPeriod.code] ?? 0}</Text>
                </Space>
              </Card>
            </Col>
          </Row>

          {/* Timeline real por yearPrincipal dentro del período */}
          <InnerPeriodTimeline periodoCode={selectedPeriod.code} />
        </Card>
      ) : (
        <Empty description="Selecciona un período para ver detalles" />
      )}
    </div>
  );
}

// ─── Timeline anidado por año real ──────────────────────────────────────────
interface InnerQ {
  id: string;
  pregunta: string;
  yearPrincipal: number | null;
  categoriaCode: string;
  categoriaNombre: string;
}

function InnerPeriodTimeline({ periodoCode }: { periodoCode: string }) {
  const { token } = theme.useToken();
  const [items, setItems] = useState<InnerQ[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    (async () => {
      if (!cancelled) setLoading(true);
      try {
        const r = await fetch(
          `/api/questions?periodo=${periodoCode}&limit=200&sortBy=cronologico`,
          { signal: ctrl.signal },
        );
        const d = await r.json();
        if (cancelled) return;
        setItems(d.questions ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [periodoCode]);

  const bounds = PERIOD_YEAR_BOUNDS[periodoCode];
  if (!bounds) return null;

  // Para PRE el rango "real" es muy ancho (-10000 a 1499). Usamos 0–1499 visualmente.
  const xStart = periodoCode === "PRE" ? 800 : bounds.start;
  const xEnd = bounds.end;

  const withYear = items.filter((q) => q.yearPrincipal != null);
  const withoutYear = items.filter((q) => q.yearPrincipal == null);

  const periodColor = getPeriodColor(periodoCode);

  const xPct = (year: number) => {
    const clamped = Math.max(xStart, Math.min(xEnd, year));
    return ((clamped - xStart) / Math.max(1, xEnd - xStart)) * 100;
  };

  // Marcadores: 5 ticks equiespaciados
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(
    (p) => Math.round(xStart + p * (xEnd - xStart))
  );

  if (loading) {
    return <div style={{ marginTop: 16 }}><Skeleton active paragraph={{ rows: 2 }} /></div>;
  }

  if (items.length === 0) {
    return null;
  }

  // Asignar pista vertical (lane) a cada pregunta para que no se sobrepongan
  // demasiado: ordenamos por año y vamos buscando la primera lane libre.
  const sorted = [...withYear].sort((a, b) => (a.yearPrincipal ?? 0) - (b.yearPrincipal ?? 0));
  const LANE_COUNT = 6;
  const MIN_DELTA_PCT = 3.5; // si dos puntos están a <3.5% pixel, se separan en otra lane
  const lanes: number[] = []; // último xPct usado en esa lane
  const positioned = sorted.map((q) => {
    const x = xPct(q.yearPrincipal!);
    let lane = lanes.findIndex((last) => Math.abs(x - last) >= MIN_DELTA_PCT);
    if (lane === -1) {
      if (lanes.length < LANE_COUNT) {
        lane = lanes.length;
        lanes.push(x);
      } else {
        // saturación: ciclar entre lanes
        lane = lanes.length % LANE_COUNT;
        lanes[lane] = x;
      }
    } else {
      lanes[lane] = x;
    }
    return { q, x, lane };
  });

  return (
    <div style={{ marginTop: 20 }}>
      <Space size={6} style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 600 }}>
          Cronología fina por año principal
        </Text>
        <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>
          {withYear.length} preguntas con año {withoutYear.length > 0 && `· ${withoutYear.length} sin año`}
        </Text>
      </Space>

      <div
        style={{
          position: "relative",
          height: 200,
          background: token.colorFillTertiary,
          borderRadius: 8,
          padding: "12px 12px 28px 12px",
          overflow: "hidden",
        }}
      >
        {/* Tick lines */}
        {ticks.map((y) => (
          <div
            key={`tick-${y}`}
            style={{
              position: "absolute",
              left: `calc(12px + ${xPct(y)}% * (100% - 24px) / 100%)`,
              top: 12,
              bottom: 28,
              width: 1,
              background: `${token.colorBorderSecondary}55`,
            }}
          />
        ))}

        {/* Points */}
        {positioned.map(({ q, x, lane }) => {
          const color = getCategoryColor(q.categoriaCode);
          const top = 16 + lane * 26;
          return (
            <Tooltip
              key={q.id}
              title={
                <div style={{ maxWidth: 320 }}>
                  <div style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>{q.yearPrincipal}</div>
                  <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
                    {q.categoriaNombre}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12 }}>{q.pregunta.slice(0, 200)}{q.pregunta.length > 200 ? "…" : ""}</div>
                </div>
              }
            >
              <Link href={`/questions?focus=${q.id}`}>
                <span
                  style={{
                    position: "absolute",
                    left: `calc(12px + ${x}% * (100% - 24px) / 100%)`,
                    top,
                    transform: "translateX(-50%)",
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: color,
                    border: `2px solid ${periodColor}`,
                    boxShadow: `0 0 0 2px ${token.colorBgContainer}`,
                    cursor: "pointer",
                    display: "block",
                  }}
                />
              </Link>
            </Tooltip>
          );
        })}

        {/* Eje x */}
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 18,
            height: 1,
            background: token.colorBorder,
          }}
        />
        {ticks.map((y) => (
          <Text
            key={`label-${y}`}
            style={{
              position: "absolute",
              left: `calc(12px + ${xPct(y)}% * (100% - 24px) / 100%)`,
              bottom: 4,
              transform: "translateX(-50%)",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: token.colorTextTertiary,
            }}
          >
            {y}
          </Text>
        ))}
      </div>

      <Text style={{ fontSize: 10, color: token.colorTextTertiary, marginTop: 8, display: "block" }}>
        Cada punto = una pregunta. Color = categoría. Hover para ver. Click para abrir.
      </Text>
    </div>
  );
}
