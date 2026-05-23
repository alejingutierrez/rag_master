"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Tag,
  Space,
  Button,
  theme,
  Progress,
  Tooltip,
  Empty,
} from "antd";
import {
  FileTextOutlined,
  ApartmentOutlined,
  BookOutlined,
  AppstoreOutlined,
  CloudUploadOutlined,
  MessageOutlined,
  ArrowRightOutlined,
  RiseOutlined,
  ExperimentOutlined,
  RocketOutlined,
  BulbOutlined,
  HeatMapOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import { getPeriodColor, getCategoryColor } from "@/lib/theme";
import { PERIOD_OPTIONS } from "@/lib/taxonomy";
import { getDocumentDisplayName } from "@/lib/enrichment-types";
import { ActivitySparkline } from "@/components/dashboard/activity-sparkline";
import { PeriodDistributionBar } from "@/components/dashboard/period-distribution";

const { Title, Text, Paragraph } = Typography;

interface DashboardData {
  stats: {
    documents: number;
    chunks: number;
    questions: number;
    conversations: number;
    deliverables: number;
    completedDeliverables: number;
    readyDocs: number;
    processingDocs: number;
    enrichedDocs: number;
  };
  deltas7d: { docs: number; questions: number; deliverables: number };
  recentDocuments: Array<{
    id: string;
    filename: string;
    status: string;
    pageCount: number;
    enriched: boolean;
    metadata?: Record<string, unknown>;
    _count: { chunks: number; questions: number };
    createdAt: string;
  }>;
  recentQuestions: Array<{
    id: string;
    pregunta: string;
    periodoCode: string;
    periodoNombre: string;
    categoriaCode: string;
    categoriaNombre: string;
    createdAt: string;
  }>;
  recentDeliverables: Array<{
    id: string;
    templateId: string;
    updatedAt: string;
    userQuestion?: string | null;
    question?: { pregunta: string; periodoCode: string } | null;
  }>;
  distribution: {
    periodos: Array<{ code: string; count: number }>;
    periodos30d: Array<{ code: string; count: number }>;
    categorias: Array<{ code: string; name: string; count: number }>;
  };
  activity: Array<{ day: string; docs: number; questions: number; deliverables: number }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = theme.useToken();

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalDocs = data?.stats.documents ?? 0;
  const completionPct =
    data && data.stats.questions > 0
      ? Math.round((data.stats.completedDeliverables / data.stats.questions) * 100)
      : 0;
  const enrichmentPct =
    totalDocs > 0 ? Math.round((data!.stats.enrichedDocs / totalDocs) * 100) : 0;

  return (
    <div className="app-page-wide">
      <div style={{ marginBottom: 28 }}>
        <Text style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: token.colorTextTertiary }}>
          Plataforma de investigación
        </Text>
        <Title
          level={1}
          className="serif-title"
          style={{ margin: "6px 0 8px", fontSize: 32 }}
        >
          Archivo Histórico Digital
        </Title>
        <Paragraph style={{ color: token.colorTextSecondary, fontSize: 15, maxWidth: 720, margin: 0 }}>
          Corpus vectorizado de historia colombiana, con búsqueda semántica,
          generación de preguntas guiadas y producciones académicas con citación.
        </Paragraph>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <StatCard
            loading={loading}
            label="Documentos"
            value={data?.stats.documents ?? 0}
            delta={data?.deltas7d.docs ?? 0}
            icon={<FileTextOutlined />}
            color={token.colorPrimary}
            footer={`${data?.stats.readyDocs ?? 0} listos · ${data?.stats.processingDocs ?? 0} en proceso`}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            loading={loading}
            label="Chunks"
            value={data?.stats.chunks ?? 0}
            icon={<ApartmentOutlined />}
            color="#10B981"
            footer="vectorizados con Cohere v4"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            loading={loading}
            label="Preguntas"
            value={data?.stats.questions ?? 0}
            delta={data?.deltas7d.questions ?? 0}
            icon={<BookOutlined />}
            color="#F59E0B"
            footer="taxonomía histórica"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            loading={loading}
            label="Producciones"
            value={data?.stats.completedDeliverables ?? 0}
            delta={data?.deltas7d.deliverables ?? 0}
            icon={<AppstoreOutlined />}
            color="#A855F7"
            footer={`de ${data?.stats.deliverables ?? 0} totales`}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card
            bordered
            title={
              <Space>
                <RiseOutlined />
                <span>Actividad — últimos 14 días</span>
              </Space>
            }
            style={{ height: "100%" }}
          >
            <ActivitySparkline data={data?.activity ?? []} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            bordered
            title="Progreso del corpus"
            style={{ height: "100%" }}
          >
            <Space direction="vertical" size={20} style={{ width: "100%" }}>
              <ProgressMetric
                label="Documentos enriquecidos"
                value={enrichmentPct}
                color={token.colorPrimary}
                detail={`${data?.stats.enrichedDocs ?? 0} de ${totalDocs}`}
              />
              <ProgressMetric
                label="Preguntas con producción"
                value={completionPct}
                color="#10B981"
                detail={`${data?.stats.completedDeliverables ?? 0} de ${data?.stats.questions ?? 0}`}
              />
              <ProgressMetric
                label="Periodos cubiertos"
                value={
                  data
                    ? Math.round(
                        (data.distribution.periodos.filter((p) => p.count > 0).length /
                          PERIOD_OPTIONS.length) *
                          100,
                      )
                    : 0
                }
                color="#F59E0B"
                detail={`${data?.distribution.periodos.filter((p) => p.count > 0).length ?? 0} de ${PERIOD_OPTIONS.length}`}
              />
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24}>
          <Card
            bordered
            title={
              <Space>
                <HeatMapOutlined />
                <span>Distribución por período histórico</span>
              </Space>
            }
            extra={
              <Link href="/coverage">
                <Button type="link" size="small">
                  Ver heatmap completo <ArrowRightOutlined />
                </Button>
              </Link>
            }
          >
            <PeriodDistributionBar
              data={data?.distribution.periodos ?? []}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Text strong style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: token.colorTextTertiary }}>
              Acciones rápidas
            </Text>
            <ActionCard href="/upload" icon={<CloudUploadOutlined />} label="Cargar PDFs" description="Vectoriza fuentes nuevas" color={token.colorPrimary} />
            <ActionCard href="/chat" icon={<MessageOutlined />} label="Consultar" description="Pregunta con citas" color="#10B981" />
            <ActionCard href="/deep-research" icon={<RocketOutlined />} label="Deep Research" description="Agente con thinking extendido" color="#A855F7" />
            <ActionCard href="/hypothesis" icon={<BulbOutlined />} label="Plantear hipótesis" description="Evidencia a favor y en contra" color="#F59E0B" />
            <ActionCard href="/timeline" icon={<RadarChartOutlined />} label="Línea de tiempo" description="Navega por época" color="#EC4899" />
            <ActionCard href="/enrich" icon={<ExperimentOutlined />} label="Enriquecer fuentes" description="Metadata bibliográfica + IA" color="#0891B2" />
          </Space>
        </Col>

        <Col xs={24} lg={16}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card
              bordered
              title={<><FileTextOutlined /> <span style={{ marginLeft: 8 }}>Documentos recientes</span></>}
              extra={
                <Link href="/documents">
                  <Button type="link" size="small">
                    Ver todos <ArrowRightOutlined />
                  </Button>
                </Link>
              }
            >
              {!data || data.recentDocuments.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aún no hay documentos" />
              ) : (
                <Space direction="vertical" size={6} style={{ width: "100%" }}>
                  {data.recentDocuments.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: token.colorFillQuaternary,
                        gap: 12,
                        transition: "background 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                        <FileTextOutlined style={{ color: token.colorTextTertiary, fontSize: 16 }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <Text ellipsis style={{ display: "block", fontWeight: 500, fontSize: 13, color: token.colorText }}>
                            {getDocumentDisplayName(doc)}
                          </Text>
                          <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>
                            {doc._count.chunks} chunks · {doc.pageCount} pp · {doc._count.questions} preguntas
                          </Text>
                        </div>
                      </div>
                      <Space size={6}>
                        {doc.enriched && (
                          <Tooltip title="Enriquecido">
                            <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>✓</Tag>
                          </Tooltip>
                        )}
                        <StatusTag status={doc.status} />
                      </Space>
                    </Link>
                  ))}
                </Space>
              )}
            </Card>

            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <Card
                  bordered
                  size="small"
                  title={<><BookOutlined /> <span style={{ marginLeft: 8 }}>Preguntas recientes</span></>}
                  extra={<Link href="/questions"><Button type="link" size="small">Ver <ArrowRightOutlined /></Button></Link>}
                  style={{ height: "100%" }}
                >
                  {!data || data.recentQuestions.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin preguntas" />
                  ) : (
                    <Space direction="vertical" size={10} style={{ width: "100%" }}>
                      {data.recentQuestions.map((q) => (
                        <div key={q.id} style={{ borderLeft: `2px solid ${getPeriodColor(q.periodoCode)}`, paddingLeft: 10 }}>
                          <Text style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 12.5, lineHeight: 1.4 }}>
                            {q.pregunta}
                          </Text>
                          <Space size={4} style={{ marginTop: 4 }}>
                            <Tag style={{ background: `${getPeriodColor(q.periodoCode)}22`, border: "none", color: getPeriodColor(q.periodoCode), fontSize: 10, margin: 0 }}>
                              {q.periodoNombre}
                            </Tag>
                            <Tag style={{ background: `${getCategoryColor(q.categoriaCode)}22`, border: "none", color: getCategoryColor(q.categoriaCode), fontSize: 10, margin: 0 }}>
                              {q.categoriaNombre}
                            </Tag>
                          </Space>
                        </div>
                      ))}
                    </Space>
                  )}
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card
                  bordered
                  size="small"
                  title={<><AppstoreOutlined /> <span style={{ marginLeft: 8 }}>Producciones recientes</span></>}
                  extra={<Link href="/producciones"><Button type="link" size="small">Ver <ArrowRightOutlined /></Button></Link>}
                  style={{ height: "100%" }}
                >
                  {!data || data.recentDeliverables.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin producciones" />
                  ) : (
                    <Space direction="vertical" size={10} style={{ width: "100%" }}>
                      {data.recentDeliverables.map((p) => {
                        const periodColor = p.question?.periodoCode
                          ? getPeriodColor(p.question.periodoCode)
                          : token.colorTextTertiary;
                        return (
                          <Link key={p.id} href={`/producciones/${p.id}`} style={{ display: "block", borderLeft: `2px solid ${periodColor}`, paddingLeft: 10 }}>
                            <Text style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 12.5, lineHeight: 1.4, color: token.colorText }}>
                              {p.question?.pregunta || p.userQuestion || "(producción)"}
                            </Text>
                            <Tag style={{ marginTop: 4, fontSize: 10 }}>{p.templateId}</Tag>
                          </Link>
                        );
                      })}
                    </Space>
                  )}
                </Card>
              </Col>
            </Row>
          </Space>
        </Col>
      </Row>
    </div>
  );
}

