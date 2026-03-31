"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  BookOpen,
  Camera,
  Palette,
  Video,
  Clapperboard,
  Mic,
  BookText,
  AtSign,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAT_TEMPLATES, CATEGORY_LABELS, type TemplateCategory } from "@/lib/chat-templates";
import { PeriodBadge } from "@/components/domain/period-badge";
import { CategoryBadge } from "@/components/domain/category-badge";
import { getDocumentDisplayName } from "@/lib/enrichment-types";

// ─── Icon map (same as template-selector) ────────────────────────────

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

// ─── Filter options (from question-filters.tsx) ──────────────────────

const PERIOD_OPTIONS = [
  { code: "PRE", nombre: "Prehispanico" },
  { code: "CON", nombre: "Conquista" },
  { code: "COL", nombre: "Colonia" },
  { code: "PRE_IND", nombre: "Crisis Colonial" },
  { code: "IND", nombre: "Independencia" },
  { code: "NGR", nombre: "Nueva Granada" },
  { code: "EUC", nombre: "E.U. Colombia" },
  { code: "REG", nombre: "Regeneracion" },
  { code: "REP_LIB", nombre: "Rep. Liberal" },
  { code: "VIO", nombre: "La Violencia" },
  { code: "FN", nombre: "Frente Nacional" },
  { code: "CNA", nombre: "Narcotrafico" },
  { code: "C91", nombre: "Const. 91" },
  { code: "SDE", nombre: "Seg. Democratica" },
  { code: "POS", nombre: "Posconflicto" },
  { code: "TRANS", nombre: "Transversal" },
];

const CATEGORY_OPTIONS = [
  { code: "POL", nombre: "Politica" },
  { code: "ECO", nombre: "Economia" },
  { code: "CON", nombre: "Conflicto" },
  { code: "SOC", nombre: "Sociedad" },
  { code: "CUL", nombre: "Cultura" },
  { code: "REL", nombre: "Relaciones Int." },
  { code: "TER", nombre: "Territorio" },
  { code: "MOV", nombre: "Movimientos" },
  { code: "INS", nombre: "Instituciones" },
  { code: "HIS", nombre: "Historiografia" },
];

// ─── Types ───────────────────────────────────────────────────────────

interface Question {
  id: string;
  questionNumber: number;
  pregunta: string;
  periodoCode: string;
  periodoNombre: string;
  periodoRango: string;
  categoriaCode: string;
  categoriaNombre: string;
  document?: { id: string; filename: string; metadata?: Record<string, unknown> };
}

interface BatchEvent {
  type: string;
  templateId?: string;
  templateName?: string;
  deliverableId?: string;
  answerPreview?: string;
  index?: number;
  total?: number;
  totalTemplates?: number;
  generated?: number;
  failed?: number;
  batchId?: string;
  error?: string;
  message?: string;
}

interface GenerateDeliverablesDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

type Step = "select-question" | "select-templates" | "generating";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

// ─── Component ───────────────────────────────────────────────────────

