"use client";

import { useState, useEffect, useCallback } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { QuestionCard } from "@/components/questions/question-card";
import { QuestionFilters, FilterState } from "@/components/questions/question-filters";
import { QuestionStats } from "@/components/questions/question-stats";
import { EmptyState } from "@/components/domain/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

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
    search: "",
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [documents, setDocuments] = useState<{ id: string; filename: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
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

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.documentId) params.set("documentId", filters.documentId);
      if (filters.periodo) params.set("periodo", filters.periodo);
      if (filters.categoria) params.set("categoria", filters.categoria);
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
            Preguntas de Investigacion
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total > 0
              ? `${total} preguntas generadas con Claude Opus`
              : "No hay preguntas generadas aun"}
          </p>
        </div>
        <Link
          href="/questions/generate"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Generar preguntas
        </Link>
      </div>

      {/* Stats */}
      {stats && stats.totalQuestions > 0 && (
        <div className="mb-6">
          <QuestionStats stats={stats} />
        </div>
      )}

      {/* Layout de dos columnas */}
      <div className="flex gap-6">
        <div className="w-64 flex-shrink-0">
          <QuestionFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            documents={documents}
            periodos={[]}
            categorias={[]}
          />
        </div>

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
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
              <div className="grid gap-3">
                {questions.map((q) => (
                  <QuestionCard key={q.id} question={q} showDocument={!filters.documentId} />
                ))}
              </div>

              {/* Paginacion */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Pagina {page} de {totalPages} &middot; {total} preguntas
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

export default function QuestionsPage() {
  return (
    <Suspense fallback={
      <PageContainer maxWidth="xl">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        </div>
      </PageContainer>
    }>
      <QuestionsContent />
    </Suspense>
  );
}
