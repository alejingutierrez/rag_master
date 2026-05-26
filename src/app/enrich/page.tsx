"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  Save,
  Zap,
  CheckCircle2,
  FileText,
  Search,
  Plus,
  X,
  BookOpen,
  RotateCw,
  ArrowLeft,
  Rocket,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Chip,
  FieldHelp,
  FieldLabel,
  IconButton,
  Input,
  Skeleton,
  Textarea,
  Tooltip,
} from "@/components/ui";
import { PeriodBadge } from "@/components/domain";
import { cn } from "@/lib/cn";
import { getDocumentDisplayName, type EnrichmentMetadata } from "@/lib/enrichment-types";
import { PERIOD_OPTIONS, CATEGORY_OPTIONS } from "@/lib/taxonomy";
import { getPeriodColor } from "@/lib/theme";

interface DocumentSummary {
  id: string;
  filename: string;
  enriched: boolean;
  metadata: EnrichmentMetadata;
  status: string;
  _count: { chunks: number; questions?: number };
}

interface DocumentDetail extends DocumentSummary {
  chunks: Array<{ id: string; content: string; pageNumber: number; chunkIndex: number }>;
}

type FilterValue = "all" | "enriched" | "pending";

export default function EnrichPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[var(--container-wide)] mx-auto px-8 py-8">
          <Skeleton variant="line" className="h-8 w-72 mb-3" />
          <Skeleton variant="line" className="h-4 w-96 mb-8" />
          <div className="space-y-3">
            <Skeleton variant="line" className="h-24" />
            <Skeleton variant="line" className="h-64" />
          </div>
        </div>
      }
    >
      <EnrichContent />
    </Suspense>
  );
}

