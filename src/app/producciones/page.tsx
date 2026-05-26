"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useUrlFilters } from "@/lib/use-url-state";
import { Pagination } from "antd";
import {
  LayoutGrid,
  List as ListIcon,
  Search,
  Plus,
  MessageCircle,
  Database,
  Compass,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  Input,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
  Textarea,
  FieldLabel,
  FieldHelp,
  Badge,
} from "@/components/ui";
import { PeriodBadge } from "@/components/domain/period-badge";
import { CategoryChip } from "@/components/domain/category-chip";
import dayjs from "@/lib/dayjs-config";
import { CHAT_TEMPLATES, CATEGORY_LABELS, getTemplateById } from "@/lib/chat-templates";
import { cn } from "@/lib/cn";

interface DeliverableItem {
  id: string;
  templateId: string;
  status: string;
  source: "chat" | "batch" | "deep_research";
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
      <ProduccionesContent />
    </Suspense>
  );
}

function ProduccionesContent() {
  const [items, setItems] = useState<DeliverableItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const LIMIT = 30;

  const [filters, updateFilters] = useUrlFilters({
    search: "",
    templateId: "",
    category: "",
    source: "",
    view: "grid",
    page: "1",
  });

  const page = Math.max(1, Number(filters.page) || 1);

  const [refreshTick, setRefreshTick] = useState(0);
  const fetchItems = () => setRefreshTick((n) => n + 1);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    (async () => {
      try {
        const p = new URLSearchParams();
        p.set("page", String(page));
        p.set("limit", String(LIMIT));
        if (filters.templateId) p.set("templateId", filters.templateId);
        if (filters.source) p.set("source", filters.source);
        if (filters.search) p.set("search", filters.search);
        const res = await fetch(`/api/deliverables?${p}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (ctrl.signal.aborted) return;
        let list = data.deliverables ?? [];
        if (filters.category) {
          list = list.filter(
            (d: DeliverableItem) =>
              getTemplateById(d.templateId)?.category === filters.category,
          );
        }
        if (filters.search.trim()) {
          const q = filters.search.trim().toLowerCase();
          list = list.filter(
            (d: DeliverableItem) =>
              d.question?.pregunta?.toLowerCase().includes(q) ||
              d.userQuestion?.toLowerCase().includes(q) ||
              d.answerPreview?.toLowerCase().includes(q),
          );
        }
        setItems(list);
        setTotal(data.pagination?.total ?? 0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") console.error(e);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [page, filters.templateId, filters.source, filters.category, filters.search, refreshTick]);

  // Polling si hay items GENERATING
  useEffect(() => {
    if (!items.some((i) => i.status === "GENERATING")) return;
    const t = setInterval(() => setRefreshTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, [items]);

  const selectClass = cn(
    "h-9 px-3 text-sm rounded-md",
    "bg-[var(--bg-page)] text-[var(--fg-default)]",
    "border border-[var(--border-default)]",
    "hover:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-focus)]",
  );

  return (
    <div className="app-page-wide">
      <header className="flex justify-between items-end flex-wrap gap-4 mb-6">
        <div>
          <h1
            className="serif-title text-[32px] leading-tight m-0 text-[var(--color-ink-1000)]"
            style={{ fontWeight: 700 }}
          >
            Producciones
          </h1>
          <p className="text-[14px] text-[var(--fg-muted)] mt-1.5 mb-0">
            Respuestas generadas. {total} producciones en total.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" asChild>
            <Link href="/bibliography">Bibliografía</Link>
          </Button>
          <Button variant="primary" onClick={() => setShowNew(true)}>
            <Plus className="size-4" />
            Nueva producción
          </Button>
        </div>
      </header>

      {/* Filters */}
      <Card variant="default" size="sm" className="mb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <Input
            placeholder="Buscar en preguntas y respuestas…"
            leadingIcon={<Search className="size-4" />}
            wrapperClassName="w-[300px]"
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value, page: "1" })}
          />

          <select
            className={selectClass}
            style={{ width: 160 }}
            value={filters.category}
            onChange={(e) => updateFilters({ category: e.target.value, page: "1" })}
          >
            <option value="">— Categoría —</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <select
            className={selectClass}
            style={{ width: 240 }}
            value={filters.templateId}
            onChange={(e) => updateFilters({ templateId: e.target.value, page: "1" })}
          >
            <option value="">— Template —</option>
            {CHAT_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>

          <select
            className={selectClass}
            style={{ width: 170 }}
            value={filters.source}
            onChange={(e) => updateFilters({ source: e.target.value, page: "1" })}
          >
            <option value="">— Origen —</option>
            <option value="chat">Chat</option>
            <option value="batch">Batch</option>
            <option value="deep_research">Deep research</option>
          </select>

          <div className="ml-auto">
            <Tabs
              value={filters.view}
              onValueChange={(v) => updateFilters({ view: v })}
            >
              <TabsList variant="segmented">
                <TabsTrigger value="grid" variant="segmented" aria-label="Grid">
                  <LayoutGrid className="size-4" />
                </TabsTrigger>
                <TabsTrigger value="list" variant="segmented" aria-label="Lista">
                  <ListIcon className="size-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </Card>

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
      ) : items.length === 0 ? (
        <Card variant="default" size="md">
          <div className="py-10 flex flex-col items-center text-center gap-3">
            <div
              aria-hidden
              className="size-16 rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-muted)] flex items-center justify-center text-[var(--fg-subtle)]"
            >
              <FileText className="size-7" />
            </div>
            <div
              className="text-[15px] font-medium text-[var(--fg-default)]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Sin producciones con estos filtros
            </div>
            <div className="text-[13px] text-[var(--fg-muted)] max-w-[360px] leading-relaxed">
              Ajusta los filtros o crea una producción nueva.
            </div>
            <Button variant="primary" onClick={() => setShowNew(true)} className="mt-1">
              <Plus className="size-4" />
              Nueva producción
            </Button>
          </div>
        </Card>
      ) : filters.view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {items.map((d) => (
            <ProductionCard key={d.id} item={d} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2 w-full">
          {items.map((d) => (
            <ProductionRow key={d.id} item={d} />
          ))}
        </div>
      )}

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
          showTotal={(t) => `${t} producciones`}
        />
      </div>

      <NewProductionDialog
        open={showNew}
        onOpenChange={setShowNew}
        onSuccess={() => {
          fetchItems();
          toast.success("Producción encolada");
        }}
      />
    </div>
  );
}

function SourceBadge({ source }: { source: DeliverableItem["source"] }) {
  if (source === "chat") {
    return (
      <Badge variant="info" size="xs">
        <MessageCircle className="size-3" />
        chat
      </Badge>
    );
  }
  if (source === "deep_research") {
    return (
      <Badge variant="warning" size="xs">
        <Compass className="size-3" />
        deep
      </Badge>
    );
  }
  return (
    <Badge variant="tinta" size="xs">
      <Database className="size-3" />
      batch
    </Badge>
  );
}

function ProductionCard({ item }: { item: DeliverableItem }) {
  const tpl = getTemplateById(item.templateId);
  const periodCode = item.question?.periodoCode;
  const periodVar = periodCode
    ? `var(--color-period-${periodCode.toLowerCase().replace(/_/g, "-")})`
    : "var(--border-default)";
  const title = item.question?.pregunta ?? item.userQuestion ?? "(producción libre)";

  return (
    <Link href={`/producciones/${item.id}`} className="block h-full group">
      <Card
        variant="default"
        size="sm"
        className="h-full transition-shadow group-hover:shadow-[var(--elev-2)]"
        style={{ borderTop: `3px solid ${periodVar}` }}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[18px] leading-none shrink-0">{tpl?.icon ?? "📝"}</span>
            <span className="text-[12px] font-semibold text-[var(--fg-default)] truncate">
              {tpl?.name ?? item.templateId}
            </span>
          </div>
          <SourceBadge source={item.source} />
        </div>
        <p
          className="text-[13.5px] leading-snug text-[var(--fg-default)] line-clamp-3 mb-2.5"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {title}
        </p>
        <p className="text-[12px] leading-relaxed text-[var(--fg-muted)] line-clamp-3 mb-2.5">
          {item.answerPreview}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.question?.periodoCode && (
            <PeriodBadge code={item.question.periodoCode} size="xs" />
          )}
          {item.question?.categoriaCode && (
            <CategoryChip code={item.question.categoriaCode} size="xs" />
          )}
          {item.status === "GENERATING" && (
            <Badge variant="info" size="xs">
              generando
            </Badge>
          )}
        </div>
        <div className="text-[11px] text-[var(--fg-subtle)] mt-2">
          {dayjs(item.createdAt).format("DD MMM YY · HH:mm")}
        </div>
      </Card>
    </Link>
  );
}

function ProductionRow({ item }: { item: DeliverableItem }) {
  const tpl = getTemplateById(item.templateId);
  const periodCode = item.question?.periodoCode;
  const periodVar = periodCode
    ? `var(--color-period-${periodCode.toLowerCase().replace(/_/g, "-")})`
    : "var(--border-default)";
  const title = item.question?.pregunta ?? item.userQuestion ?? "(producción libre)";

  return (
    <Link href={`/producciones/${item.id}`} className="block group">
      <Card
        variant="default"
        size="sm"
        className="transition-shadow group-hover:shadow-[var(--elev-2)]"
        style={{ borderLeft: `3px solid ${periodVar}` }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[16px] leading-none">{tpl?.icon}</span>
              <span className="text-[13px] font-semibold text-[var(--fg-default)]">
                {tpl?.name}
              </span>
              {item.question?.periodoCode && (
                <PeriodBadge code={item.question.periodoCode} size="xs" />
              )}
            </div>
            <div
              className="text-[13.5px] text-[var(--fg-default)] line-clamp-1"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {title}
            </div>
            <div className="text-[11px] text-[var(--fg-muted)] line-clamp-1">
              {item.answerPreview.slice(0, 180)}…
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <SourceBadge source={item.source} />
            <div className="text-[11px] text-[var(--fg-subtle)]">
              {dayjs(item.createdAt).format("DD MMM YY")}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function NewProductionDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [templateId, setTemplateId] = useState("mini-ensayo");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setQuestion("");
      setTemplateId("mini-ensayo");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!question.trim()) {
      setError("Pregunta requerida");
      return;
    }
    if (!templateId) {
      setError("Selecciona un template");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          templateId,
          topK: 100,
          similarityThreshold: 0.25,
        }),
      });
      if (!res.ok) throw new Error("HTTP error");
      toast.success("Producción iniciada");
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error("Error al crear producción");
    } finally {
      setSubmitting(false);
    }
  };

  const selectClass = cn(
    "w-full h-9 px-3 text-sm rounded-md",
    "bg-[var(--bg-page)] text-[var(--fg-default)]",
    "border border-[var(--border-default)]",
    "hover:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-focus)]",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Nueva producción</DialogTitle>
          <DialogDescription>
            Genera una respuesta nueva a partir del corpus.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <FieldLabel htmlFor="newprod-q" required>
                Pregunta
              </FieldLabel>
              <Textarea
                id="newprod-q"
                rows={4}
                placeholder="¿Qué quieres investigar?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                error={!!error && !question.trim()}
              />
              {error && !question.trim() && (
                <FieldHelp error>{error}</FieldHelp>
              )}
            </div>
            <div>
              <FieldLabel htmlFor="newprod-tpl" required>
                Template
              </FieldLabel>
              <select
                id="newprod-tpl"
                className={selectClass}
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {CHAT_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button variant="primary" onClick={handleSubmit} isLoading={submitting}>
            Generar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
