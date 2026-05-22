"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, Circle,
  Sparkles, RefreshCw,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type CellStatus = "PENDING" | "GENERATING" | "COMPLETE" | "ERROR" | null;

interface Template {
  id: string;
  name: string;
  category: string;
  icon: string;
}

interface MatrixRow {
  id: string;
  pregunta: string;
  periodoCode: string;
  periodoNombre: string;
  categoriaCode: string;
  categoriaNombre: string;
  subcategoriaCode: string;
  documentId: string;
  documentFilename: string;
  completedCount: number;
  stateLabel: "complete" | "partial" | "pending";
  byTemplate: Record<string, { deliverableId: string; status: CellStatus } | null>;
}

interface MatrixResponse {
  templates: Template[];
  totalTemplates: number;
  rows: MatrixRow[];
  counts: { all: number; complete: number; partial: number; pending: number };
}

function MatrixContent() {
  const [data, setData] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState<"all" | "pending" | "partial" | "complete">("all");
  const [documentId, setDocumentId] = useState<string>("");
  const [documents, setDocuments] = useState<{ id: string; filename: string }[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [jobMsg, setJobMsg] = useState<string | null>(null);

  // Cargar documentos para el dropdown
  useEffect(() => {
    fetch("/api/documents?limit=200")
      .then((r) => r.json())
      .then((d) => setDocuments(d.documents ?? []))
      .catch(console.error);
  }, []);

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (documentId) params.set("documentId", documentId);
      if (stateFilter !== "all") params.set("status", stateFilter);
      const res = await fetch(`/api/questions/matrix?${params.toString()}`);
      const json = (await res.json()) as MatrixResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [documentId, stateFilter]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  // Limpiar selección cuando cambian filtros
  useEffect(() => {
    setSelectedQuestions(new Set());
  }, [documentId, stateFilter]);

  const toggleQuestion = (id: string) => {
    setSelectedQuestions((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTemplate = (id: string) => {
    setSelectedTemplates((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllQuestions = () => {
    if (!data) return;
    setSelectedQuestions(new Set(data.rows.map((r) => r.id)));
  };

  const clearSelection = () => {
    setSelectedQuestions(new Set());
    setSelectedTemplates(new Set());
  };

  const handleBulkGenerate = async () => {
    if (selectedQuestions.size === 0 || selectedTemplates.size === 0) return;
    setSubmitting(true);
    setJobMsg(null);
    try {
      const res = await fetch("/api/deliverables/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIds: Array.from(selectedQuestions),
          templateIds: Array.from(selectedTemplates),
          onlyMissing: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");
      setJobMsg(json.message || `Job ${json.jobId} encolado: ${json.totalPairs} entregables`);
    } catch (e) {
      setJobMsg(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  };

  const pairsToGenerate = useMemo(() => {
    if (!data) return 0;
    let count = 0;
    for (const qid of selectedQuestions) {
      const row = data.rows.find((r) => r.id === qid);
      if (!row) continue;
      for (const tid of selectedTemplates) {
        if (row.byTemplate[tid]?.status !== "COMPLETE") count++;
      }
    }
    return count;
  }, [data, selectedQuestions, selectedTemplates]);

  return (
    <PageContainer maxWidth="xl">
      <div className="mb-4">
        <Link
          href="/questions"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a preguntas
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Matriz de Producción</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Selecciona preguntas y templates para generar entregables faltantes en lote.
            </p>
          </div>
          <button
            onClick={fetchMatrix}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 inline mr-1", loading && "animate-spin")} />
            Refrescar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          className="px-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-ring max-w-md"
        >
          <option value="">Todos los documentos</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.filename.slice(0, 60)}
            </option>
          ))}
        </select>

        <div className="flex gap-1.5">
          {([
            { key: "all", label: "Todas", n: data?.counts.all },
            { key: "pending", label: "Pendientes", n: data?.counts.pending },
            { key: "partial", label: "Parciales", n: data?.counts.partial },
            { key: "complete", label: "Completas", n: data?.counts.complete },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStateFilter(tab.key)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium border transition-colors",
                stateFilter === tab.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {tab.label}
              {typeof tab.n === "number" && (
                <span className="ml-1.5 opacity-70 font-mono text-[10px]">{tab.n}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar selección + acción */}
      {data && data.rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-3 bg-surface border border-border rounded-lg">
          <button
            onClick={selectAllQuestions}
            disabled={selectedQuestions.size === data.rows.length}
            className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          >
            Seleccionar visibles ({data.rows.length})
          </button>
          <span className="text-muted-foreground/40">·</span>
          <button
            onClick={clearSelection}
            disabled={selectedQuestions.size === 0 && selectedTemplates.size === 0}
            className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          >
            Limpiar selección
          </button>
          <span className="text-xs text-muted-foreground ml-auto">
            <strong className="text-foreground">{selectedQuestions.size}</strong> preguntas ×{" "}
            <strong className="text-foreground">{selectedTemplates.size}</strong> templates ={" "}
            <strong className="text-accent">{pairsToGenerate}</strong> entregables a generar
          </span>
          <button
            onClick={handleBulkGenerate}
            disabled={
              submitting ||
              pairsToGenerate === 0 ||
              selectedQuestions.size === 0 ||
              selectedTemplates.size === 0
            }
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              submitting || pairsToGenerate === 0
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary-hover"
            )}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Generar faltantes ({pairsToGenerate})
          </button>
        </div>
      )}

      {jobMsg && (
        <div className="mb-3 p-3 rounded-lg bg-info/10 border border-info/30 text-xs text-info">
          {jobMsg}
        </div>
      )}

      {/* Matriz */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded" />
          ))}
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No hay preguntas con los filtros actuales.
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 text-left w-8">
                  <input
                    type="checkbox"
                    checked={
                      selectedQuestions.size === data.rows.length && data.rows.length > 0
                    }
                    onChange={(e) =>
                      e.target.checked ? selectAllQuestions() : setSelectedQuestions(new Set())
                    }
                    className="accent-accent"
                    aria-label="Seleccionar todas"
                  />
                </th>
                <th className="px-2 py-2 text-left font-medium text-muted-foreground min-w-[24rem]">
                  Pregunta
                </th>
                {data.templates.map((t) => (
                  <th
                    key={t.id}
                    className="px-1 py-2 text-center font-medium text-muted-foreground"
                  >
                    <label className="flex flex-col items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTemplates.has(t.id)}
                        onChange={() => toggleTemplate(t.id)}
                        className="accent-accent"
                      />
                      <span className="text-[10px] writing-mode-vertical-rl whitespace-nowrap rotate-180 [writing-mode:vertical-rl]">
                        {t.name}
                      </span>
                    </label>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-t border-border hover:bg-surface-hover transition-colors",
                    selectedQuestions.has(row.id) && "bg-primary/5"
                  )}
                >
                  <td className="px-2 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={selectedQuestions.has(row.id)}
                      onChange={() => toggleQuestion(row.id)}
                      className="accent-accent"
                      aria-label="Seleccionar pregunta"
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <p className="text-xs text-foreground leading-snug line-clamp-2">
                      {row.pregunta}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      <span className="font-mono">{row.periodoCode}</span> ·{" "}
                      <span className="font-mono">{row.categoriaCode}</span> ·{" "}
                      <span className="font-mono">{row.subcategoriaCode}</span> ·{" "}
                      <span className="truncate">{row.documentFilename.slice(0, 50)}</span>
                    </p>
                  </td>
                  {data.templates.map((t) => {
                    const cell = row.byTemplate[t.id];
                    const status = cell?.status;
                    return (
                      <td key={t.id} className="px-1 py-2 text-center align-top">
                        {status === "COMPLETE" && cell ? (
                          <Link
                            href={`/producciones/${cell.deliverableId}`}
                            title="Ver entregable"
                            className="inline-flex items-center justify-center h-6 w-6 rounded bg-success/15 text-success hover:bg-success/25 transition-colors"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Link>
                        ) : status === "GENERATING" ? (
                          <span
                            title="Generando"
                            className="inline-flex items-center justify-center h-6 w-6 rounded bg-info/15 text-info"
                          >
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          </span>
                        ) : status === "ERROR" ? (
                          <span
                            title="Error"
                            className="inline-flex items-center justify-center h-6 w-6 rounded bg-destructive/15 text-destructive"
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span
                            title="Pendiente"
                            className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground/50"
                          >
                            <Circle className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}

export default function MatrixPage() {
  return (
    <Suspense
      fallback={
        <PageContainer maxWidth="xl">
          <Skeleton className="h-8 w-64 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded" />
            ))}
          </div>
        </PageContainer>
      }
    >
      <MatrixContent />
    </Suspense>
  );
}