export function GenerateDeliverablesDialog({
  open,
  onClose,
  onComplete,
}: GenerateDeliverablesDialogProps) {
  // Step state
  const [step, setStep] = useState<Step>("select-question");

  // Question selection
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionPage, setQuestionPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ periodo: "", categoria: "", search: "" });

  // Template selection
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

  // Generation progress
  const [generating, setGenerating] = useState(false);
  const [events, setEvents] = useState<BatchEvent[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentTemplate, setCurrentTemplate] = useState<string | null>(null);
  const [result, setResult] = useState<{ generated: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryInfo, setRetryInfo] = useState({ count: 0, active: false });
  const eventsRef = useRef<BatchEvent[]>([]);

  // Fetch questions
  const fetchQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    try {
      const params = new URLSearchParams({ page: String(questionPage), limit: "10" });
      if (filters.periodo) params.set("periodo", filters.periodo);
      if (filters.categoria) params.set("categoria", filters.categoria);
      if (filters.search) params.set("search", filters.search);

      const res = await fetch(`/api/questions?${params}`);
      const data = await res.json();
      setQuestions(data.questions || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      setQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  }, [questionPage, filters]);

  useEffect(() => {
    if (open && step === "select-question") fetchQuestions();
  }, [open, step, fetchQuestions]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep("select-question");
      setSelectedQuestion(null);
      setSelectedTemplateIds([]);
      setEvents([]);
      setResult(null);
      setError(null);
      setGenerating(false);
    }
  }, [open]);

  // Reset page when filters change
  useEffect(() => {
    setQuestionPage(1);
  }, [filters.periodo, filters.categoria, filters.search]);

  // ─── SSE Generation ───────────────────────────────────────────────

  async function runGeneration(): Promise<void> {
    if (!selectedQuestion) return;

    setGenerating(true);
    setEvents([]);
    eventsRef.current = [];
    setProgress({ current: 0, total: selectedTemplateIds.length });
    setCurrentTemplate(null);
    setResult(null);
    setError(null);
    setRetryInfo({ count: 0, active: false });

    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      try {
        const response = await fetch("/api/deliverables/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: selectedQuestion.id,
            templateIds: selectedTemplateIds,
          }),
        });

        if (!response.body) throw new Error("No stream");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let receivedComplete = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith(":")) continue;
            if (!line.startsWith("data: ")) continue;
            try {
              const event: BatchEvent = JSON.parse(line.slice(6));

              if (event.type === "start") {
                setProgress({ current: 0, total: event.totalTemplates ?? 0 });
              }

              if (event.type === "template_start") {
                setCurrentTemplate(event.templateName ?? null);
              }

              if (event.type === "template_complete" || event.type === "template_error") {
                eventsRef.current = [...eventsRef.current, event];
                setEvents([...eventsRef.current]);
                setProgress((p) => ({ ...p, current: event.index ?? p.current }));
              }

              if (event.type === "complete") {
                receivedComplete = true;
                setResult({
                  generated: event.generated ?? 0,
                  failed: event.failed ?? 0,
                });
                setGenerating(false);
                onComplete?.();
                return;
              }

              if (event.type === "error") {
                setError(event.message ?? "Error desconocido");
                setGenerating(false);
                return;
              }
            } catch {
              /* skip malformed */
            }
          }
        }

        if (receivedComplete) return;

        // Stream ended without complete event — retry
        attempt++;
        if (attempt > MAX_RETRIES) {
          setError("Conexion perdida. Los entregables ya generados se guardaron.");
          setGenerating(false);
          return;
        }

        setRetryInfo({ count: attempt, active: true });
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        setRetryInfo({ count: attempt, active: false });
      } catch {
        attempt++;
        if (attempt > MAX_RETRIES) {
          setError("Error de conexion despues de varios intentos.");
          setGenerating(false);
          return;
        }
        setRetryInfo({ count: attempt, active: true });
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        setRetryInfo({ count: attempt, active: false });
      }
    }
  }

  // ─── Template toggle helpers ──────────────────────────────────────

  const toggleTemplate = (id: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const toggleCategory = (category: TemplateCategory) => {
    const catTemplates = CHAT_TEMPLATES.filter((t) => t.category === category);
    const allSelected = catTemplates.every((t) => selectedTemplateIds.includes(t.id));
    if (allSelected) {
      setSelectedTemplateIds((prev) => prev.filter((id) => !catTemplates.some((t) => t.id === id)));
    } else {
      setSelectedTemplateIds((prev) => [...new Set([...prev, ...catTemplates.map((t) => t.id)])]);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────

  const selectClass = "h-8 px-2.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-ring min-w-0";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={step !== "generating" ? onClose : undefined} />
      <div className="relative bg-surface border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">
            {step === "select-question" && "Seleccionar pregunta"}
            {step === "select-templates" && "Seleccionar formatos"}
            {step === "generating" && "Generando entregables"}
          </h3>
          {step !== "generating" && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ── STEP 1: Select Question ────────────────────────────── */}
          {step === "select-question" && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={filters.search}
                    onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                    className="h-8 w-44 pl-8 pr-3 bg-surface border border-border rounded-md text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring"
                  />
                </div>
                <select
                  value={filters.periodo}
                  onChange={(e) => setFilters((f) => ({ ...f, periodo: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Periodo</option>
                  {PERIOD_OPTIONS.map((p) => (
                    <option key={p.code} value={p.code}>{p.nombre}</option>
                  ))}
                </select>
                <select
                  value={filters.categoria}
                  onChange={(e) => setFilters((f) => ({ ...f, categoria: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Categoria</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Questions list */}
              {loadingQuestions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : questions.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No se encontraron preguntas
                </p>
              ) : (
                <div className="space-y-2">
                  {questions.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQuestion(q)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-colors",
                        selectedQuestion?.id === q.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-border-hover"
                      )}
                    >
                      <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                        {q.pregunta}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <PeriodBadge code={q.periodoCode} name={q.periodoNombre} range={q.periodoRango} />
                        <CategoryBadge code={q.categoriaCode} name={q.categoriaNombre} />
                        {q.document && (
                          <span className="text-[10px] text-muted-foreground ml-auto truncate max-w-[150px]">
                            {getDocumentDisplayName(q.document)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setQuestionPage((p) => Math.max(1, p - 1))}
                    disabled={questionPage === 1}
                    className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {questionPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setQuestionPage((p) => Math.min(totalPages, p + 1))}
                    disabled={questionPage === totalPages}
                    className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Select Templates ───────────────────────────── */}
          {step === "select-templates" && selectedQuestion && (
            <div className="space-y-5">
              {/* Selected question preview */}
              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-1">Pregunta seleccionada:</p>
                <p className="text-sm text-foreground">{selectedQuestion.pregunta}</p>
              </div>

              {/* Template checkboxes by category */}
              {(Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map((category) => {
                const templates = CHAT_TEMPLATES.filter((t) => t.category === category);
                if (templates.length === 0) return null;
                const allSelected = templates.every((t) => selectedTemplateIds.includes(t.id));

                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                      >
                        {CATEGORY_LABELS[category]}
                      </button>
                      <span className="text-[10px] text-muted-foreground">
                        ({allSelected ? "deseleccionar" : "seleccionar"} todos)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {templates.map((template) => {
                        const Icon = ICON_MAP[template.icon];
                        const checked = selectedTemplateIds.includes(template.id);
                        return (
                          <label
                            key={template.id}
                            className={cn(
                              "flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors",
                              checked
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-border-hover"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTemplate(template.id)}
                              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                            />
                            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{template.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{template.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── STEP 3: Generation Progress ────────────────────────── */}
          {step === "generating" && (
            <div className="space-y-4">
              {/* Progress bar */}
              {progress.total > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {retryInfo.active
                        ? "Reconectando..."
                        : `Procesando ${progress.current} de ${progress.total}`}
                    </span>
                    <span className="text-foreground font-mono">
                      {Math.round((progress.current / progress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                  {retryInfo.active ? (
                    <p className="text-xs text-warning">
                      <RefreshCw className="inline h-3 w-3 animate-spin mr-1" />
                      Reconectando (intento {retryInfo.count}/{MAX_RETRIES})...
                    </p>
                  ) : currentTemplate ? (
                    <p className="text-xs text-muted-foreground">
                      <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                      {currentTemplate}
                    </p>
                  ) : null}
                </div>
              )}

              {generating && progress.total === 0 && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Iniciando generacion...
                </p>
              )}

              {/* Events log */}
              {events.length > 0 && (
                <div className="border border-border rounded-lg p-4 max-h-60 overflow-y-auto space-y-1.5">
                  {events.map((evt, i) => {
                    const Icon = evt.templateId ? ICON_MAP[CHAT_TEMPLATES.find((t) => t.id === evt.templateId)?.icon || ""] : null;
                    return (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        {evt.type === "template_complete" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex items-center gap-1.5 min-w-0">
                          {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
                          <span className={evt.type === "template_complete" ? "text-foreground" : "text-destructive"}>
                            {evt.templateName}
                          </span>
                          {evt.type === "template_error" && (
                            <span className="text-destructive/70">({evt.error})</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Result */}
              {result && (
                <div className={cn(
                  "flex items-start gap-3 p-4 rounded-lg text-sm border",
                  result.failed === 0
                    ? "bg-success-muted border-success/30 text-success"
                    : "bg-warning-muted border-warning/30 text-warning"
                )}>
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Generacion completada</p>
                    <p className="text-xs mt-0.5 opacity-80">
                      {result.generated} entregable{result.generated !== 1 ? "s" : ""} generado{result.generated !== 1 ? "s" : ""}
                      {result.failed > 0 && `, ${result.failed} con error`}
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-destructive-muted border border-destructive/30 rounded-lg text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-between">
          {step === "select-question" && (
            <>
              <div />
              <button
                onClick={() => setStep("select-templates")}
                disabled={!selectedQuestion}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            </>
          )}

          {step === "select-templates" && (
            <>
              <button
                onClick={() => setStep("select-question")}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="inline h-4 w-4 mr-1" />
                Atras
              </button>
              <button
                onClick={() => {
                  setStep("generating");
                  runGeneration();
                }}
                disabled={selectedTemplateIds.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Generar ({selectedTemplateIds.length} formato{selectedTemplateIds.length !== 1 ? "s" : ""})
              </button>
            </>
          )}

          {step === "generating" && (
            <>
              <div />
              {(result || error) && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  Cerrar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
