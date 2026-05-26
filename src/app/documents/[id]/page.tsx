"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
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
  TabsContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Badge,
} from "@/components/ui";
import { PeriodBadge } from "@/components/domain/period-badge";
import { CategoryChip } from "@/components/domain/category-chip";
import {
  ArrowLeft,
  RotateCw,
  FileText,
  Layers,
  BookOpen as Read,
  FlaskConical,
  BookOpen,
  Search,
  Trash2,
  Info,
  AlertCircle,
} from "lucide-react";
import dayjs from "@/lib/dayjs-config";
import { getDocumentDisplayName, type EnrichmentMetadata } from "@/lib/enrichment-types";
import { getPeriodByCode, getCategoryByCode } from "@/lib/taxonomy";
import { safeGet, safeSet } from "@/lib/safe-storage";
import { cn } from "@/lib/cn";

interface Chunk {
  id: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  chunkSize: number;
  overlap: number;
  strategy: string;
  metadata: Record<string, unknown>;
}

interface DocumentDetail {
  id: string;
  filename: string;
  s3Url: string;
  fileSize: number;
  pageCount: number;
  status: string;
  enriched: boolean;
  metadata: EnrichmentMetadata;
  error?: string;
  createdAt: string;
  updatedAt: string;
  chunks: Chunk[];
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function periodSlugify(code: string): string {
  return code.toLowerCase().replace(/_/g, "-");
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [readingMode, setReadingMode] = useState<"by-page" | "continuous">(() =>
    safeGet<"by-page" | "continuous">("rag-master-reading-mode", "by-page"),
  );
  const [reprocessOpen, setReprocessOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const updateReadingMode = (m: "by-page" | "continuous") => {
    setReadingMode(m);
    safeSet("rag-master-reading-mode", m);
  };

  useEffect(() => {
    const ctrl = new AbortController();
    async function fetchDoc() {
      try {
        const res = await fetch(`/api/documents/${id}`, { signal: ctrl.signal });
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setDoc(data.document);
      } catch (e) {
        if ((e as Error).name !== "AbortError") console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchDoc();
    return () => ctrl.abort();
  }, [id]);

  // Polling con backoff exponencial
  useEffect(() => {
    if (doc?.status !== "PROCESSING") return;
    let cancelled = false;
    let delay = 3000;
    let tid: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/documents/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setDoc(data.document);
        }
      } catch {
        /* retry */
      }
      delay = Math.min(delay * 1.3, 15000);
      tid = setTimeout(tick, delay);
    };
    tid = setTimeout(tick, delay);
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [doc?.status, id]);

  const filteredChunks = useMemo(() => {
    if (!doc) return [];
    const q = search.trim().toLowerCase();
    if (!q) return doc.chunks;
    return doc.chunks.filter((c) => c.content.toLowerCase().includes(q));
  }, [doc, search]);

  const chunksByPage = useMemo(() => {
    if (!doc) return [];
    const map = new Map<number, Chunk[]>();
    for (const c of doc.chunks) {
      const arr = map.get(c.pageNumber) ?? [];
      arr.push(c);
      map.set(c.pageNumber, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [doc]);

  const handleConfirmReprocess = async () => {
    setReprocessing(true);
    try {
      await fetch(`/api/documents/${id}/reprocess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunkSize: 2000, chunkOverlap: 500, strategy: "FIXED" }),
      });
      const res = await fetch(`/api/documents/${id}`);
      const data = await res.json();
      setDoc(data.document);
      toast.success("Reprocesamiento iniciado");
      setReprocessOpen(false);
    } catch {
      toast.error("Error al reprocesar");
    } finally {
      setReprocessing(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      toast.success("Documento eliminado");
      router.push("/documents");
    } catch {
      toast.error("Error al eliminar");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[var(--container-default)] mx-auto px-8 py-8">
        <Skeleton variant="line" className="h-6 w-24 mb-4" />
        <Skeleton variant="block" className="h-[200px] w-full mb-4" />
        <Skeleton variant="line" className="h-4 w-full mb-2" />
        <Skeleton variant="line" className="h-4 w-11/12 mb-2" />
        <Skeleton variant="line" className="h-4 w-10/12 mb-2" />
        <Skeleton variant="line" className="h-4 w-full" />
      </div>
    );
  }

  if (notFound || !doc) {
    return (
      <div className="max-w-[var(--container-default)] mx-auto px-8 py-8">
        <div className="py-12 text-center">
          <FileText className="size-12 text-[var(--fg-subtle)] mx-auto mb-4" />
          <h2
            className="serif-title text-[20px] mb-2 text-[var(--color-ink-1000)]"
            style={{ fontWeight: 600 }}
          >
            Documento no encontrado
          </h2>
          <p className="text-[13px] text-[var(--fg-muted)] mb-4">
            Este documento puede haber sido eliminado o no existe.
          </p>
          <Link href="/documents">
            <Button variant="primary" leadingIcon={<ArrowLeft className="size-4" />}>
              Ver todos los documentos
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const display = getDocumentDisplayName(doc);
  const periodCode = doc.metadata?.primaryPeriod;
  const period = periodCode ? getPeriodByCode(periodCode) : undefined;
  const categoryCode = doc.metadata?.primaryCategory;
  const category = categoryCode ? getCategoryByCode(categoryCode) : undefined;
  const periodSlug = periodCode ? periodSlugify(periodCode) : undefined;

  return (
    <div className="max-w-[var(--container-default)] mx-auto px-8 py-8">
      <Button
        variant="ghost"
        size="sm"
        leadingIcon={<ArrowLeft className="size-4" />}
        className="mb-4"
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) router.back();
          else router.push("/documents");
        }}
      >
        Volver
      </Button>

      {/* Hero card */}
      <Card
        variant="default"
        size="md"
        className="mb-5 relative overflow-hidden"
        style={
          periodSlug
            ? { boxShadow: `inset 4px 0 0 var(--color-period-${periodSlug})` }
            : undefined
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div className="md:col-span-2">
            <div className="flex items-start gap-4">
              <div
                className="size-16 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: periodSlug
                    ? `color-mix(in oklab, var(--color-period-${periodSlug}) 12%, transparent)`
                    : "var(--bg-muted)",
                  color: periodSlug
                    ? `var(--color-period-${periodSlug})`
                    : "var(--fg-muted)",
                }}
              >
                <FileText className="size-7" />
              </div>
              <div className="min-w-0 flex-1">
                <h1
                  className="serif-title text-[24px] leading-tight mb-1 text-[var(--color-ink-1000)]"
                  style={{ fontWeight: 700 }}
                >
                  {display}
                </h1>
                {doc.metadata?.bookTitle && doc.filename !== doc.metadata.bookTitle && (
                  <div className="text-[12px] font-mono text-[var(--fg-subtle)] mt-1 truncate">
                    {doc.filename}
                  </div>
                )}
                {doc.metadata?.author && (
                  <div className="text-[14px] text-[var(--fg-muted)] mt-1.5">
                    {doc.metadata.author}
                    {doc.metadata.publicationYear && <> · {doc.metadata.publicationYear}</>}
                    {doc.metadata.publisher && <> · {doc.metadata.publisher}</>}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {period && (
                    <PeriodBadge code={period.code} size="sm" showYears />
                  )}
                  {category && <CategoryChip code={category.code} size="sm" />}
                  {doc.enriched && (
                    <Badge variant="tinta" size="sm">
                      ✓ Enriquecido
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-start justify-start md:justify-end gap-2">
            <Link href={`/enrich?docId=${doc.id}`}>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<FlaskConical className="size-3.5" />}
              >
                Enriquecer
              </Button>
            </Link>
            <Link href={`/questions?documentId=${doc.id}`}>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<BookOpen className="size-3.5" />}
              >
                Ver preguntas
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<RotateCw className="size-3.5" />}
              isLoading={reprocessing}
              onClick={() => setReprocessOpen(true)}
              disabled={doc.status === "PROCESSING"}
            >
              Reprocesar
            </Button>
            <Button
              variant="danger-outline"
              size="sm"
              leadingIcon={<Trash2 className="size-3.5" />}
              onClick={() => setDeleteOpen(true)}
            >
              Eliminar
            </Button>
          </div>
        </div>

        {doc.error && (
          <div className="mt-4 p-3 rounded-md border border-[var(--color-danger-fg)]/40 bg-[var(--color-danger-bg)] flex items-start gap-2.5">
            <AlertCircle className="size-4 text-[var(--color-danger-fg)] mt-0.5 shrink-0" />
            <div className="text-[13px] text-[var(--color-danger-fg)]">{doc.error}</div>
          </div>
        )}

        {doc.status === "PROCESSING" && (
          <div className="mt-4 p-3 rounded-md border border-[var(--color-info-fg)]/30 bg-[var(--color-info-bg)] flex items-start gap-2.5">
            <Info className="size-4 text-[var(--color-info-fg)] mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-[13px] font-medium text-[var(--color-info-fg)]">
                Procesamiento en curso
              </div>
              <div className="text-[12px] text-[var(--color-info-fg)]/85 mt-0.5">
                Los chunks y embeddings se están generando. La página se actualizará
                automáticamente.
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatTile icon={Read} label="Páginas" value={String(doc.pageCount)} />
        <StatTile icon={Layers} label="Chunks" value={String(doc.chunks.length)} />
        <StatTile label="Tamaño" value={formatBytes(doc.fileSize)} />
        <StatTile label="Cargado" value={dayjs(doc.createdAt).format("DD MMM YY")} />
      </div>

      {/* Tabs */}
      <Card variant="default" size="md">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList variant="underline">
            <TabsTrigger value="overview" variant="underline">
              <Info className="size-3.5" /> Resumen
            </TabsTrigger>
            {doc.chunks.length > 0 && (
              <>
                <TabsTrigger value="reading" variant="underline">
                  <Read className="size-3.5" /> Lectura inmersiva
                </TabsTrigger>
                <TabsTrigger value="chunks" variant="underline">
                  <Layers className="size-3.5" /> Chunks
                  <Badge variant="subtle" size="xs" className="ml-1">
                    {doc.chunks.length}
                  </Badge>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab doc={doc} />
          </TabsContent>

          {doc.chunks.length > 0 && (
            <>
              <TabsContent value="reading">
                <ReadingTab
                  chunksByPage={chunksByPage}
                  mode={readingMode}
                  onModeChange={updateReadingMode}
                />
              </TabsContent>
              <TabsContent value="chunks">
                <ChunksTab chunks={filteredChunks} search={search} onSearch={setSearch} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </Card>

      {/* Reprocess dialog */}
      <Dialog
        open={reprocessOpen}
        onOpenChange={(open) => {
          if (!open && !reprocessing) setReprocessOpen(false);
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Reprocesar documento</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-[14px] leading-relaxed text-[var(--fg-default)]">
              Esto regenera todos los chunks y embeddings. Las preguntas ya generadas se
              mantienen pero las citas pueden cambiar.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setReprocessOpen(false)}
              disabled={reprocessing}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmReprocess}
              isLoading={reprocessing}
            >
              Reprocesar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteOpen(false);
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
                ¿Eliminar este documento y todos sus chunks y preguntas? Esta acción no se
                puede deshacer.
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDeleteOpen(false)}
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

/* ─── Stat tile ──────────────────────────────────────────────────────────── */

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[var(--bg-page)] border border-[var(--border-default)] rounded-lg p-4">
      <div className="flex items-center gap-2 text-[12px] text-[var(--fg-subtle)]">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </div>
      <div
        className="text-[20px] font-semibold text-[var(--fg-default)] mt-1 tabular-nums"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {value}
      </div>
    </div>
  );
}

/* ─── Overview tab ───────────────────────────────────────────────────────── */

function OverviewTab({ doc }: { doc: DocumentDetail }) {
  const m = doc.metadata ?? {};
  const summary = typeof m.summary === "string" ? m.summary : null;
  const keywords = Array.isArray(m.keywords) ? m.keywords : [];

  return (
    <div>
      {summary ? (
        <div className="mb-5 p-5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-default)]">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
            Resumen
          </div>
          <p
            className="mt-2 text-[15px] leading-relaxed text-[var(--fg-default)]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {summary}
          </p>
        </div>
      ) : (
        <div className="mb-5 p-3 rounded-md border border-[var(--color-info-fg)]/30 bg-[var(--color-info-bg)] flex items-start gap-2.5">
          <Info className="size-4 text-[var(--color-info-fg)] mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-[13px] font-medium text-[var(--color-info-fg)]">Sin resumen</div>
            <div className="text-[12px] text-[var(--color-info-fg)]/85 mt-0.5">
              Este documento aún no está enriquecido.{" "}
              <Link
                href={`/enrich?docId=${doc.id}`}
                className="underline hover:no-underline font-medium"
              >
                Enriquecer ahora
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card variant="outline" size="sm">
          <h3 className="text-[13px] font-semibold text-[var(--fg-default)] mb-3">
            Bibliografía
          </h3>
          <MetaList
            items={[
              ["Autor", m.author],
              ["Título", m.bookTitle],
              ["ISBN", m.isbn],
              ["Editorial", m.publisher],
              ["Año", m.publicationYear],
              ["Edición", m.edition],
              ["Páginas", m.pageCount],
            ]}
          />
        </Card>
        <Card variant="outline" size="sm">
          <h3 className="text-[13px] font-semibold text-[var(--fg-default)] mb-3">
            Clasificación
          </h3>
          <MetaList
            items={[
              ["Periodo primario", m.primaryPeriod && getPeriodByCode(m.primaryPeriod)?.nombre],
              [
                "Periodo secundario",
                m.secondaryPeriod && getPeriodByCode(m.secondaryPeriod)?.nombre,
              ],
              [
                "Categoría primaria",
                m.primaryCategory && getCategoryByCode(m.primaryCategory)?.nombre,
              ],
              [
                "Categoría secundaria",
                m.secondaryCategory && getCategoryByCode(m.secondaryCategory)?.nombre,
              ],
            ]}
          />
          {keywords.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
                Palabras clave
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {keywords.map((k) => (
                  <Badge key={k} variant="subtle" size="xs">
                    {k}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function MetaList({
  items,
}: {
  items: Array<[string, string | number | undefined | null]>;
}) {
  const filtered = items.filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (filtered.length === 0)
    return <div className="text-[13px] text-[var(--fg-subtle)]">Sin información.</div>;
  return (
    <div className="flex flex-col gap-1.5">
      {filtered.map(([k, v]) => (
        <div
          key={k}
          className="grid gap-2 text-[13px]"
          style={{ gridTemplateColumns: "140px 1fr" }}
        >
          <div className="text-[12px] text-[var(--fg-muted)]">{k}</div>
          <div className="text-[var(--fg-default)]">{v}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Reading tab ────────────────────────────────────────────────────────── */

function ReadingTab({
  chunksByPage,
  mode,
  onModeChange,
}: {
  chunksByPage: Array<[number, Chunk[]]>;
  mode: "by-page" | "continuous";
  onModeChange: (m: "by-page" | "continuous") => void;
}) {
  if (chunksByPage.length === 0) {
    return (
      <div className="py-12 text-center">
        <FileText className="size-10 text-[var(--fg-subtle)] mx-auto mb-3" />
        <div className="text-[13px] text-[var(--fg-muted)]">Sin chunks generados</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Tabs value={mode} onValueChange={(v) => onModeChange(v as "by-page" | "continuous")}>
          <TabsList variant="segmented">
            <TabsTrigger value="by-page" variant="segmented">
              Por página
            </TabsTrigger>
            <TabsTrigger value="continuous" variant="segmented">
              Continuo
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-[12px] text-[var(--fg-muted)]">
          {chunksByPage.length} página{chunksByPage.length !== 1 ? "s" : ""} con chunks
        </span>
      </div>

      {mode === "continuous" ? (
        <div className="prose-academic max-w-[760px] mx-auto">
          {chunksByPage.map(([p, chunks]) => (
            <div key={p}>
              <div className="flex items-center gap-3 my-8">
                <div className="h-px flex-1 bg-[var(--border-default)]" />
                <Badge variant="subtle" size="xs" className="font-mono">
                  Página {p}
                </Badge>
                <div className="h-px flex-1 bg-[var(--border-default)]" />
              </div>
              {chunks.map((c) => (
                <p key={c.id}>{c.content}</p>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="max-w-[820px] mx-auto space-y-3">
          {chunksByPage.map(([p, chunks]) => (
            <Card key={p} variant="outline" size="sm">
              <header className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--border-default)]">
                <Badge variant="subtle" size="xs" className="font-mono">
                  Página {p}
                </Badge>
                <span className="text-[11px] text-[var(--fg-subtle)]">
                  {chunks.length} chunk{chunks.length !== 1 ? "s" : ""}
                </span>
              </header>
              <div className="prose-academic max-w-full">
                {chunks.map((c) => (
                  <p key={c.id} className="mb-3 last:mb-0">
                    {c.content}
                  </p>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Chunks tab ─────────────────────────────────────────────────────────── */

function ChunksTab({
  chunks,
  search,
  onSearch,
}: {
  chunks: Chunk[];
  search: string;
  onSearch: (v: string) => void;
}) {
  return (
    <div>
      <Input
        wrapperClassName="max-w-[480px] mb-4"
        placeholder="Buscar dentro de chunks…"
        leadingIcon={<Search />}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
      {chunks.length === 0 ? (
        <div className="py-12 text-center">
          <Search className="size-10 text-[var(--fg-subtle)] mx-auto mb-3" />
          <div className="text-[13px] text-[var(--fg-muted)]">
            {search ? "Sin coincidencias" : "Sin chunks"}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {chunks.map((c) => (
            <Card key={c.id} variant="outline" size="sm">
              <header className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[var(--border-default)]">
                <div className="text-[12px] font-medium text-[var(--fg-muted)]">
                  Chunk {c.chunkIndex + 1}
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="subtle" size="xs" className="font-mono">
                    #{c.chunkIndex}
                  </Badge>
                  <Badge variant="subtle" size="xs" className="font-mono">
                    p. {c.pageNumber}
                  </Badge>
                  <Badge variant="subtle" size="xs">
                    {c.chunkSize} ch
                  </Badge>
                </div>
              </header>
              <ChunkContent text={c.content} query={search} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ChunkContent({ text, query }: { text: string; query: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 600;
  const visible = !isLong || expanded ? text : `${text.slice(0, 600).trimEnd()}…`;

  return (
    <div>
      <p
        className={cn(
          "leading-relaxed text-[14px] text-[var(--fg-default)] whitespace-pre-wrap",
        )}
        style={{ fontFamily: "var(--font-serif)" }}
      >
        <Highlight text={visible} query={query} />
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 text-[12px] text-[var(--accent)] hover:underline font-medium"
        >
          {expanded ? "Mostrar menos" : "Mostrar más"}
        </button>
      )}
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        re.test(p) ? (
          <mark
            key={i}
            style={{
              background: "color-mix(in oklab, var(--color-warning-fg) 25%, transparent)",
              color: "var(--fg-default)",
              padding: "0 2px",
              borderRadius: 2,
            }}
          >
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
