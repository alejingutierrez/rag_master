"use client";

import { useState, useEffect, useCallback } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { DeliverableViewer } from "@/components/deliverables/deliverable-viewer";
import { getTemplateById, CHAT_TEMPLATES, CATEGORY_LABELS, type TemplateCategory } from "@/lib/chat-templates";
import { PeriodBadge } from "@/components/domain/period-badge";
import { CategoryBadge } from "@/components/domain/category-badge";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BookOpen,
  BookText,
  AtSign,
  Camera,
  Palette,
  Video,
  Clapperboard,
  Mic,
  Package,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  "book-text": BookText,
  "at-sign": AtSign,
  camera: Camera,
  palette: Palette,
  video: Video,
  clapperboard: Clapperboard,
  mic: Mic,
};

interface DeliverableItem {
  id: string;
  templateId: string;
  status: string;
  modelUsed: string;
  batchId: string;
  createdAt: string;
  answerPreview: string;
  question: {
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
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [templateFilter, setTemplateFilter] = useState("");
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [viewingId, setViewingId] = useState<string | null>(null);

  const fetchDeliverables = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (templateFilter) params.set("templateId", templateFilter);

      const res = await fetch(`/api/deliverables?${params}`);
      const data = await res.json();
      setDeliverables(data.deliverables || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      setDeliverables([]);
    } finally {
      setLoading(false);
    }
  }, [page, templateFilter]);

  useEffect(() => {
    fetchDeliverables();
  }, [fetchDeliverables]);

  useEffect(() => {
    setPage(1);
  }, [templateFilter]);

  // Group deliverables by question
  const groupedByQuestion = deliverables.reduce<
    Record<string, { question: DeliverableItem["question"]; items: DeliverableItem[] }>
  >((acc, d) => {
    const qId = d.question.id;
    if (!acc[qId]) {
      acc[qId] = { question: d.question, items: [] };
    }
    acc[qId].items.push(d);
    return acc;
  }, {});

  const toggleExpanded = (qId: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const selectClass = "h-8 px-2.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-ring";

  return (
    <PageContainer maxWidth="xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Producciones</h2>
        <p className="text-muted-foreground mt-1">
          Entregables generados a partir de las preguntas de investigacion.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <select
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">Todos los formatos</option>
          {(Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map((cat) => (
            <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
              {CHAT_TEMPLATES.filter((t) => t.category === cat).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : Object.keys(groupedByQuestion).length === 0 ? (
        <div className="text-center py-16">
          <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-foreground">No hay producciones todavia</p>
          <p className="text-sm text-muted-foreground mt-1">
            Usa el boton &quot;+ Producir&quot; en la seccion Consultar para generar entregables.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedByQuestion).map(([qId, { question, items }]) => {
            const isExpanded = expandedQuestions.has(qId);
            return (
              <div key={qId} className="bg-surface border border-border rounded-lg">
                {/* Question header */}
                <button
                  onClick={() => toggleExpanded(qId)}
                  className="w-full text-left p-4 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                      {question.pregunta}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <PeriodBadge code={question.periodoCode} name={question.periodoNombre} range="" />
                      <CategoryBadge code={question.categoriaCode} name={question.categoriaNombre} />
                      <span className="text-[10px] text-muted-foreground ml-2">
                        {items.length} entregable{items.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground mt-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground mt-1" />
                  )}
                </button>

                {/* Deliverable cards */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 space-y-2">
                    {items.map((d) => {
                      const template = getTemplateById(d.templateId);
                      const Icon = template ? ICON_MAP[template.icon] : null;
                      return (
                        <button
                          key={d.id}
                          onClick={() => setViewingId(d.id)}
                          className="w-full text-left p-3 rounded-lg border border-border hover:border-border-hover transition-colors flex items-start gap-3"
                        >
                          <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                            "bg-primary/10"
                          )}>
                            {Icon && <Icon className="h-4 w-4 text-primary" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {template?.name || d.templateId}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {d.answerPreview}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {new Date(d.createdAt).toLocaleString("es-CO")}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Viewer modal */}
      {viewingId && (
        <DeliverableViewer
          deliverableId={viewingId}
          open={!!viewingId}
          onClose={() => setViewingId(null)}
        />
      )}
    </PageContainer>
  );
}
