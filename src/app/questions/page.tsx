"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUrlFilters } from "@/lib/use-url-state";
import { Pagination } from "antd";
import {
  Search,
  Zap,
  Table as TableIcon,
  LayoutGrid,
  List as ListIcon,
  FileText,
  Plus,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip,
} from "@/components/ui";
import { PeriodBadge } from "@/components/domain/period-badge";
import { CategoryChip } from "@/components/domain/category-chip";
import {
  PERIOD_OPTIONS,
  CATEGORY_OPTIONS,
  getPeriodByCode,
  getCategoryByCode,
} from "@/lib/taxonomy";
import { periodSlug, categorySlug } from "@/lib/design-tokens";
import { cn } from "@/lib/cn";

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
    <Suspense
      fallback={
        <div className="app-page-wide">
          <Skeleton variant="line" className="h-8 w-64 mb-4" />
          <Skeleton variant="line" className="h-4 w-full mb-2" />
          <Skeleton variant="line" className="h-4 w-3/4" />
        </div>
      }
    >
      <QuestionsContent />
    </Suspense>
  );
}

function QuestionsContent() {
  const params = useSearchParams();

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
  const [entityOptions, setEntityOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
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
        const opts = (data.entities as EntityRow[] | undefined ?? []).map(
          (e) => ({
            value: e.name,
            label: `${e.name} · ${
              e.type === "person" ? "👤" : e.type === "place" ? "📍" : "💡"
            } ${e.mentions}`,
          }),
        );
        setEntityOptions(opts);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") console.error(e);
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/documents?limit=300", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => setDocs(data.documents ?? []))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") console.error(e);
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/questions?includeStats=true&limit=1", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => setStats(data.stats ?? null))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") console.error(e);
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/questions/generate-batch", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setPendingCount(d.pendingCount ?? 0))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") console.error(e);
      });
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
        const res = await fetch(`/api/questions?${p}`, {
          signal: ctrl.signal,
        });
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
  }, [
    filters.documentId,
    filters.periodo,
    filters.categoria,
    filters.search,
    filters.entity,
    filters.yearMin,
    filters.yearMax,
    filters.sortBy,
    stateFilter,
    page,
  ]);

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
      {/* Hero */}
      <header className="flex justify-between items-end mb-5 flex-wrap gap-4">
        <div>
          <h1
            className="serif-title text-[36px] leading-tight m-0 text-[var(--color-ink-1000)]"
            style={{ fontWeight: 700 }}
          >
            Preguntas de investigación
          </h1>
          <p className="text-[14px] text-[var(--fg-muted)] mt-1.5 mb-0">
            {total > 0 ? `${total} preguntas generadas` : "Sin preguntas aún"} ·
            taxonomía histórica colombiana
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/questions/matriz"
            className={cn(
              "inline-flex items-center justify-center gap-2 h-9 px-3.5 text-sm font-medium rounded-md",
              "bg-[var(--bg-page)] text-[var(--fg-default)] border border-[var(--border-default)]",
              "hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)]",
              "transition-colors duration-[var(--duration-instant)]",
            )}
          >
            <TableIcon className="size-4" />
            Matriz de producción
          </Link>
          {pendingCount > 0 && (
            <Tooltip content="Producir respuestas en lote para preguntas sin producción">
              <Link
                href="/questions/matriz"
                className={cn(
                  "inline-flex items-center justify-center gap-2 h-9 px-3.5 text-sm font-medium rounded-md",
                  "bg-[var(--bg-page)] text-[var(--fg-default)] border border-[var(--border-default)]",
                  "hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)]",
                  "transition-colors duration-[var(--duration-instant)]",
                )}
              >
                <Zap className="size-4" />
                Producir {pendingCount} pendientes
              </Link>
            </Tooltip>
          )}
          <Link
            href="/questions/generate"
            className={cn(
              "inline-flex items-center justify-center gap-2 h-9 px-3.5 text-sm font-medium rounded-md",
              "bg-[var(--accent)] text-[var(--fg-inverted)] hover:bg-[var(--accent-hover)]",
              "transition-colors duration-[var(--duration-instant)]",
            )}
          >
            <Plus className="size-4" />
            Generar preguntas
          </Link>
        </div>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card variant="default" size="sm">
          <div className="text-[11px] text-[var(--fg-subtle)]">Total</div>
          <div className="text-[22px] font-semibold text-[var(--fg-default)] tabular-nums mt-1">
            {stats?.totalQuestions ?? 0}
          </div>
        </Card>
        <Card variant="default" size="sm">
          <div className="text-[11px] text-[var(--fg-subtle)]">Sin producción</div>
          <div
            className="text-[22px] font-semibold tabular-nums mt-1"
            style={{ color: "var(--color-warning-fg)" }}
          >
            {stats?.byState?.pending ?? 0}
          </div>
        </Card>
        <Card variant="default" size="sm">
          <div className="text-[11px] text-[var(--fg-subtle)]">Parciales</div>
          <div
            className="text-[22px] font-semibold tabular-nums mt-1"
            style={{ color: "var(--accent)" }}
          >
            {stats?.byState?.partial ?? 0}
          </div>
        </Card>
        <Card variant="default" size="sm">
          <div className="text-[11px] text-[var(--fg-subtle)]">Completas</div>
          <div
            className="text-[22px] font-semibold tabular-nums mt-1"
            style={{ color: "var(--color-success-fg)" }}
          >
            {stats?.byState?.complete ?? 0}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card variant="default" size="sm" className="mb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <Input
            placeholder="Buscar en preguntas y justificaciones…"
            leadingIcon={<Search className="size-4" />}
            wrapperClassName="w-[320px]"
            value={filters.search}
            onChange={(e) =>
              updateFilters({ search: e.target.value, page: "1" })
            }
          />

          <select
            className={cn(
              "h-9 px-3 text-sm rounded-md min-w-0",
              "bg-[var(--bg-page)] text-[var(--fg-default)]",
              "border border-[var(--border-default)]",
              "hover:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-focus)]",
            )}
            style={{ width: 240 }}
            value={filters.documentId}
            onChange={(e) =>
              updateFilters({ documentId: e.target.value, page: "1" })
            }
          >
            <option value="">— Documento (todos) —</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.filename}
              </option>
            ))}
          </select>

          <select
            className={cn(
              "h-9 px-3 text-sm rounded-md",
              "bg-[var(--bg-page)] text-[var(--fg-default)]",
              "border border-[var(--border-default)]",
              "hover:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-focus)]",
            )}
            style={{ width: 220 }}
            value={filters.periodo}
            onChange={(e) =>
              updateFilters({ periodo: e.target.value, page: "1" })
            }
          >
            <option value="">— Período (todos) —</option>
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.nombre}
              </option>
            ))}
          </select>

          <select
            className={cn(
              "h-9 px-3 text-sm rounded-md",
              "bg-[var(--bg-page)] text-[var(--fg-default)]",
              "border border-[var(--border-default)]",
              "hover:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-focus)]",
            )}
            style={{ width: 220 }}
            value={filters.categoria}
            onChange={(e) =>
              updateFilters({ categoria: e.target.value, page: "1" })
            }
          >
            <option value="">— Categoría (todos) —</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.nombre}
              </option>
            ))}
          </select>

          <select
            className={cn(
              "h-9 px-3 text-sm rounded-md",
              "bg-[var(--bg-page)] text-[var(--fg-default)]",
              "border border-[var(--border-default)]",
              "hover:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-focus)]",
            )}
            style={{ width: 260 }}
            value={filters.entity}
            onChange={(e) =>
              updateFilters({ entity: e.target.value, page: "1" })
            }
          >
            <option value="">— Entidad (todas) —</option>
            {entityOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <Input
            placeholder="Año desde"
            wrapperClassName="w-[100px]"
            className="font-mono"
            value={filters.yearMin}
            onChange={(e) =>
              updateFilters({
                yearMin: e.target.value.replace(/[^0-9-]/g, ""),
                page: "1",
              })
            }
          />
          <Input
            placeholder="Año hasta"
            wrapperClassName="w-[100px]"
            className="font-mono"
            value={filters.yearMax}
            onChange={(e) =>
              updateFilters({
                yearMax: e.target.value.replace(/[^0-9-]/g, ""),
                page: "1",
              })
            }
          />

          <select
            className={cn(
              "h-9 px-3 text-sm rounded-md",
              "bg-[var(--bg-page)] text-[var(--fg-default)]",
              "border border-[var(--border-default)]",
              "hover:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-focus)]",
            )}
            style={{ width: 160 }}
            value={filters.sortBy}
            onChange={(e) =>
              updateFilters({ sortBy: e.target.value, page: "1" })
            }
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Segmented view switcher */}
          <div
            className={cn(
              "inline-flex items-center gap-0 p-0.5 rounded-md",
              "bg-[var(--bg-muted)] border border-[var(--border-default)]",
            )}
          >
            <button
              type="button"
              onClick={() => updateFilters({ view: "list" })}
              aria-pressed={filters.view === "list"}
              className={cn(
                "inline-flex items-center justify-center size-7 rounded text-[var(--fg-muted)]",
                "transition-colors duration-[var(--duration-instant)]",
                "hover:text-[var(--fg-default)]",
                filters.view === "list" &&
                  "bg-[var(--bg-page)] text-[var(--fg-default)] shadow-[var(--elev-1)]",
              )}
              aria-label="Vista lista"
            >
              <ListIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => updateFilters({ view: "cards" })}
              aria-pressed={filters.view === "cards"}
              className={cn(
                "inline-flex items-center justify-center size-7 rounded text-[var(--fg-muted)]",
                "transition-colors duration-[var(--duration-instant)]",
                "hover:text-[var(--fg-default)]",
                filters.view === "cards" &&
                  "bg-[var(--bg-page)] text-[var(--fg-default)] shadow-[var(--elev-1)]",
              )}
              aria-label="Vista tarjetas"
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* State tabs */}
      <Tabs
        value={stateFilter}
        onValueChange={(k) => updateFilters({ state: k, page: "1" })}
        className="mb-4"
      >
        <TabsList variant="underline">
          <TabsTrigger value="all">
            Todas ({stats?.byState?.all ?? 0})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Sin producción ({stats?.byState?.pending ?? 0})
          </TabsTrigger>
          <TabsTrigger value="partial">
            Parciales ({stats?.byState?.partial ?? 0})
          </TabsTrigger>
          <TabsTrigger value="complete">
            Completas ({stats?.byState?.complete ?? 0})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <Card variant="default" size="md">
          <div className="space-y-2">
            <Skeleton variant="line" className="h-4 w-full" />
            <Skeleton variant="line" className="h-4 w-11/12" />
            <Skeleton variant="line" className="h-4 w-10/12" />
            <Skeleton variant="line" className="h-4 w-full" />
            <Skeleton variant="line" className="h-4 w-9/12" />
            <Skeleton variant="line" className="h-4 w-11/12" />
            <Skeleton variant="line" className="h-4 w-full" />
            <Skeleton variant="line" className="h-4 w-10/12" />
          </div>
        </Card>
      ) : questions.length === 0 ? (
        <Card variant="default" size="md">
          <div className="py-12 text-center">
            <FileText className="size-10 text-[var(--fg-subtle)] mx-auto mb-3" />
            <div className="text-[13px] text-[var(--fg-muted)]">
              Sin preguntas con estos filtros
            </div>
          </div>
        </Card>
      ) : grouped ? (
        <div>
          {Object.entries(grouped).map(([code, qs]) => {
            const isPeriod =
              filters.sortBy === "periodo" || filters.sortBy === "cronologico";
            const p = isPeriod ? getPeriodByCode(code) : undefined;
            const c = !isPeriod ? getCategoryByCode(code) : undefined;
            const colorVar = isPeriod
              ? `var(--color-period-${periodSlug(code)})`
              : `var(--color-category-${categorySlug(code)})`;
            return (
              <div key={code} className="mb-6">
                <div
                  className="sticky z-[2] py-3 mb-3"
                  style={{
                    top: 64,
                    background: "var(--bg-page)",
                    borderBottom: `2px solid ${colorVar}`,
                  }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="subtle"
                      size="sm"
                      style={{
                        background: `color-mix(in oklab, ${colorVar} 12%, transparent)`,
                        color: colorVar,
                        fontWeight: 600,
                      }}
                    >
                      {p?.nombre || c?.nombre || code}
                    </Badge>
                    {p?.rango && (
                      <span className="text-[12px] text-[var(--fg-subtle)]">
                        {p.rango}
                      </span>
                    )}
                    <span className="text-[12px] text-[var(--fg-subtle)]">
                      {qs.length} preguntas
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {qs.map((q) => (
                    <QuestionRow
                      key={q.id}
                      question={q}
                      view={filters.view as "list" | "cards"}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2 w-full">
          {questions.map((q) => (
            <QuestionRow
              key={q.id}
              question={q}
              view={filters.view as "list" | "cards"}
            />
          ))}
        </div>
      )}

      {/* Pagination — sigue siendo Ant (no hay reemplazo aún) */}
      <div className="flex justify-center mt-6">
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

function QuestionRow({
  question,
  view,
}: {
  question: Question;
  view: "list" | "cards";
}) {
  const periodColorVar = `var(--color-period-${periodSlug(question.periodoCode)})`;
  const totalDelivs = question.deliverableCount ?? 0;

  const personas = question.entidadesPersonas ?? [];
  const lugares = question.entidadesLugares ?? [];
  const conceptos = question.entidadesConceptos ?? [];
  const yearsSec = question.yearsSecondary ?? [];
  const hasEntities = personas.length + lugares.length + conceptos.length > 0;
  const isCards = view === "cards";

  return (
    <Card
      variant="default"
      size="sm"
      className={cn(
        "transition-shadow hover:shadow-[var(--elev-2)]",
        isCards ? "p-[18px]" : "p-[14px]",
      )}
      style={{ borderLeft: `4px solid ${periodColorVar}` }}
    >
      <div
        className="flex items-start"
        style={{ gap: isCards ? 18 : 12 }}
      >
        {/* Estampa del año principal */}
        {question.yearPrincipal != null && (
          <div
            className="shrink-0"
            style={{ minWidth: isCards ? 72 : 56 }}
          >
            <div
              className="text-center rounded-lg font-mono"
              style={{
                background: `color-mix(in oklab, ${periodColorVar} 8%, transparent)`,
                border: `1px solid color-mix(in oklab, ${periodColorVar} 20%, transparent)`,
                padding: isCards ? "10px 8px" : "6px 6px",
              }}
              title="Año principal del proceso central de la pregunta"
            >
              <div
                style={{
                  fontSize: isCards ? 20 : 15,
                  fontWeight: 700,
                  color: periodColorVar,
                  lineHeight: 1.1,
                }}
              >
                {question.yearPrincipal}
              </div>
              <div
                className="text-[var(--fg-subtle)] uppercase mt-0.5"
                style={{
                  fontSize: 9,
                  letterSpacing: 0.5,
                }}
              >
                {question.periodoRango || "—"}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div
            className="flex flex-col w-full"
            style={{ gap: isCards ? 10 : 6 }}
          >
            {/* Pregunta */}
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "inline-block text-center font-mono",
                  "rounded-sm text-[var(--fg-muted)]",
                )}
                style={{
                  minWidth: 26,
                  fontSize: 11,
                  background: "var(--bg-muted)",
                  padding: "1px 6px",
                  flex: "0 0 auto",
                }}
              >
                {question.questionNumber}
              </span>
              <span
                className="text-[var(--fg-default)]"
                style={{
                  fontSize: isCards ? 15 : 14,
                  lineHeight: 1.55,
                  fontWeight: 500,
                }}
              >
                {question.pregunta}
              </span>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Tooltip content={question.periodoRango}>
                <PeriodBadge
                  code={question.periodoCode}
                  size="xs"
                  variant="subtle"
                />
              </Tooltip>
              <CategoryChip
                code={question.categoriaCode}
                size="xs"
                variant="subtle"
              />
              {question.subcategoriaNombre && (
                <Badge variant="subtle" size="xs">
                  {question.subcategoriaNombre}
                </Badge>
              )}
              {yearsSec.length > 0 && (
                <Tooltip content="Años secundarios — antecedentes, hitos, consecuencias">
                  <Badge
                    variant="outline"
                    size="xs"
                    className="font-mono"
                    style={{ borderStyle: "dashed" }}
                  >
                    + {yearsSec.join(", ")}
                  </Badge>
                </Tooltip>
              )}
            </div>

            {/* Justificación */}
            {question.justificacion && (
              <p
                className="text-[var(--fg-muted)] italic m-0"
                style={{
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  display: "-webkit-box",
                  WebkitLineClamp: isCards ? 3 : 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {question.justificacion}
              </p>
            )}

            {/* Entidades */}
            {hasEntities && (
              <EntitiesRow
                personas={personas}
                lugares={lugares}
                conceptos={conceptos}
                compact={!isCards}
              />
            )}

            {/* Footer */}
            <div
              className="flex items-center justify-between gap-2 flex-wrap mt-1 pt-2"
              style={{
                borderTop: "1px dashed var(--border-default)",
              }}
            >
              <div className="flex items-center gap-2.5 flex-wrap">
                {question.document && (
                  <Tooltip content={question.document.filename}>
                    <Link
                      href={`/documents/${question.document.id}`}
                      className="text-[11px] text-[var(--fg-subtle)] hover:text-[var(--fg-default)] inline-flex items-center gap-1"
                    >
                      <FileText className="size-3" />
                      {question.document.filename.slice(0, 38)}
                      {question.document.filename.length > 38 ? "…" : ""}
                    </Link>
                  </Tooltip>
                )}
                <Badge
                  variant={totalDelivs > 0 ? "success" : "subtle"}
                  size="xs"
                >
                  {totalDelivs > 0 ? (
                    <CheckCircle2 className="size-3" />
                  ) : (
                    <Clock className="size-3" />
                  )}
                  {totalDelivs} producciones
                </Badge>
              </div>
              <Link
                href={`/questions/matriz?focus=${question.id}`}
                className={cn(
                  "inline-flex items-center justify-center gap-2 h-7 px-2.5 text-xs font-medium rounded-md",
                  "bg-transparent text-[var(--fg-default)] hover:bg-[var(--bg-hover)]",
                  "transition-colors duration-[var(--duration-instant)]",
                )}
              >
                Producir →
              </Link>
            </div>
          </div>
        </div>
      </div>
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
  const group = (
    label: string,
    icon: string,
    items: string[],
    colorVar: string,
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="flex items-start gap-2 flex-wrap">
        <Tooltip content={`${label} clave de la pregunta`}>
          <span
            className="font-semibold uppercase shrink-0 pt-[3px]"
            style={{
              fontSize: 10,
              color: colorVar,
              letterSpacing: 0.6,
              minWidth: compact ? 60 : 72,
            }}
          >
            {icon} {label}
          </span>
        </Tooltip>
        <div className="flex flex-wrap gap-1 flex-1">
          {items.map((it) => (
            <Badge
              key={`${label}-${it}`}
              variant="subtle"
              size="xs"
              style={{
                background: `color-mix(in oklab, ${colorVar} 12%, transparent)`,
                border: `1px solid color-mix(in oklab, ${colorVar} 25%, transparent)`,
                color: colorVar,
                fontWeight: 500,
              }}
            >
              {it}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex flex-col w-full"
      style={{ gap: compact ? 4 : 6 }}
    >
      {group("Personas", "◐", personas, "var(--color-info-fg)")}
      {group("Lugares", "◈", lugares, "var(--color-success-fg)")}
      {group("Conceptos", "◇", conceptos, "var(--color-warning-fg)")}
    </div>
  );
}