function StatCard({ loading, label, value, delta, icon, color, footer }: { loading: boolean; label: string; value: number; delta?: number; icon: React.ReactNode; color: string; footer?: string }) {
  const { token } = theme.useToken();
  return (
    <Card bordered loading={loading} bodyStyle={{ padding: 18 }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <div>
          <Text style={{ fontSize: 12, color: token.colorTextTertiary }}>{label}</Text>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
            <Statistic value={value} valueStyle={{ fontSize: 24, fontWeight: 600, color: token.colorText }} />
            {delta !== undefined && delta > 0 && (
              <Tag color="green" style={{ margin: 0, fontSize: 10 }}>+{delta} 7d</Tag>
            )}
          </div>
          {footer && <Text style={{ fontSize: 11, color: token.colorTextTertiary, display: "block", marginTop: 6 }}>{footer}</Text>}
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}1A`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
          {icon}
        </div>
      </Space>
    </Card>
  );
}

function ActionCard({ href, icon, label, description, color }: { href: string; icon: React.ReactNode; label: string; description: string; color: string }) {
  const { token } = theme.useToken();
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 10,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        transition: "all 0.15s",
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}1A`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: token.colorText }}>{label}</div>
        <div style={{ fontSize: 11, color: token.colorTextTertiary }}>{description}</div>
      </div>
      <ArrowRightOutlined style={{ color: token.colorTextTertiary, fontSize: 12 }} />
    </Link>
  );
}

function ProgressMetric({ label, value, color, detail }: { label: string; value: number; color: string; detail: string }) {
  const { token } = theme.useToken();
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontSize: 12.5, color: token.colorTextSecondary }}>{label}</Text>
        <Text style={{ fontSize: 12.5, fontWeight: 600, color }}>{value}%</Text>
      </div>
      <Progress percent={value} showInfo={false} strokeColor={color} trailColor={token.colorFillQuaternary} size="small" />
      <Text style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 2, display: "block" }}>{detail}</Text>
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    PENDING: { color: "default", label: "Pendiente" },
    PROCESSING: { color: "processing", label: "Procesando" },
    READY: { color: "success", label: "Listo" },
    ERROR: { color: "error", label: "Error" },
  };
  const cfg = map[status] ?? { color: "default", label: status };
  return <Tag color={cfg.color} style={{ margin: 0, fontSize: 10 }}>{cfg.label}</Tag>;
}
