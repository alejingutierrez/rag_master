"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUrlFilters } from "@/lib/use-url-state";
import {
  Card,
  Typography,
  Tag,
  Space,
  Button,
  Input,
  Select,
  Pagination,
  Empty,
  theme,
  Row,
  Col,
  Tooltip,
  Skeleton,
  Segmented,
  Tabs,
} from "antd";
import {
  SearchOutlined,
  ThunderboltOutlined,
  TableOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  FileTextOutlined,
  PlusOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { PERIOD_OPTIONS, CATEGORY_OPTIONS, getPeriodByCode, getCategoryByCode } from "@/lib/taxonomy";
import { getPeriodColor, getCategoryColor } from "@/lib/theme";

const { Title, Text, Paragraph } = Typography;

type StateFilter = "all" | "pending" | "partial" | "complete";

interface Question {
  id: string;
  questionNumber: number;
  pregunta: string;
  periodoCode: string;
  periodoNombre: string;
  periodoRango: string;
  categoriaCode: string;
  categoriaNombre: string;
  subcategoriaCode: string;
  subcategoriaNombre: string;
  periodosRelacionados: string[];
  categoriasRelacionadas: string[];
  yearPrincipal?: number | null;
  yearsSecondary?: number[];
  entidadesPersonas?: string[];
  entidadesLugares?: string[];
  entidadesConceptos?: string[];
  justificacion: string;
  document: { id: string; filename: string };
  createdAt: string;
  temaPeriodo?: string | null;
  temaCategoria?: string | null;
  deliverableCount?: number;
  completedTemplateIds?: string[];
  deliverables?: Array<{ id: string; templateId: string; status: string }>;
}

interface StatsData {
  totalQuestions: number;
  totalDocuments: number;
  byCategoria: Array<{ code: string; nombre: string; count: number }>;
  byPeriodo: Array<{ code: string; nombre: string; count: number }>;
  byState?: { pending: number; partial: number; complete: number; all: number };
  totalTemplates?: number;
}

const SORT_OPTIONS = [
  { value: "cronologico", label: "Cronológico" },
  { value: "periodo", label: "Por periodo" },
  { value: "categoria", label: "Por categoría" },
  { value: "subcategoria", label: "Por subcategoría" },
  { value: "recientes", label: "Recientes" },
];

export default function QuestionsPage() {
  return (
    <Suspense fallback={<div className="app-page-wide"><Skeleton active /></div>}>
      <QuestionsContent />
    </Suspense>
  );
}

function QuestionsContent() {
  const params = useSearchParams();
  const { token } = theme.useToken();

  const [filters, updateFilters] = useUrlFilters({
    documentId: params.get("documentId") ?? "",
    periodo: params.get("periodo") ?? "",
    categoria: "",
    search: "",
    sortBy: "cronologico",
    state: "all",
    view: "list",
    page: "1",
  });

  const stateFilter = filters.state as StateFilter;
  const page = Math.max(1, Number(filters.page) || 1);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [docs, setDocs] = useState<Array<{ id: string; filename: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const LIMIT = 30;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/documents?limit=300", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => setDocs(data.documents ?? []))
      .catch((e) => { if ((e as Error).name !== "AbortError") console.error(e); });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/questions?includeStats=true&limit=1", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => setStats(data.stats ?? null))
      .catch((e) => { if ((e as Error).name !== "AbortError") console.error(e); });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/questions/generate-batch", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setPendingCount(d.pendingCount ?? 0))
      .catch((e) => { if ((e as Error).name !== "AbortError") console.error(e); });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const p = new URLSearchParams();
        if (filters.documentId) p.set("documentId", filters.documentId);
        if (filters.periodo) p.set("periodo", filters.periodo);
        if (filters.categoria) p.set("categoria", filters.categoria);
        if (filters.search) p.set("search", filters.search);
        if (filters.sortBy) p.set("sortBy", filters.sortBy);
        if (stateFilter !== "all") p.set("state", stateFilter);
        p.set("includeDeliverables", "true");
        p.set("page", String(page));
        p.set("limit", String(LIMIT));
        const res = await fetch(`/api/questions?${p}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (ctrl.signal.aborted) return;
        setQuestions(data.questions ?? []);
        setTotal(data.pagination?.total ?? 0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") console.error(e);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [filters.documentId, filters.periodo, filters.categoria, filters.search, filters.sortBy, stateFilter, page]);

  const grouped = (() => {
    if (filters.sortBy === "periodo" || filters.sortBy === "cronologico") {
      const out: Record<string, Question[]> = {};
      for (const q of questions) {
        (out[q.periodoCode] = out[q.periodoCode] || []).push(q);
      }
      return out;
    }
    if (filters.sortBy === "categoria") {
      const out: Record<string, Question[]> = {};
      for (const q of questions) {
        (out[q.categoriaCode] = out[q.categoriaCode] || []).push(q);
      }
      return out;
    }
    return null;
  })();

  return (
    <div className="app-page-wide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
        <div>
          <Title level={2} className="serif-title" style={{ margin: 0 }}>
            Preguntas de investigación
          </Title>
          <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 0" }}>
            {total > 0 ? `${total} preguntas generadas` : "Sin preguntas aún"} · taxonomía histórica colombiana
          </Paragraph>
        </div>
        <Space wrap>
          <Link href="/questions/matriz">
            <Button icon={<TableOutlined />}>Matriz de producción</Button>
          </Link>
          {pendingCount > 0 && (
            <Link href="/questions/matriz">
              <Tooltip title="Producir respuestas en lote para preguntas sin producción">
                <Button type="default" icon={<ThunderboltOutlined />}>
                  Producir {pendingCount} pendientes
                </Button>
              </Tooltip>
            </Link>
          )}
          <Link href="/questions/generate">
            <Button type="primary" icon={<PlusOutlined />}>
              Generar preguntas
            </Button>
          </Link>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card styles={{ body: { padding: 14 } }}>
            <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>Total</Text>
            <div style={{ fontSize: 22, fontWeight: 600, color: token.colorText }}>{stats?.totalQuestions ?? 0}</div>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card styles={{ body: { padding: 14 } }}>
            <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>Sin producción</Text>
            <div style={{ fontSize: 22, fontWeight: 600, color: token.colorWarning }}>{stats?.byState?.pending ?? 0}</div>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card styles={{ body: { padding: 14 } }}>
            <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>Parciales</Text>
            <div style={{ fontSize: 22, fontWeight: 600, color: token.colorPrimary }}>{stats?.byState?.partial ?? 0}</div>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card styles={{ body: { padding: 14 } }}>
            <Text style={{ fontSize: 11, color: token.colorTextTertiary }}>Completas</Text>
            <div style={{ fontSize: 22, fontWeight: 600, color: token.colorSuccess }}>{stats?.byState?.complete ?? 0}</div>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={10}>
          <Input
            allowClear
            placeholder="Buscar en preguntas y justificaciones…"
            prefix={<SearchOutlined />}
            style={{ width: 320 }}
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value, page: "1" })}
          />
          <Select
            allowClear
            placeholder="Documento"
            style={{ width: 240 }}
            value={filters.documentId || undefined}
            onChange={(v) => updateFilters({ documentId: v ?? "", page: "1" })}
            showSearch
            optionFilterProp="label"
            options={docs.map((d) => ({ value: d.id, label: d.filename }))}
          />
          <Select
            allowClear
            placeholder="Período"
            style={{ width: 220 }}
            value={filters.periodo || undefined}
            onChange={(v) => updateFilters({ periodo: v ?? "", page: "1" })}
            showSearch
            optionFilterProp="label"
            options={PERIOD_OPTIONS.map((p) => ({ value: p.code, label: p.nombre }))}
          />
          <Select
            allowClear
            placeholder="Categoría"
            style={{ width: 220 }}
            value={filters.categoria || undefined}
            onChange={(v) => updateFilters({ categoria: v ?? "", page: "1" })}
            showSearch
            optionFilterProp="label"
            options={CATEGORY_OPTIONS.map((c) => ({ value: c.code, label: c.nombre }))}
          />
          <Select
            style={{ width: 160 }}
            value={filters.sortBy}
            onChange={(v) => updateFilters({ sortBy: v, page: "1" })}
            options={SORT_OPTIONS}
          />
          <Segmented
            value={filters.view}
            onChange={(v) => updateFilters({ view: String(v) })}
            options={[
              { value: "list", icon: <UnorderedListOutlined /> },
              { value: "cards", icon: <AppstoreOutlined /> },
            ]}
          />
        </Space>
      </Card>

      <Tabs
        activeKey={stateFilter}
        onChange={(k) => updateFilters({ state: k, page: "1" })}
        items={[
          { key: "all", label: `Todas (${stats?.byState?.all ?? 0})` },
          { key: "pending", label: `Sin producción (${stats?.byState?.pending ?? 0})` },
          { key: "partial", label: `Parciales (${stats?.byState?.partial ?? 0})` },
          { key: "complete", label: `Completas (${stats?.byState?.complete ?? 0})` },
        ]}
      />

      {loading ? (
        <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>
      ) : questions.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Sin preguntas con estos filtros"
          />
        </Card>
      ) : grouped ? (
        <div>
          {Object.entries(grouped).map(([code, qs]) => {
            const isPeriod = filters.sortBy === "periodo" || filters.sortBy === "cronologico";
            const p = isPeriod ? getPeriodByCode(code) : undefined;
            const c = !isPeriod ? getCategoryByCode(code) : undefined;
            const color = isPeriod ? getPeriodColor(code) : getCategoryColor(code);
            return (
              <div key={code} style={{ marginBottom: 24 }}>
                <div
                  style={{
                    position: "sticky",
                    top: 64,
                    zIndex: 2,
                    background: token.colorBgLayout,
                    padding: "12px 0",
                    borderBottom: `2px solid ${color}`,
                    marginBottom: 12,
                  }}
                >
                  <Space>
                    <Tag style={{ background: `${color}1A`, border: "none", color, fontWeight: 600 }}>
                      {p?.nombre || c?.nombre || code}
                    </Tag>
                    {p?.rango && <Text type="secondary" style={{ fontSize: 12 }}>{p.rango}</Text>}
                    <Text type="secondary" style={{ fontSize: 12 }}>{qs.length} preguntas</Text>
                  </Space>
                </div>
                <Space vertical size={8} style={{ width: "100%" }}>
                  {qs.map((q) => (
                    <QuestionRow key={q.id} question={q} view={filters.view as "list" | "cards"} />
                  ))}
                </Space>
              </div>
            );
          })}
        </div>
      ) : (
        <Space vertical size={8} style={{ width: "100%" }}>
          {questions.map((q) => (
            <QuestionRow key={q.id} question={q} view={filters.view as "list" | "cards"} />
          ))}
        </Space>
      )}

      <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
        <Pagination
          current={page}
          pageSize={LIMIT}
          total={total}
          onChange={(p) => {
            updateFilters({ page: String(p) });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          showSizeChanger={false}
          showTotal={(t) => `${t} preguntas`}
        />
      </div>
    </div>
  );
}

function QuestionRow({ question, view }: { question: Question; view: "list" | "cards" }) {
  const { token } = theme.useToken();
  const periodColor = getPeriodColor(question.periodoCode);
  const categoryColor = getCategoryColor(question.categoriaCode);
  const totalDelivs = question.deliverableCount ?? 0;

  const personas = question.entidadesPersonas ?? [];
  const lugares = question.entidadesLugares ?? [];
  const conceptos = question.entidadesConceptos ?? [];
  const yearsSec = question.yearsSecondary ?? [];
  const hasEntities = personas.length + lugares.length + conceptos.length > 0;

  return (
    <Card
      hoverable
      styles={{ body: { padding: 14 } }}
      style={{ borderLeft: `3px solid ${periodColor}` }}
    >
      <Row gutter={12} align="middle">
        <Col flex="auto">
          <Space vertical size={6} style={{ width: "100%" }}>
            <Text style={{ fontSize: 14, lineHeight: 1.5, color: token.colorText, fontWeight: 500 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 26,
                  textAlign: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  background: token.colorFillSecondary,
                  borderRadius: 4,
                  padding: "1px 4px",
                  marginRight: 8,
                  color: token.colorTextSecondary,
                }}
              >
                {question.questionNumber}
              </span>
              {question.pregunta}
            </Text>
            <Space wrap size={4}>
              <Tag style={{ background: `${periodColor}1A`, border: "none", color: periodColor, fontSize: 10 }}>
                {question.periodoNombre}
              </Tag>
              {question.yearPrincipal != null && (
                <Tag
                  style={{
                    background: token.colorFillSecondary,
                    border: "none",
                    color: token.colorText,
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                  }}
                >
                  {question.yearPrincipal}
                  {yearsSec.length > 0 && (
                    <span style={{ color: token.colorTextTertiary, fontWeight: 400 }}>
                      {" "}· {yearsSec.join(", ")}
                    </span>
                  )}
                </Tag>
              )}
              <Tag style={{ background: `${categoryColor}1A`, border: "none", color: categoryColor, fontSize: 10 }}>
                {question.categoriaNombre}
              </Tag>
              {question.subcategoriaNombre && <Tag style={{ fontSize: 10 }}>{question.subcategoriaNombre}</Tag>}
            </Space>
            {view === "cards" && (
              <Paragraph
                ellipsis={{ rows: 2, expandable: true, symbol: "leer más" }}
                style={{ fontSize: 12, color: token.colorTextTertiary, margin: 0 }}
              >
                {question.justificacion}
              </Paragraph>
            )}
            {view === "cards" && hasEntities && (
              <EntitiesRow personas={personas} lugares={lugares} conceptos={conceptos} />
            )}
          </Space>
        </Col>
        <Col>
          <Space vertical size={4} align="end">
            <Tag
              color={totalDelivs > 0 ? "success" : "default"}
              icon={totalDelivs > 0 ? <CheckCircleFilled /> : <ClockCircleOutlined />}
              style={{ margin: 0, fontSize: 11 }}
            >
              {totalDelivs} producciones
            </Tag>
            {question.document && (
              <Tooltip title={question.document.filename}>
                <Link
                  href={`/documents/${question.document.id}`}
                  style={{ fontSize: 11, color: token.colorTextTertiary }}
                >
                  <FileTextOutlined /> {question.document.filename.slice(0, 24)}
                </Link>
              </Tooltip>
            )}
            <Space size={4}>
              <Link href={`/questions/matriz?focus=${question.id}`}>
                <Button size="small" type="text">Producir</Button>
              </Link>
            </Space>
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

function EntitiesRow({
  personas,
  lugares,
  conceptos,
}: {
  personas: string[];
  lugares: string[];
  conceptos: string[];
}) {
  const { token } = theme.useToken();

  const group = (
    label: string,
    items: string[],
    color: string,
  ) => {
    if (items.length === 0) return null;
    return (
      <Space size={4} wrap>
        <Text style={{ fontSize: 10, color: token.colorTextTertiary, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {label}
        </Text>
        {items.map((it) => (
          <Tag
            key={`${label}-${it}`}
            style={{
              fontSize: 10,
              border: `1px solid ${color}33`,
              background: `${color}0F`,
              color,
              margin: 0,
            }}
          >
            {it}
          </Tag>
        ))}
      </Space>
    );
  };

  return (
    <Space vertical size={4} style={{ width: "100%", marginTop: 4 }}>
      {group("Personas", personas, token.colorInfo)}
      {group("Lugares", lugares, token.colorSuccess)}
      {group("Conceptos", conceptos, token.colorWarning)}
    </Space>
  );
}
