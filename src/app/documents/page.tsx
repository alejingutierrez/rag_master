"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  IconButton,
  Card,
  Input,
  Tooltip,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Pagination,
} from "@/components/ui";
import { PeriodBadge } from "@/components/domain/period-badge";
import { toast } from "sonner";
import {
  FileText,
  Trash2,
  RotateCw,
  Search,
  Eye,
  CloudUpload,
  FlaskConical,
  LayoutGrid,
  List,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
  ChevronDown,
  X,
  AlertCircle,
} from "lucide-react";
import dayjs from "@/lib/dayjs-config";
import { getDocumentDisplayName, type EnrichmentMetadata } from "@/lib/enrichment-types";
import { getPeriodByCode } from "@/lib/taxonomy";
import { useUrlFilters } from "@/lib/use-url-state";
import { cn } from "@/lib/cn";

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

interface DocumentRow {
  id: string;
  filename: string;
  fileSize: number;
  pageCount: number;
  status: string;
  createdAt: string;
  enriched: boolean;
  metadata: EnrichmentMetadata;
  _count: { chunks: number };
}

type StatusKey = "PENDING" | "PROCESSING" | "READY" | "ERROR";

const STATUS_CONFIG: Record<
  StatusKey,
  {
    label: string;
    variant: "subtle" | "success" | "warning" | "danger";
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  PENDING: { label: "Pendiente", variant: "subtle", Icon: Clock },
  PROCESSING: { label: "Procesando", variant: "warning", Icon: Loader2 },
  READY: { label: "Listo", variant: "success", Icon: CheckCircle },
  ERROR: { label: "Error", variant: "danger", Icon: XCircle },
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function StatusBadgeDS({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as StatusKey] ?? STATUS_CONFIG.PENDING;
  const { Icon } = cfg;
  return (
    <Badge variant={cfg.variant} size="xs">
      <Icon className={cn("size-3", status === "PROCESSING" && "animate-spin")} />
      {cfg.label}
    </Badge>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[var(--container-wide)] mx-auto px-8 py-8">
          <Skeleton variant="line" className="h-8 w-64 mb-4" />
          <Skeleton variant="line" className="h-4 w-96 mb-8" />
          <Skeleton variant="block" className="h-[420px] w-full" />
        </div>
      }
    >
      <DocumentsContent />
    </Suspense>
  );
}

