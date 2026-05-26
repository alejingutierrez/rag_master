"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Layers,
  BookOpen,
  LayoutGrid,
  Upload as UploadIcon,
  MessageCircle,
  ArrowRight,
  TrendingUp,
  FlaskConical,
  Rocket,
  Lightbulb,
  Activity as ActivityIcon,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  Badge,
  Card,
  Skeleton,
  Tooltip,
} from "@/components/ui";
import { PeriodBadge } from "@/components/domain/period-badge";
import { CategoryChip } from "@/components/domain/category-chip";
import { PERIOD_OPTIONS } from "@/lib/taxonomy";
import { getDocumentDisplayName } from "@/lib/enrichment-types";
import { getTemplateById } from "@/lib/chat-templates";
import { ActivitySparkline } from "@/components/dashboard/activity-sparkline";
import { PeriodDistributionBar } from "@/components/dashboard/period-distribution";
import { cn } from "@/lib/cn";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/dashboard", { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") {
          console.error(e);
          setError((e as Error).message);
        }
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const totalDocs = data?.stats.documents ?? 0;
  const completionPct = (() => {
    if (!data || data.stats.questions <= 0) return 0;
    const raw = (data.stats.completedDeliverables / data.stats.questions) * 100;
    return Math.min(100, Math.max(0, Math.round(raw)));
  })();
  const enrichmentPct = (() => {
    if (!data || totalDocs <= 0) return 0;
    const raw = (data.stats.enrichedDocs / totalDocs) * 100;
    return Math.min(100, Math.max(0, Math.round(raw)));
  })();
  const periodsTotal = PERIOD_OPTIONS.filter((p) => p.code !== "TRANS").length;
  const periodsCovered = data
    ? data.distribution.periodos.filter((p) => p.code !== "TRANS" && p.count > 0).length
    : 0;
  const periodsCoveredPct = Math.min(
    100,
    Math.max(0, Math.round((periodsCovered / Math.max(1, periodsTotal)) * 100)),
  );

  return (
    <div className="max-w-[var(--container-wide)] mx-auto px-8 py-8">
      {/* Hero */}
      <header className="mb-8">
        <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
          Plataforma de investigación
        </div>
        <h1
          className="serif-title text-[36px] leading-tight mt-1.5 mb-2 text-[var(--color-ink-1000)]"
          style={{ fontWeight: 700 }}
        >
          Archivo Histórico Digital
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--fg-muted)] max-w-[720px]">
          Corpus vectorizado de historia colombiana, con búsqueda semántica,
          generación de preguntas guiadas y producciones académicas con citación.
        </p>
      </header>

      {error && (
        <div className="mb-4 p-4 rounded-lg border border-[var(--color-danger-fg)]/40 bg-[var(--color-danger-bg)] flex items-start gap-3">
          <AlertCircle className="size-4 text-[var(--color-danger-fg)] mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-[var(--color-danger-fg)]">
              No pudimos cargar el dashboard
            </div>
            <div className="text-sm text-[var(--color-danger-fg)]/80 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          loading={loading}
          label="Documentos"
          value={data?.stats.documents ?? 0}
          delta={data?.deltas7d.docs ?? 0}
          icon={FileText}
          accentVar="--accent"
          footer={`${data?.stats.readyDocs ?? 0} listos · ${data?.stats.processingDocs ?? 0} en proceso`}
        />
        <StatCard
          loading={loading}
          label="Chunks"
          value={data?.stats.chunks ?? 0}
          icon={Layers}
          accentVar="--color-success-fg"
          footer="vectorizados con Cohere v4"
        />
        <StatCard
          loading={loading}
          label="Preguntas"
          value={data?.stats.questions ?? 0}
          delta={data?.deltas7d.questions ?? 0}
          icon={BookOpen}
          accentVar="--color-warning-fg"
          footer="taxonomía histórica"
        />
        <StatCard
          loading={loading}
          label="Producciones"
          value={data?.stats.completedDeliverables ?? 0}
          delta={data?.deltas7d.deliverables ?? 0}
          icon={LayoutGrid}
          accentVar="--color-category-cul"
          footer={`de ${data?.stats.deliverables ?? 0} totales`}
        />
      </div>

      {/* Activity + Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card variant="default" size="md" className="lg:col-span-2">
          <header className="flex items-center gap-2 mb-4">
            <TrendingUp className="size-4 text-[var(--fg-muted)]" />
            <h3 className="text-[15px] font-semibold text-[var(--fg-default)]">
              Actividad — últimos 14 días
            </h3>
          </header>
          <ActivitySparkline data={data?.activity ?? []} />
        </Card>

        <Card variant="default" size="md">
          <h3 className="text-[15px] font-semibold text-[var(--fg-default)] mb-4">
            Progreso del corpus
          </h3>
          <div className="space-y-5">
            <ProgressMetric
              label="Documentos enriquecidos"
              value={enrichmentPct}
              accentVar="--accent"
              detail={`${data?.stats.enrichedDocs ?? 0} de ${totalDocs}`}
            />
            <ProgressMetric
              label="Preguntas con producción"
              value={completionPct}
              accentVar="--color-success-fg"
              detail={`${data?.stats.completedDeliverables ?? 0} de ${data?.stats.questions ?? 0}`}
            />
            <ProgressMetric
              label="Periodos cubiertos"
              value={periodsCoveredPct}
              accentVar="--color-warning-fg"
              detail={`${periodsCovered} de ${periodsTotal}`}
            />
          </div>
        </Card>
      </div>

      {/* Distribution */}
      <Card variant="default" size="md" className="mb-6">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ActivityIcon className="size-4 text-[var(--fg-muted)]" />
            <h3 className="text-[15px] font-semibold text-[var(--fg-default)]">
              Distribución por período histórico
            </h3>
          </div>
          <Link
            href="/coverage"
            className="text-[13px] text-[var(--accent)] hover:underline inline-flex items-center gap-1"
          >
            Ver heatmap completo <ArrowRight className="size-3" />
          </Link>
        </header>
        <PeriodDistributionBar
          data={data?.distribution.periodos ?? []}
          loading={loading}
        />
      </Card>

      {/* Quick actions + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick actions */}
        <div className="space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)] font-semibold">
            Acciones rápidas
          </div>
          <ActionCard href="/upload" icon={UploadIcon} label="Cargar PDFs" description="Vectoriza fuentes nuevas" />
          <ActionCard href="/chat" icon={MessageCircle} label="Consultar" description="Pregunta con citas" />
          <ActionCard href="/deep-research" icon={Rocket} label="Deep Research" description="Agente con thinking extendido" />
          <ActionCard href="/hypothesis" icon={Lightbulb} label="Plantear hipótesis" description="Evidencia a favor y en contra" />
          <ActionCard href="/timeline" icon={ActivityIcon} label="Línea de tiempo" description="Navega por época" />
          <ActionCard href="/enrich" icon={FlaskConical} label="Enriquecer fuentes" description="Metadata + IA" />
        </div>

        <div className="lg:col-span-2 space-y-4">
          {/* Recent documents */}
          <Card variant="default" size="md">
            <header className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-[var(--fg-muted)]" />
                <h3 className="text-[15px] font-semibold text-[var(--fg-default)]">
                  Documentos recientes
                </h3>
              </div>
              <Link
                href="/documents"
                className="text-[13px] text-[var(--accent)] hover:underline inline-flex items-center gap-1"
              >
                Ver todos <ArrowRight className="size-3" />
              </Link>
            </header>
            {loading ? (
              <div className="space-y-2">
                <Skeleton variant="line" className="h-12" />
                <Skeleton variant="line" className="h-12" />
                <Skeleton variant="line" className="h-12" />
              </div>
            ) : !data || data.recentDocuments.length === 0 ? (
              <EmptyState
                title="Aún no hay documentos"
                description="Sube tu primer PDF para activar el corpus."
                actionHref="/upload"
                actionLabel="Cargar PDFs"
                actionIcon={UploadIcon}
              />
            ) : (
              <div className="space-y-1.5">
                {data.recentDocuments.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}`}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md bg-[var(--bg-muted)] hover:bg-[var(--bg-hover)] transition-colors duration-[var(--duration-instant)]"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="size-4 shrink-0 text-[var(--fg-subtle)]" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-[var(--fg-default)] truncate">
                          {getDocumentDisplayName(doc)}
                        </div>
                        <div className="text-[11px] text-[var(--fg-subtle)] mt-0.5">
                          {doc._count.chunks} chunks · {doc.pageCount} pp · {doc._count.questions} preguntas
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {doc.enriched && (
                        <Tooltip content="Enriquecido">
                          <Badge variant="tinta" size="xs">
                            ✓
                          </Badge>
                        </Tooltip>
                      )}
                      <StatusBadge status={doc.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Recent questions + producciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card variant="default" size="sm">
              <header className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="size-3.5 text-[var(--fg-muted)]" />
                  <h4 className="text-[13px] font-semibold text-[var(--fg-default)]">
                    Preguntas recientes
                  </h4>
                </div>
                <Link href="/questions" className="text-[12px] text-[var(--accent)] hover:underline inline-flex items-center gap-0.5">
                  Ver <ArrowRight className="size-3" />
                </Link>
              </header>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton variant="line" className="h-10" />
                  <Skeleton variant="line" className="h-10" />
                </div>
              ) : !data || data.recentQuestions.length === 0 ? (
                <EmptyState description="Aún no se han generado preguntas." />
              ) : (
                <div className="space-y-3">
                  {data.recentQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="pl-2.5 border-l-[3px]"
                      style={{ borderColor: `var(--color-period-${q.periodoCode.toLowerCase().replace(/_/g, "-")})` }}
                    >
                      <p className="text-[12.5px] leading-snug text-[var(--fg-default)] line-clamp-2">
                        {q.pregunta}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <PeriodBadge code={q.periodoCode} size="xs" />
                        <CategoryChip code={q.categoriaCode} size="xs" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card variant="default" size="sm">
              <header className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="size-3.5 text-[var(--fg-muted)]" />
                  <h4 className="text-[13px] font-semibold text-[var(--fg-default)]">
                    Producciones recientes
                  </h4>
                </div>
                <Link href="/producciones" className="text-[12px] text-[var(--accent)] hover:underline inline-flex items-center gap-0.5">
                  Ver <ArrowRight className="size-3" />
                </Link>
              </header>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton variant="line" className="h-10" />
                  <Skeleton variant="line" className="h-10" />
                </div>
              ) : !data || data.recentDeliverables.length === 0 ? (
                <EmptyState description="Aún no se han generado producciones." />
              ) : (
                <div className="space-y-3">
                  {data.recentDeliverables.map((p) => {
                    const periodCode = p.question?.periodoCode;
                    const tpl = getTemplateById(p.templateId);
                    return (
                      <Link
                        key={p.id}
                        href={`/producciones/${p.id}`}
                        className="block pl-2.5 border-l-[3px] hover:opacity-90"
                        style={{
                          borderColor: periodCode
                            ? `var(--color-period-${periodCode.toLowerCase().replace(/_/g, "-")})`
                            : "var(--border-default)",
                        }}
                      >
                        <p className="text-[12.5px] leading-snug text-[var(--fg-default)] line-clamp-2">
                          {p.question?.pregunta || p.userQuestion || "(producción)"}
                        </p>
                        {tpl && (
                          <div className="mt-1.5">
                            <Badge variant="subtle" size="xs">
                              {tpl.icon} {tpl.name}
                            </Badge>
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-componentes ────────────────────────────────────────────────────── */

function StatCard({
  loading,
  label,
  value,
  delta,
  icon: Icon,
  accentVar,
  footer,
}: {
  loading: boolean;
  label: string;
  value: number;
  delta?: number;
  icon: React.ComponentType<{ className?: string }>;
  accentVar: string;
  footer?: string;
}) {
  if (loading) {
    return (
      <Card variant="default" size="md">
        <Skeleton variant="line" className="h-3 w-20 mb-3" />
        <Skeleton variant="line" className="h-8 w-24" />
      </Card>
    );
  }
  return (
    <Card variant="default" size="md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-[var(--fg-subtle)]">{label}</div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="text-[24px] font-semibold text-[var(--fg-default)] tabular-nums">
              {value.toLocaleString("es-CO")}
            </div>
            {delta !== undefined && delta > 0 && (
              <Badge variant="success" size="xs">
                +{delta} 7d
              </Badge>
            )}
          </div>
          {footer && (
            <div className="text-[11px] text-[var(--fg-subtle)] mt-1.5">
              {footer}
            </div>
          )}
        </div>
        <div
          className="size-10 rounded-md flex items-center justify-center shrink-0"
          style={{
            background: `color-mix(in oklab, var(${accentVar}) 12%, transparent)`,
            color: `var(${accentVar})`,
          }}
        >
          <Icon className="size-[18px]" />
        </div>
      </div>
    </Card>
  );
}

function ActionCard({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg",
        "bg-[var(--bg-page)] border border-[var(--border-default)]",
        "hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]",
        "transition-colors duration-[var(--duration-instant)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]",
      )}
    >
      <div
        className="size-9 rounded-md flex items-center justify-center shrink-0"
        style={{
          background: "var(--accent-bg-subtle)",
          color: "var(--accent)",
        }}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[var(--fg-default)]">
          {label}
        </div>
        <div className="text-[11px] text-[var(--fg-subtle)]">{description}</div>
      </div>
      <ArrowRight className="size-3 text-[var(--fg-subtle)] shrink-0" />
    </Link>
  );
}

function ProgressMetric({
  label,
  value,
  accentVar,
  detail,
}: {
  label: string;
  value: number;
  accentVar: string;
  detail: string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-[12.5px] text-[var(--fg-muted)]">{label}</span>
        <span
          className="text-[12.5px] font-semibold tabular-nums"
          style={{ color: `var(${accentVar})` }}
        >
          {value}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${value}%`,
            background: `var(${accentVar})`,
          }}
        />
      </div>
      <div className="text-[11px] text-[var(--fg-subtle)] mt-1">{detail}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { variant: "subtle" | "success" | "warning" | "danger"; label: string; icon?: React.ComponentType<{ className?: string }> }
  > = {
    PENDING: { variant: "subtle", label: "Pendiente", icon: Clock },
    PROCESSING: { variant: "warning", label: "Procesando", icon: Clock },
    READY: { variant: "success", label: "Listo", icon: CheckCircle },
    ERROR: { variant: "danger", label: "Error", icon: AlertCircle },
  };
  const cfg = map[status] ?? { variant: "subtle" as const, label: status };
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} size="xs">
      {Icon && <Icon className="size-3" />}
      {cfg.label}
    </Badge>
  );
}

function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  actionIcon: ActionIcon,
}: {
  title?: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  actionIcon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="py-6 text-center">
      {title && (
        <div className="text-[13px] font-medium text-[var(--fg-default)] mb-1">
          {title}
        </div>
      )}
      <div className="text-[12px] text-[var(--fg-subtle)]">{description}</div>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className={cn(
            "mt-3 inline-flex items-center gap-2 px-3 h-8 rounded-md text-[13px] font-medium",
            "bg-[var(--accent)] text-[var(--fg-inverted)] hover:bg-[var(--accent-hover)]",
            "transition-colors duration-[var(--duration-instant)]",
          )}
        >
          {ActionIcon && <ActionIcon className="size-3.5" />}
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
