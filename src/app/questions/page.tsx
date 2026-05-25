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
    entity: params.get("entity") ?? "",
    yearMin: "",
    yearMax: "",
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
  const [entityOptions, setEntityOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const LIMIT = 30;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/entities?limit=400&minMentions=1", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        type EntityRow = { name: string; type: string; mentions: number };
        const opts = (data.entities as EntityRow[] | undefined ?? []).map((e) => ({
          value: e.name,
          label: `${e.name} · ${e.type === "person" ? "👤" : e.type === "place" ? "📍" : "💡"} ${e.mentions}`,
        }));
        setEntityOptions(opts);
      })
      .catch((e) => { if ((e as Error).name !== "AbortError") console.error(e); });
    return () => ctrl.abort();
  }, []);

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
        if (filters.entity) p.set("entity", filters.entity);
        if (filters.yearMin) p.set("yearMin", filters.yearMin);
        if (filters.yearMax) p.set("yearMax", filters.yearMax);
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
  }, [filters.documentId, filters.periodo, filters.categoria, filters.search, filters.entity, filters.yearMin, filters.yearMax, filters.sortBy, stateFilter, page]);

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
            allowClear
            placeholder="Entidad (persona/lugar/concepto)"
            style={{ width: 260 }}
            value={filters.entity || undefined}
            onChange={(v) => updateFilters({ entity: v ?? "", page: "1" })}
            showSearch
            optionFilterProp="label"
            notFoundContent={null}
            options={entityOptions}
          />
          <Input
            placeholder="Año desde"
            style={{ width: 100, fontFamily: "var(--font-mono)" }}
            value={filters.yearMin}
            onChange={(e) =>
              updateFilters({
                yearMin: e.target.value.replace(/[^0-9-]/g, ""),
                page: "1",
              })
            }
            allowClear
          />
          <Input
            placeholder="Año hasta"
            style={{ width: 100, fontFamily: "var(--font-mono)" }}
            value={filters.yearMax}
            onChange={(e) =>
              updateFilters({
                yearMax: e.target.value.replace(/[^0-9-]/g, ""),
                page: "1",
              })
            }
            allowClear
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
  const isCards = view === "cards";

  return (
    <Card
      hoverable
      styles={{ body: { padding: isCards ? 18 : 14 } }}
      style={{ borderLeft: `4px solid ${periodColor}` }}
    >
      <Row gutter={isCards ? 18 : 12} wrap={false} align="top">
        {/* Estampa del año principal */}
        {question.yearPrincipal != null && (
          <Col flex="none" style={{ minWidth: isCards ? 72 : 56 }}>
            <div
              style={{
                background: `${periodColor}14`,
                border: `1px solid ${periodColor}33`,
                borderRadius: 8,
                padding: isCards ? "10px 8px" : "6px 6px",
                textAlign: "center",
                fontFamily: "var(--font-mono)",
              }}
              title={`Año principal del proceso central de la pregunta`}
            >
              <div
                style={{
                  fontSize: isCards ? 20 : 15,
                  fontWeight: 700,
                  color: periodColor,
                  lineHeight: 1.1,
                }}
              >
                {question.yearPrincipal}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: token.colorTextTertiary,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginTop: 2,
                }}
              >
                {question.periodoRango || "—"}
              </div>
            </div>
          </Col>
        )}

        <Col flex="auto" style={{ minWidth: 0 }}>
          <Space vertical size={isCards ? 10 : 6} style={{ width: "100%" }}>
            {/* Pregunta */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  minWidth: 26,
                  textAlign: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  background: token.colorFillSecondary,
                  borderRadius: 4,
                  padding: "1px 6px",
                  color: token.colorTextSecondary,
                  flex: "0 0 auto",
                }}
              >
                {question.questionNumber}
              </span>
              <Text
                style={{
                  fontSize: isCards ? 15 : 14,
                  lineHeight: 1.55,
                  color: token.colorText,
                  fontWeight: 500,
                }}
              >
                {question.pregunta}
              </Text>
            </div>

            {/* Meta: período + categoría + subcategoría + años secundarios */}
            <Space wrap size={[6, 6]}>
              <Tooltip title={question.periodoRango}>
                <Tag
                  style={{
                    background: `${periodColor}1F`,
                    border: `1px solid ${periodColor}3D`,
                    color: periodColor,
                    fontSize: 11,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  {question.periodoNombre}
                </Tag>
              </Tooltip>
              <Tag
                style={{
                  background: `${categoryColor}1F`,
                  border: `1px solid ${categoryColor}3D`,
                  color: categoryColor,
                  fontSize: 11,
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                {question.categoriaNombre}
              </Tag>
              {question.subcategoriaNombre && (
                <Tag
                  style={{
                    fontSize: 11,
                    background: token.colorFillTertiary,
                    border: "none",
                    color: token.colorTextSecondary,
                    margin: 0,
                  }}
                >
                  {question.subcategoriaNombre}
                </Tag>
              )}
              {yearsSec.length > 0 && (
                <Tooltip title="Años secundarios — antecedentes, hitos, consecuencias">
                  <Tag
                    style={{
                      fontSize: 11,
                      background: "transparent",
                      border: `1px dashed ${token.colorBorder}`,
                      color: token.colorTextTertiary,
                      fontFamily: "var(--font-mono)",
                      margin: 0,
                    }}
                  >
                    + {yearsSec.join(", ")}
                  </Tag>
                </Tooltip>
              )}
            </Space>

            {/* Justificación */}
            {question.justificacion && (
              <Paragraph
                ellipsis={{ rows: isCards ? 3 : 2, expandable: true, symbol: "más" }}
                style={{
                  fontSize: 12.5,
                  color: token.colorTextSecondary,
                  margin: 0,
                  fontStyle: "italic",
                  lineHeight: 1.55,
                }}
              >
                {question.justificacion}
              </Paragraph>
            )}

            {/* Entidades — siempre visibles si existen */}
            {hasEntities && (
              <EntitiesRow
                personas={personas}
                lugares={lugares}
                conceptos={conceptos}
                compact={!isCards}
              />
            )}

            {/* Footer compact: doc + producciones + producir */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 4,
                paddingTop: 8,
                borderTop: `1px dashed ${token.colorBorderSecondary}`,
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Space size={10} wrap>
                {question.document && (
                  <Tooltip title={question.document.filename}>
                    <Link
                      href={`/documents/${question.document.id}`}
                      style={{ fontSize: 11, color: token.colorTextTertiary }}
                    >
                      <FileTextOutlined /> {question.document.filename.slice(0, 38)}
                      {question.document.filename.length > 38 ? "…" : ""}
                    </Link>
                  </Tooltip>
                )}
                <Tag
                  color={totalDelivs > 0 ? "success" : "default"}
                  icon={totalDelivs > 0 ? <CheckCircleFilled /> : <ClockCircleOutlined />}
                  style={{ margin: 0, fontSize: 11 }}
                >
                  {totalDelivs} producciones
                </Tag>
              </Space>
              <Link href={`/questions/matriz?focus=${question.id}`}>
                <Button size="small" type="text">
                  Producir →
                </Button>
              </Link>
            </div>
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
  compact = false,
}: {
  personas: string[];
  lugares: string[];
  conceptos: string[];
  compact?: boolean;
}) {
  const { token } = theme.useToken();

  const group = (
    label: string,
    icon: string,
    items: string[],
    color: string,
  ) => {
    if (items.length === 0) return null;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Tooltip title={`${label} clave de la pregunta`}>
          <span
            style={{
              fontSize: 10,
              color,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              minWidth: compact ? 60 : 72,
              paddingTop: 3,
              flex: "0 0 auto",
            }}
          >
            {icon} {label}
          </span>
        </Tooltip>
        <Space size={[4, 4]} wrap style={{ flex: 1 }}>
          {items.map((it) => (
            <Tag
              key={`${label}-${it}`}
              style={{
                fontSize: 11,
                border: `1px solid ${color}40`,
                background: `${color}14`,
                color,
                margin: 0,
                fontWeight: 500,
              }}
            >
              {it}
            </Tag>
          ))}
        </Space>
      </div>
    );
  };

  return (
    <Space vertical size={compact ? 4 : 6} style={{ width: "100%" }}>
      {group("Personas", "◐", personas, token.colorInfo)}
      {group("Lugares", "◈", lugares, token.colorSuccess)}
      {group("Conceptos", "◇", conceptos, token.colorWarning)}
    </Space>
  );
}
