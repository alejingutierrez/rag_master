"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { NewProductionModal } from "@/components/deliverables/new-production-modal";
import { getTemplateById, CHAT_TEMPLATES, CATEGORY_LABELS, type TemplateCategory } from "@/lib/chat-templates";
import { PeriodBadge } from "@/components/domain/period-badge";
import { CategoryBadge } from "@/components/domain/category-badge";
import {
  Loader2, ChevronLeft, ChevronRight, BookOpen, BookText, AtSign,
  Camera, Palette, Video, Clapperboard, Mic, Package, Plus, MessageSquare, Database,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  source: "chat" | "batch";
  modelUsed: string;
  batchId: string;
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
  const router = useRouter();
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [templateFilter, setTemplateFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"" | "chat" | "batch">("");
  const [showNewModal, setShowNewModal] = useState(false);

  const fetchDeliverables = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (templateFilter) params.set("templateId", templateFilter);
      if (sourceFilter) params.set("source", sourceFilter);

      const res = await fetch(`/api/deliverables?${params}`);
      const data = await res.json();
      setDeliverables(data.deliverables || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      setDeliverables([]);
    } finally {
      setLoading(false);
    }
  }, [page, templateFilter, sourceFilter]);

  useEffect(() => {
    fetchDeliverables();
  }, [fetchDeliverables]);

  useEffect(() => {
    setPage(1);
  }, [templateFilter, sourceFilter]);

  const selectClass =
    "h-8 px-2.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-ring";

  return (
    <PageContainer maxWidth="xl">
      {/* Header con CTA */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Producciones</h2>
          <p className="text-muted-foreground mt-1">
            Todos los entregables que has generado, en un solo lugar.
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva producción
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as "" | "chat" | "batch")}
          className={selectClass}
        >
          <option value="">Todos los orígenes</option>
          <option value="chat">Chat libre</option>
          <option value="batch">Batch de preguntas</option>
        </select>
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
        {(templateFilter || sourceFilter) && (
          <button
            onClick={() => {
              setTemplateFilter("");
              setSourceFilter("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : deliverables.length === 0 ? (
        <div className="text-center py-16">
          <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-foreground">No hay producciones todavía</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Empieza creando una nueva.
          </p>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm"
          >
            <Plus className="h-4 w-4" />
            Nueva producción
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {deliverables.map((d) => {
            const template = getTemplateById(d.templateId);
            const Icon = template ? ICON_MAP[template.icon] : Package;
            const questionText = d.question?.pregunta || d.userQuestion || "(sin pregunta)";
            const isGenerating = d.status === "GENERATING";

            return (
              <button
                key={d.id}
                onClick={() => router.push(`/producciones/${d.id}`)}
                className="w-full text-left p-4 rounded-lg border border-border bg-surface hover:border-border-hover transition-colors flex items-start gap-3"
              >
                <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-medium text-foreground">
                      {template?.name || d.templateId}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    {d.source === "chat" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" /> Chat
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Database className="h-3 w-3" /> Batch
                      </span>
                    )}
                    {isGenerating && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Generando…
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground line-clamp-2 leading-snug mb-1">
                    {questionText}
                  </p>
                  {d.answerPreview && !isGenerating && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">
                      {d.answerPreview}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    {d.question && (
                      <>
                        <PeriodBadge
                          code={d.question.periodoCode}
                          name={d.question.periodoNombre}
                          range=""
                        />
                        <CategoryBadge
                          code={d.question.categoriaCode}
                          name={d.question.categoriaNombre}
                        />
                      </>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(d.createdAt).toLocaleString("es-CO", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                </div>
              </button>
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

      {/* Modal Nueva producción */}
      <NewProductionModal open={showNewModal} onClose={() => setShowNewModal(false)} />
    </PageContainer>
  );
}
