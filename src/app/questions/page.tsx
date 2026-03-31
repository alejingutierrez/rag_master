"use client";

import { useState, useEffect, useCallback } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { QuestionCard } from "@/components/questions/question-card";
import { QuestionFilters, FilterState } from "@/components/questions/question-filters";
import { QuestionStats } from "@/components/questions/question-stats";
import { EmptyState } from "@/components/domain/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Sparkles, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Dialog, DialogHeader, DialogBody } from "@/components/ui/dialog";
import { BatchGeneratePanel } from "@/components/questions/batch-generate-panel";

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
  justificacion: string;
  document: { id: string; filename: string };
  createdAt: string;
}

interface StatsData {
  byCategoria: { code: string; nombre: string; count: number }[];
  byPeriodo: { code: string; nombre: string; count: number }[];
  totalDocuments: number;
  totalQuestions: number;
}

function QuestionsContent() {
  const searchParams = useSearchParams();
  const initialDocId = searchParams.get("documentId") ?? "";

  const [filters, setFilters] = useState<FilterState>({
    documentId: initialDocId,
    periodo: "",
    categoria: "",
    subcategoria: "",
    search: "",
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [documents, setDocuments] = useState<{ id: string; filename: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [showBatchGenerate, setShowBatchGenerate] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    fetch("/api/documents?limit=200")
      .then((r) => r.json())
      .then((data) => setDocuments(data.documents ?? []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch("/api/questions?includeStats=true&limit=1")
      .then((r) => r.json())
      .then((data) => setStats(data.stats ?? null))
      .catch(console.error);
  }, []);

  const fetchPendingCount = useCallback(() => {
    fetch("/api/questions/generate-batch")
      .then((r) => r.json())
      .then((data) => setPendingCount(data.pendingCount ?? 0))
      .catch(console.error);
  }, []);

  useEffect(() => { fetchPendingCount(); }, [fetchPendingCount]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.documentId) params.set("documentId", filters.documentId);
      if (filters.periodo) params.set("periodo", filters.periodo);
      if (filters.categoria) params.set("categoria", filters.categoria);
      if (filters.subcategoria) params.set("subcategoria", filters.subcategoria);
      if (filters.search) params.set("search", filters.search);
      params.set("page", String(page));
      params.set("limit", String(LIMIT));

      const res = await fetch(`/api/questions?${params.toString()}`);
      const data = await res.json();
      setQuestions(data.questions ?? []);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (err) {
      console.error("Error fetching questions:", err);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { setPage(1); }, [filters]);
  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1);
  };

  return (
    <PageContainer maxWidth="xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Preguntas de Investigacion</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total > 0
              ? `${total} preguntas generadas con Claude Opus`
              : "No hay preguntas generadas aun"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats && stats.totalQuestions > 0 && (
            <button
              onClick={() => setShowStats(!showStats)}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-surface-hover transition-colors"
            >
              {showStats ? "Ocultar stats" : "Ver stats"}
            </button>
          )}
          {pendingCount > 0 && (
            <button
              onClick={() => setShowBatchGenerate(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground border border-border rounded-lg text-xs font-medium hover:bg-secondary/80 transition-colors"
            >
              <Zap className="h-3.5 w-3.5" />
              Generar Todas ({pendingCount})
            </button>
          )}
          <Link
            href="/questions/generate"
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary-hover transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generar
          </Link>
        </div>
      </div>

      {/* Stats colapsables */}
      {showStats && stats && stats.totalQuestions > 0 && (
        <div className="mb-5">
          <QuestionStats stats={stats} />
        </div>
      )}

      {/* Filtros inline */}
      <div className="mb-4">
        <QuestionFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          documents={documents}
          periodos={[]}
          categorias={[]}
        />
      </div>

      {/* Lista de preguntas */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={total === 0 ? "Sin preguntas generadas" : "Sin resultados"}
          description={total === 0
            ? "Genera preguntas de investigacion a partir de tus documentos"
            : "Intenta con otros filtros"}
          action={total === 0 ? {
            label: "Generar preguntas",
            onClick: () => window.location.href = "/questions/generate",
          } : undefined}
        />
      ) : (
        <>
          <div className="space-y-2">
            {questions.map((q) => (
              <QuestionCard key={q.id} question={q} showDocument={!filters.documentId} />
            ))}
          </div>

          {/* Paginacion */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Pagina {page} de {totalPages} &middot; {total} preguntas
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {/* Dialog generacion en lote */}
      <Dialog open={showBatchGenerate} onClose={() => setShowBatchGenerate(false)}>
        <DialogHeader onClose={() => setShowBatchGenerate(false)}>
          Generar Preguntas en Lote
        </DialogHeader>
        <DialogBody>
          <BatchGeneratePanel
            pendingCount={pendingCount}
            onComplete={() => {
              fetchQuestions();
              fetchPendingCount();
            }}
          />
        </DialogBody>
      </Dialog>
    </PageContainer>
  );
}

export default function QuestionsPage() {
  return (
    <Suspense fallback={
      <PageContainer maxWidth="xl">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </PageContainer>
    }>
      <QuestionsContent />
    </Suspense>
  );
}