function DocumentsContent() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [filters, updateFilters, resetFilters] = useUrlFilters({
    search: "",
    status: "",
    enriched: "",
    view: "table",
    page: "1",
    pageSize: "20",
  });

  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.max(10, Number(filters.pageSize) || 20);

  const [refreshTick, setRefreshTick] = useState(0);
  const fetchDocuments = () => setRefreshTick((n) => n + 1);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
        if (filters.status) params.set("status", filters.status);
        if (filters.enriched) params.set("enriched", filters.enriched);
        if (filters.search) params.set("search", filters.search);
        const res = await fetch(`/api/documents?${params}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (ctrl.signal.aborted) return;
        setDocuments(data.documents ?? []);
        setTotal(data.pagination?.total ?? 0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error(e);
          toast.error("Error al cargar documentos");
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [page, pageSize, filters.status, filters.enriched, filters.search, refreshTick]);

  // Auto-refresh mientras procesa
  useEffect(() => {
    if (!documents.some((d) => d.status === "PROCESSING")) return;
    const id = setInterval(() => setRefreshTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, [documents]);

  // Filtrado local complementario (sin acentos)
  const filtered = useMemo(() => {
    const q = stripDiacritics(filters.search.trim());
    if (!q) return documents;
    return documents.filter((d) => {
      const display = stripDiacritics(getDocumentDisplayName(d));
      const file = stripDiacritics(d.filename);
      const author = d.metadata?.author ? stripDiacritics(d.metadata.author) : "";
      return display.includes(q) || file.includes(q) || author.includes(q);
    });
  }, [documents, filters.search]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/documents/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Documento eliminado");
      setDeleteTarget(null);
      fetchDocuments();
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const hasFilters = Boolean(filters.search || filters.status || filters.enriched);

  return (
    <div className="max-w-[var(--container-wide)] mx-auto px-8 py-8">
      {/* Hero */}
      <header className="flex justify-between items-end mb-6 flex-wrap gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
            Corpus
          </div>
          <h1
            className="serif-title text-[36px] leading-tight mt-1.5 mb-2 text-[var(--color-ink-1000)]"
            style={{ fontWeight: 700 }}
          >
            Documentos
          </h1>
          <p className="text-[14px] text-[var(--fg-muted)] mt-1.5 mb-0 max-w-[720px]">
            Corpus vectorizado. {total} {total === 1 ? "documento" : "documentos"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/enrich">
            <Button variant="secondary" leadingIcon={<FlaskConical className="size-4" />}>
              Enriquecer
            </Button>
          </Link>
          <Link href="/upload">
            <Button variant="primary" leadingIcon={<CloudUpload className="size-4" />}>
              Cargar más
            </Button>
          </Link>
        </div>
      </header>

      {/* Toolbar */}
      <Card variant="default" size="md" className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            wrapperClassName="w-[280px]"
            placeholder="Buscar por título, autor…"
            leadingIcon={<Search />}
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value, page: "1" })}
            trailingIcon={
              filters.search ? (
                <button
                  type="button"
                  className="text-[var(--fg-subtle)] hover:text-[var(--fg-default)]"
                  aria-label="Limpiar búsqueda"
                  onClick={() => updateFilters({ search: "", page: "1" })}
                >
                  <X className="size-3.5" />
                </button>
              ) : null
            }
          />

          {/* Status dropdown (reemplaza Select Ant) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="md" trailingIcon={<ChevronDown className="size-3.5" />}>
                {filters.status
                  ? STATUS_CONFIG[filters.status as StatusKey]?.label ?? "Estado"
                  : "Estado"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => updateFilters({ status: "", page: "1" })}>
                Todos los estados
              </DropdownMenuItem>
              {(Object.keys(STATUS_CONFIG) as StatusKey[]).map((k) => {
                const { Icon, label } = STATUS_CONFIG[k];
                return (
                  <DropdownMenuItem
                    key={k}
                    onSelect={() => updateFilters({ status: k, page: "1" })}
                  >
                    <Icon className="size-4" />
                    {label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Enriched dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="md" trailingIcon={<ChevronDown className="size-3.5" />}>
                {filters.enriched === "true"
                  ? "Enriquecidos"
                  : filters.enriched === "false"
                    ? "Pendientes"
                    : "Enriquecimiento"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => updateFilters({ enriched: "", page: "1" })}>
                Todos
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => updateFilters({ enriched: "true", page: "1" })}>
                Enriquecidos
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => updateFilters({ enriched: "false", page: "1" })}>
                Pendientes de enriquecer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="secondary"
            leadingIcon={<RotateCw className="size-3.5" />}
            onClick={() => fetchDocuments()}
          >
            Recargar
          </Button>

          {hasFilters && (
            <Button variant="ghost" onClick={resetFilters}>
              Limpiar filtros
            </Button>
          )}

          <div className="ml-auto">
            <Tabs
              value={filters.view}
              onValueChange={(v) => updateFilters({ view: v })}
            >
              <TabsList variant="segmented">
                <TabsTrigger value="table" variant="segmented" aria-label="Tabla">
                  <List className="size-3.5" />
                </TabsTrigger>
                <TabsTrigger value="grid" variant="segmented" aria-label="Grid">
                  <LayoutGrid className="size-3.5" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </Card>

      {/* Content */}
      <Card variant="default" size="md">
        {loading ? (
          <div className="space-y-2">
            <Skeleton variant="line" className="h-12 w-full" />
            <Skeleton variant="line" className="h-12 w-full" />
            <Skeleton variant="line" className="h-12 w-full" />
            <Skeleton variant="line" className="h-12 w-full" />
            <Skeleton variant="line" className="h-12 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="size-10 text-[var(--fg-subtle)] mx-auto mb-3" />
            <div className="text-[14px] font-medium text-[var(--fg-default)] mb-1">
              Sin documentos
            </div>
            <div className="text-[12px] text-[var(--fg-subtle)]">
              {hasFilters ? "Ajusta los filtros o limpia para ver todos." : "Carga tu primer PDF."}
            </div>
          </div>
        ) : filters.view === "table" ? (
          <TableView
            documents={filtered}
            onDelete={(id, name) => setDeleteTarget({ id, name })}
          />
        ) : (
          <GridView
            documents={filtered}
            onDelete={(id, name) => setDeleteTarget({ id, name })}
          />
        )}
      </Card>

      {/* Pagination — primitivo Crónica */}
      <div className="flex items-center justify-between gap-3 mt-6">
        <span className="text-[12px] text-[var(--fg-subtle)]">
          {total.toLocaleString("es-CO")} documentos
        </span>
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          onChange={(p) => {
            updateFilters({ page: String(p) });
            if (typeof window !== "undefined") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        />
      </div>

      {/* Delete dialog (reemplaza Modal Ant) */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Eliminar documento</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex items-start gap-3">
              <AlertCircle className="size-5 text-[var(--color-danger-fg)] mt-0.5 shrink-0" />
              <p className="text-[14px] leading-relaxed text-[var(--fg-default)]">
                ¿Eliminar <strong>{deleteTarget?.name}</strong> y todos sus chunks? Esta acción no
                se puede deshacer.
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              isLoading={deleting}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Table view ─────────────────────────────────────────────────────────── */

function TableView({
  documents,
  onDelete,
}: {
  documents: DocumentRow[];
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div className="overflow-x-auto -mx-6 -my-6">
      <table className="w-full min-w-[900px] text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border-default)]">
            <th className="text-left font-medium text-[var(--fg-muted)] px-6 py-3 text-[12px] uppercase tracking-wide">
              Documento
            </th>
            <th className="text-left font-medium text-[var(--fg-muted)] px-3 py-3 text-[12px] uppercase tracking-wide w-[140px]">
              Estado
            </th>
            <th className="text-right font-medium text-[var(--fg-muted)] px-3 py-3 text-[12px] uppercase tracking-wide w-[90px]">
              Chunks
            </th>
            <th className="text-right font-medium text-[var(--fg-muted)] px-3 py-3 text-[12px] uppercase tracking-wide w-[90px]">
              Páginas
            </th>
            <th className="text-right font-medium text-[var(--fg-muted)] px-3 py-3 text-[12px] uppercase tracking-wide w-[100px]">
              Tamaño
            </th>
            <th className="text-left font-medium text-[var(--fg-muted)] px-3 py-3 text-[12px] uppercase tracking-wide w-[110px]">
              Enriq.
            </th>
            <th className="text-left font-medium text-[var(--fg-muted)] px-3 py-3 text-[12px] uppercase tracking-wide w-[110px]">
              Cargado
            </th>
            <th className="px-6 py-3 w-[100px]" />
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const display = getDocumentDisplayName(doc);
            const periodCode = doc.metadata?.primaryPeriod;
            const period = periodCode ? getPeriodByCode(periodCode) : undefined;
            return (
              <tr
                key={doc.id}
                className="border-b border-[var(--border-default)] last:border-b-0 hover:bg-[var(--bg-muted)] transition-colors duration-[var(--duration-instant)]"
              >
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="size-9 rounded-md flex items-center justify-center shrink-0"
                      style={{
                        background: periodCode
                          ? `color-mix(in oklab, var(--color-period-${periodCode.toLowerCase().replace(/_/g, "-")}) 12%, transparent)`
                          : "var(--bg-muted)",
                        color: periodCode
                          ? `var(--color-period-${periodCode.toLowerCase().replace(/_/g, "-")})`
                          : "var(--fg-muted)",
                      }}
                    >
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="block min-w-0 hover:text-[var(--accent)] transition-colors duration-[var(--duration-instant)]"
                      >
                        <Tooltip content={display}>
                          <div className="font-medium text-[var(--fg-default)] truncate">
                            {display}
                          </div>
                        </Tooltip>
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 min-w-0">
                        {doc.metadata?.author && (
                          <span className="text-[11px] text-[var(--fg-subtle)] truncate max-w-[160px]">
                            {doc.metadata.author}
                          </span>
                        )}
                        {period && <PeriodBadge code={period.code} size="xs" />}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <StatusBadgeDS status={doc.status} />
                </td>
                <td className="px-3 py-3 text-right font-mono text-[var(--fg-default)] tabular-nums">
                  {doc._count.chunks}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-[var(--fg-default)]">
                  {doc.pageCount}
                </td>
                <td className="px-3 py-3 text-right text-[var(--fg-muted)] tabular-nums">
                  {formatBytes(doc.fileSize)}
                </td>
                <td className="px-3 py-3">
                  {doc.enriched ? (
                    <Badge variant="tinta" size="xs">
                      ✓ Sí
                    </Badge>
                  ) : (
                    <span className="text-[var(--fg-subtle)]">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-[12px] text-[var(--fg-muted)]">
                  <Tooltip content={dayjs(doc.createdAt).format("DD MMM YYYY HH:mm")}>
                    <span>{dayjs(doc.createdAt).format("DD MMM")}</span>
                  </Tooltip>
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <Tooltip content="Ver detalle">
                      <Link href={`/documents/${doc.id}`}>
                        <IconButton size="sm" aria-label="Ver detalle">
                          <Eye />
                        </IconButton>
                      </Link>
                    </Tooltip>
                    <Tooltip content="Eliminar">
                      <IconButton
                        size="sm"
                        variant="danger"
                        aria-label="Eliminar"
                        onClick={() => onDelete(doc.id, getDocumentDisplayName(doc))}
                      >
                        <Trash2 />
                      </IconButton>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Grid view ──────────────────────────────────────────────────────────── */

function GridView({
  documents,
  onDelete,
}: {
  documents: DocumentRow[];
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {documents.map((doc) => {
        const display = getDocumentDisplayName(doc);
        const periodCode = doc.metadata?.primaryPeriod;
        const period = periodCode ? getPeriodByCode(periodCode) : undefined;
        const periodSlug = periodCode
          ? periodCode.toLowerCase().replace(/_/g, "-")
          : undefined;

        return (
          <article
            key={doc.id}
            className="bg-[var(--bg-page)] border border-[var(--border-default)] rounded-lg p-4 transition-shadow duration-[var(--duration-fast)] hover:shadow-[var(--elev-2)] hover:border-[var(--border-strong)] flex flex-col gap-2.5 relative overflow-hidden"
            style={
              periodSlug
                ? { boxShadow: `inset 0 3px 0 var(--color-period-${periodSlug})` }
                : undefined
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div
                className="size-9 rounded-md flex items-center justify-center shrink-0"
                style={{
                  background: periodSlug
                    ? `color-mix(in oklab, var(--color-period-${periodSlug}) 12%, transparent)`
                    : "var(--bg-muted)",
                  color: periodSlug
                    ? `var(--color-period-${periodSlug})`
                    : "var(--fg-muted)",
                }}
              >
                <FileText className="size-[18px]" />
              </div>
              <StatusBadgeDS status={doc.status} />
            </div>

            <Link
              href={`/documents/${doc.id}`}
              className="block hover:text-[var(--accent)] transition-colors duration-[var(--duration-instant)]"
            >
              <h3
                className="text-[14px] font-semibold leading-snug text-[var(--fg-default)] min-h-[38px] line-clamp-2"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {display}
              </h3>
            </Link>

            {doc.metadata?.author && (
              <p className="text-[12px] text-[var(--fg-muted)] truncate">
                {doc.metadata.author}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              {period && <PeriodBadge code={period.code} size="xs" />}
              {doc.enriched && (
                <Badge variant="tinta" size="xs">
                  ✓
                </Badge>
              )}
            </div>

            <div className="text-[11px] text-[var(--fg-subtle)] tabular-nums">
              {doc._count.chunks} chunks · {doc.pageCount} pp · {formatBytes(doc.fileSize)}
            </div>

            <div className="flex items-center justify-end gap-1 mt-auto pt-1">
              <Link href={`/documents/${doc.id}`}>
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<Eye className="size-3.5" />}
                >
                  Ver
                </Button>
              </Link>
              <IconButton
                size="sm"
                variant="danger"
                aria-label="Eliminar"
                onClick={() => onDelete(doc.id, display)}
              >
                <Trash2 />
              </IconButton>
            </div>
          </article>
        );
      })}
    </div>
  );
}