function EnrichContent() {
  const params = useSearchParams();

  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [batchRunning, setBatchRunning] = useState(false);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents?limit=500&status=READY");
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar documentos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Preselect via ?docId
  useEffect(() => {
    const docId = params.get("docId");
    if (docId) setSelectedId(docId);
  }, [params]);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/documents/${id}`);
      const data = await res.json();
      setDetail(data.document);
    } catch {
      toast.error("Error al cargar documento");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const filtered = useMemo(() => {
    let list = docs;
    if (filter === "enriched") list = list.filter((d) => d.enriched);
    else if (filter === "pending") list = list.filter((d) => !d.enriched);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((d) => {
        const name = getDocumentDisplayName(d).toLowerCase();
        return name.includes(q) || d.filename.toLowerCase().includes(q);
      });
    }
    return list;
  }, [docs, search, filter]);

  const enrichedCount = docs.filter((d) => d.enriched).length;
  const enrichmentPct = docs.length ? Math.round((enrichedCount / docs.length) * 100) : 0;
  const pendingCount = docs.length - enrichedCount;

  const runBatchEnrich = async () => {
    setBatchRunning(true);
    const pending = docs.filter((d) => !d.enriched);
    if (pending.length === 0) {
      setBatchRunning(false);
      return;
    }
    toast.info(`Enriqueciendo ${pending.length} documentos (paralelo 3)…`);
    const concurrency = 3;
    let success = 0;
    let errors = 0;
    const queue = [...pending];
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const doc = queue.shift();
        if (!doc) break;
        try {
          const res = await fetch(`/api/documents/${doc.id}/enrich`, { method: "POST" });
          if (res.ok) success++;
          else errors++;
        } catch {
          errors++;
        }
      }
    });
    await Promise.all(workers);
    if (errors > 0) {
      toast.warning(`${success} enriquecidos · ${errors} con error`);
    } else {
      toast.success(`${success} de ${pending.length} documentos enriquecidos`);
    }
    setBatchRunning(false);
    loadDocs();
  };

  const filterOptions: Array<{ value: FilterValue; label: string }> = [
    { value: "all", label: `Todos (${docs.length})` },
    { value: "pending", label: `Pendientes (${pendingCount})` },
    { value: "enriched", label: `Enriquecidos (${enrichedCount})` },
  ];

  return (
    <div className="max-w-[var(--container-wide)] mx-auto px-8 py-8">
      {/* Hero */}
      <header className="mb-6">
        <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
          Curaduría del corpus
        </div>
        <h1
          className="serif-title text-[36px] leading-tight mt-1.5 mb-2 text-[var(--color-ink-1000)]"
          style={{ fontWeight: 700 }}
        >
          Enriquecer documentos
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--fg-muted)] max-w-[720px]">
          Metadata bibliográfica, clasificación temporal/temática y resumen — con IA o manual.
        </p>
      </header>

      {/* Coverage + bulk actions */}
      <Card variant="default" size="md" className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-7 flex flex-col gap-1.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
              Cobertura de enriquecimiento
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[26px] font-semibold text-[var(--fg-default)] tabular-nums">
                {enrichmentPct}%
              </span>
              <span className="text-[13px] text-[var(--fg-muted)]">
                {enrichedCount} de {docs.length} documentos
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${enrichmentPct}%`,
                  background: "var(--accent)",
                }}
              />
            </div>
          </div>
          <div className="md:col-span-5 flex md:justify-end gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="md"
              leadingIcon={<RotateCw className="size-4" />}
              onClick={loadDocs}
            >
              Recargar
            </Button>
            <Button
              variant="primary"
              size="md"
              leadingIcon={<Zap className="size-4" />}
              isLoading={batchRunning}
              disabled={pendingCount === 0}
              onClick={runBatchEnrich}
            >
              Enriquecer {pendingCount} con IA
            </Button>
          </div>
        </div>
      </Card>

      {/* List + Editor grid */}
      <div className={cn("grid gap-4", selectedId ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1")}>
        <div className={cn(selectedId ? "lg:col-span-4" : "lg:col-span-12")}>
          <Card variant="default" size="md" className="overflow-hidden p-0">
            <header className="flex items-center gap-2 px-4 pt-4">
              <FileText className="size-4 text-[var(--fg-muted)]" />
              <h3 className="text-[15px] font-semibold text-[var(--fg-default)]">Documentos</h3>
              <Badge variant="subtle" size="xs">
                {filtered.length}
              </Badge>
            </header>
            <div className="px-4 py-3 border-b border-[var(--border-default)] mt-3 space-y-2">
              <Input
                leadingIcon={<Search className="size-4" />}
                placeholder="Buscar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                trailingIcon={
                  search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Limpiar búsqueda"
                      className="text-[var(--fg-subtle)] hover:text-[var(--fg-default)]"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null
                }
              />
              <div className="flex gap-1.5" role="tablist" aria-label="Filtrar documentos">
                {filterOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="tab"
                    aria-selected={filter === opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={cn(
                      "flex-1 h-8 px-2 text-[12px] font-medium rounded-md",
                      "transition-colors duration-[var(--duration-instant)]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]",
                      filter === opt.value
                        ? "bg-[var(--accent)] text-[var(--fg-inverted)]"
                        : "bg-[var(--bg-muted)] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-2">
                  <Skeleton variant="line" className="h-10" />
                  <Skeleton variant="line" className="h-10" />
                  <Skeleton variant="line" className="h-10" />
                  <Skeleton variant="line" className="h-10" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 px-6 text-center">
                  <FileText className="size-8 mx-auto text-[var(--fg-subtle)] mb-2" />
                  <div className="text-[13px] text-[var(--fg-muted)]">Sin documentos</div>
                </div>
              ) : (
                filtered.map((doc) => {
                  const periodCode = doc.metadata?.primaryPeriod;
                  const color = periodCode
                    ? getPeriodColor(periodCode)
                    : "var(--fg-subtle)";
                  const selected = doc.id === selectedId;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedId(doc.id)}
                      className={cn(
                        "w-full text-left px-3.5 py-2.5",
                        "border-b border-[var(--border-default)] last:border-b-0",
                        "transition-colors duration-[var(--duration-instant)]",
                        "focus-visible:outline-none focus-visible:bg-[var(--bg-hover)]",
                        selected
                          ? "bg-[var(--bg-subtle)]"
                          : "hover:bg-[var(--bg-hover)]",
                      )}
                      style={{
                        borderLeft: `3px solid ${selected ? color : "transparent"}`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <FileText
                            className="size-4 shrink-0"
                            style={{ color }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-medium text-[var(--fg-default)] truncate">
                              {getDocumentDisplayName(doc)}
                            </div>
                            <div className="text-[11px] text-[var(--fg-subtle)]">
                              {doc._count.chunks} chunks
                            </div>
                          </div>
                        </div>
                        {doc.enriched ? (
                          <CheckCircle2 className="size-3.5 shrink-0 text-[var(--color-success-fg)]" />
                        ) : (
                          <Badge variant="outline" size="xs">
                            —
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {selectedId && (
          <div className="lg:col-span-8">
            {loadingDetail || !detail ? (
              <Card variant="default" size="md">
                <Skeleton variant="line" className="h-6 w-1/2 mb-4" />
                <Skeleton variant="line" className="h-20 mb-4" />
                <Skeleton variant="line" className="h-12" />
                <Skeleton variant="line" className="h-12 mt-2" />
                <Skeleton variant="line" className="h-32 mt-2" />
              </Card>
            ) : (
              <EnrichmentEditor
                key={detail.id}
                doc={detail}
                onSaved={() => {
                  loadDocs();
                  loadDetail(detail.id);
                }}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Editor ──────────────────────────────────────────────────────────────── */

interface EnrichmentFormState {
  bookTitle: string;
  author: string;
  isbn: string;
  pageCount: string;
  publisher: string;
  publicationYear: string;
  edition: string;
  summary: string;
  primaryPeriod: string;
  secondaryPeriod: string;
  primaryCategory: string;
  secondaryCategory: string;
}

function metadataToForm(m: EnrichmentMetadata | undefined): EnrichmentFormState {
  return {
    bookTitle: m?.bookTitle ?? "",
    author: m?.author ?? "",
    isbn: m?.isbn ?? "",
    pageCount: m?.pageCount != null ? String(m.pageCount) : "",
    publisher: m?.publisher ?? "",
    publicationYear: m?.publicationYear != null ? String(m.publicationYear) : "",
    edition: m?.edition ?? "",
    summary: m?.summary ?? "",
    primaryPeriod: m?.primaryPeriod ?? "",
    secondaryPeriod: m?.secondaryPeriod ?? "",
    primaryCategory: m?.primaryCategory ?? "",
    secondaryCategory: m?.secondaryCategory ?? "",
  };
}

function EnrichmentEditor({
  doc,
  onSaved,
  onClose,
}: {
  doc: DocumentDetail;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<EnrichmentFormState>(() => metadataToForm(doc.metadata));
  const [keywords, setKeywords] = useState<string[]>(doc.metadata?.keywords ?? []);
  const [newKw, setNewKw] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [openSections, setOpenSections] = useState({
    bibliography: true,
    classification: true,
    summary: true,
  });

  useEffect(() => {
    setForm(metadataToForm(doc.metadata));
    setKeywords(doc.metadata?.keywords ?? []);
  }, [doc.id, doc.metadata]);

  const updateField = <K extends keyof EnrichmentFormState>(
    field: K,
    value: EnrichmentFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        bookTitle: form.bookTitle || undefined,
        author: form.author || undefined,
        isbn: form.isbn || undefined,
        pageCount: form.pageCount ? Number(form.pageCount) : undefined,
        publisher: form.publisher || undefined,
        publicationYear: form.publicationYear ? Number(form.publicationYear) : undefined,
        edition: form.edition || undefined,
        summary: form.summary || undefined,
        primaryPeriod: form.primaryPeriod || undefined,
        secondaryPeriod: form.secondaryPeriod || undefined,
        primaryCategory: form.primaryCategory || undefined,
        secondaryCategory: form.secondaryCategory || undefined,
        keywords,
      };
      const res = await fetch(`/api/documents/${doc.id}/enrich`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: payload }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Metadata guardada");
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleAI = async () => {
    setAiRunning(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/enrich`, { method: "POST" });
      if (!res.ok) throw new Error("AI failed");
      toast.success("Documento enriquecido con IA");
      onSaved();
    } catch {
      toast.error("Error al enriquecer con IA");
    } finally {
      setAiRunning(false);
    }
  };

  const addKw = () => {
    const k = newKw.trim();
    if (k && !keywords.includes(k)) {
      setKeywords([...keywords, k]);
      setNewKw("");
    }
  };

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <Card variant="default" size="md" className="p-0">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-[var(--border-default)] flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Volver"
            onClick={onClose}
          >
            <ArrowLeft className="size-4" />
          </IconButton>
          <div className="min-w-0 flex-1">
            <h2 className="serif-title text-[18px] font-semibold text-[var(--color-ink-1000)] leading-tight">
              {getDocumentDisplayName(doc)}
            </h2>
            {doc.enriched && (
              <div className="mt-1.5">
                <Badge variant="tinta" size="xs">
                  <CheckCircle2 className="size-3" />
                  Enriquecido
                </Badge>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" asChild leadingIcon={<FileText className="size-3.5" />}>
            <Link href={`/documents/${doc.id}`}>Ver documento</Link>
          </Button>
          <Button variant="secondary" size="sm" asChild leadingIcon={<BookOpen className="size-3.5" />}>
            <Link href={`/questions/generate?documentId=${doc.id}`}>Generar preguntas</Link>
          </Button>
        </div>
      </div>

      <div className="p-6">
        {/* AI hint */}
        <div
          className={cn(
            "mb-5 p-4 rounded-lg flex items-start gap-3 flex-wrap",
            "border border-[var(--color-info-fg)]/30 bg-[var(--color-info-bg)]",
          )}
        >
          <Rocket className="size-4 text-[var(--color-info-fg)] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-[220px] text-[13px] leading-relaxed text-[var(--fg-default)]">
            Usa <strong>Enriquecer con IA</strong> para extraer automáticamente bibliografía,
            periodo, categoría y resumen desde los primeros chunks. Después puedes ajustar a mano.
          </div>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Sparkles className="size-3.5" />}
            isLoading={aiRunning}
            onClick={handleAI}
          >
            Enriquecer con IA
          </Button>
        </div>

        {/* Bibliography */}
        <SectionHeader
          title="Bibliografía"
          open={openSections.bibliography}
          onToggle={() => toggleSection("bibliography")}
        />
        {openSections.bibliography && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-5">
            <Field className="md:col-span-12" label="Título del libro" htmlFor="bookTitle">
              <Input
                id="bookTitle"
                value={form.bookTitle}
                onChange={(e) => updateField("bookTitle", e.target.value)}
              />
            </Field>
            <Field className="md:col-span-6" label="Autor" htmlFor="author">
              <Input
                id="author"
                value={form.author}
                onChange={(e) => updateField("author", e.target.value)}
              />
            </Field>
            <Field className="md:col-span-6" label="Editorial" htmlFor="publisher">
              <Input
                id="publisher"
                value={form.publisher}
                onChange={(e) => updateField("publisher", e.target.value)}
              />
            </Field>
            <Field className="md:col-span-4" label="Año" htmlFor="publicationYear">
              <Input
                id="publicationYear"
                type="number"
                value={form.publicationYear}
                onChange={(e) => updateField("publicationYear", e.target.value)}
              />
            </Field>
            <Field className="md:col-span-4" label="Edición" htmlFor="edition">
              <Input
                id="edition"
                value={form.edition}
                onChange={(e) => updateField("edition", e.target.value)}
              />
            </Field>
            <Field className="md:col-span-4" label="ISBN" htmlFor="isbn">
              <Input
                id="isbn"
                value={form.isbn}
                onChange={(e) => updateField("isbn", e.target.value)}
              />
            </Field>
            <Field className="md:col-span-6" label="Total de páginas" htmlFor="pageCount">
              <Input
                id="pageCount"
                type="number"
                value={form.pageCount}
                onChange={(e) => updateField("pageCount", e.target.value)}
              />
            </Field>
          </div>
        )}

        {/* Classification */}
        <SectionHeader
          title="Clasificación histórica"
          open={openSections.classification}
          onToggle={() => toggleSection("classification")}
        />
        {openSections.classification && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <Field label="Periodo primario" htmlFor="primaryPeriod">
              <NativeSelect
                id="primaryPeriod"
                value={form.primaryPeriod}
                onChange={(v) => updateField("primaryPeriod", v)}
                placeholder="Selecciona periodo…"
                options={PERIOD_OPTIONS.map((p) => ({
                  value: p.code,
                  label: `${p.nombre} (${p.rango})`,
                }))}
              />
              {form.primaryPeriod && (
                <div className="mt-1.5">
                  <PeriodBadge code={form.primaryPeriod} size="xs" />
                </div>
              )}
            </Field>
            <Field label="Periodo secundario (opcional)" htmlFor="secondaryPeriod">
              <NativeSelect
                id="secondaryPeriod"
                value={form.secondaryPeriod}
                onChange={(v) => updateField("secondaryPeriod", v)}
                placeholder="Selecciona…"
                options={PERIOD_OPTIONS.map((p) => ({
                  value: p.code,
                  label: `${p.nombre} (${p.rango})`,
                }))}
              />
              {form.secondaryPeriod && (
                <div className="mt-1.5">
                  <PeriodBadge code={form.secondaryPeriod} size="xs" />
                </div>
              )}
            </Field>
            <Field label="Categoría primaria" htmlFor="primaryCategory">
              <NativeSelect
                id="primaryCategory"
                value={form.primaryCategory}
                onChange={(v) => updateField("primaryCategory", v)}
                placeholder="Selecciona categoría…"
                options={CATEGORY_OPTIONS.map((c) => ({ value: c.code, label: c.nombre }))}
              />
            </Field>
            <Field label="Categoría secundaria (opcional)" htmlFor="secondaryCategory">
              <NativeSelect
                id="secondaryCategory"
                value={form.secondaryCategory}
                onChange={(v) => updateField("secondaryCategory", v)}
                placeholder="Selecciona…"
                options={CATEGORY_OPTIONS.map((c) => ({ value: c.code, label: c.nombre }))}
              />
            </Field>
          </div>
        )}

        {/* Summary + keywords */}
        <SectionHeader
          title="Resumen y palabras clave"
          open={openSections.summary}
          onToggle={() => toggleSection("summary")}
        />
        {openSections.summary && (
          <div className="space-y-4 mb-5">
            <Field label="Resumen" htmlFor="summary">
              <Textarea
                id="summary"
                rows={5}
                value={form.summary}
                onChange={(e) => updateField("summary", e.target.value)}
                placeholder="Síntesis del contenido — periodo, tesis principal, enfoque metodológico, contexto."
                style={{ fontFamily: "var(--font-serif)", fontSize: 14 }}
              />
            </Field>

            <Field label="Palabras clave">
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Añade una keyword…"
                  value={newKw}
                  onChange={(e) => setNewKw(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKw();
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  size="md"
                  leadingIcon={<Plus className="size-3.5" />}
                  onClick={addKw}
                  disabled={!newKw.trim()}
                >
                  Añadir
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {keywords.length === 0 ? (
                  <FieldHelp>Sin keywords aún.</FieldHelp>
                ) : (
                  keywords.map((k) => (
                    <Chip
                      key={k}
                      variant="subtle"
                      size="sm"
                      onRemove={() => setKeywords(keywords.filter((x) => x !== k))}
                      removeLabel={`Remover ${k}`}
                    >
                      {k}
                    </Chip>
                  ))
                )}
              </div>
            </Field>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[var(--border-default)] flex justify-end gap-2">
        <Button variant="secondary" size="md" onClick={onClose}>
          Cancelar
        </Button>
        <Tooltip content="Guardar metadata">
          <Button
            variant="primary"
            size="md"
            leadingIcon={saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            isLoading={saving}
            onClick={handleSave}
          >
            Guardar
          </Button>
        </Tooltip>
      </div>
    </Card>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function SectionHeader({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "w-full flex items-center gap-2 mb-3",
        "text-left text-[14px] font-semibold text-[var(--fg-default)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] rounded-md",
      )}
    >
      {open ? (
        <ChevronDown className="size-4 text-[var(--fg-muted)]" />
      ) : (
        <ChevronRight className="size-4 text-[var(--fg-muted)]" />
      )}
      <span className="serif-title">{title}</span>
    </button>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
    </div>
  );
}

function NativeSelect({
  id,
  value,
  onChange,
  placeholder,
  options,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center w-full h-9",
        "bg-[var(--bg-page)] text-[var(--fg-default)]",
        "border border-[var(--border-default)] rounded-md",
        "transition-colors duration-[var(--duration-fast)] ease-out",
        "hover:border-[var(--border-strong)]",
        "focus-within:border-[var(--color-tinta-500)] focus-within:ring-2 focus-within:ring-[var(--ring-focus)]",
      )}
    >
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "flex-1 min-w-0 appearance-none bg-transparent outline-none",
          "px-3 pr-8 text-sm h-full",
          value ? "text-[var(--fg-default)]" : "text-[var(--color-ink-400)]",
        )}
      >
        <option value="">{placeholder ?? "Selecciona…"}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 size-4 text-[var(--fg-subtle)] pointer-events-none" />
    </div>
  );
}
