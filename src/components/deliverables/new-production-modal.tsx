"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, Loader2, BookOpen, BookText, AtSign, Camera, Palette, Video, Clapperboard, Mic, Send,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  CHAT_TEMPLATES, getTemplateById, DEFAULT_TEMPLATE_ID, CATEGORY_LABELS,
  type TemplateCategory,
} from "@/lib/chat-templates";

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

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NewProductionModal({ open, onClose }: Props) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<string>(DEFAULT_TEMPLATE_ID);
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    const q = question.trim();
    if (!q) {
      setError("Escribe una pregunta");
      return;
    }
    if (q.split(/\s+/).filter((w) => w.length >= 2).length < 4) {
      setError("La pregunta debe tener al menos 4 palabras con detalle (no solo 'cuentame la historia').");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, templateId }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setError((err as { error?: string }).error || "Error al iniciar la producción");
        setSubmitting(false);
        return;
      }

      const data = (await r.json()) as { deliverableId?: string };
      if (!data.deliverableId) {
        setError("Respuesta del servidor sin deliverableId");
        setSubmitting(false);
        return;
      }

      router.push(`/producciones/${data.deliverableId}`);
    } catch (e) {
      setError((e as Error).message || "Error de red");
      setSubmitting(false);
    }
  };

  const grouped = (Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map((cat) => ({
    category: cat,
    templates: CHAT_TEMPLATES.filter((t) => t.category === cat),
  }));

  const selectedTemplate = getTemplateById(templateId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => !submitting && onClose()} />

      <div className="relative bg-surface border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Nueva producción</h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-md hover:bg-muted disabled:opacity-50"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6 flex-1">
          {/* Selector de template */}
          <div>
            <label className="text-sm font-medium text-foreground mb-3 block">
              ¿Qué quieres producir?
            </label>
            <div className="space-y-4">
              {grouped.map(({ category, templates }) => (
                <div key={category}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    {CATEGORY_LABELS[category]}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {templates.map((t) => {
                      const Icon = ICON_MAP[t.icon] || BookOpen;
                      const isSelected = t.id === templateId;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTemplateId(t.id)}
                          className={`text-left p-3 rounded-lg border-2 transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-border-hover bg-surface"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isSelected ? "bg-primary/15" : "bg-muted"
                              }`}
                            >
                              <Icon
                                className={`h-4 w-4 ${
                                  isSelected ? "text-primary" : "text-muted-foreground"
                                }`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground leading-snug">
                                {t.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                                {t.description}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pregunta */}
          <div>
            <label
              htmlFor="question"
              className="text-sm font-medium text-foreground mb-2 block"
            >
              Tu pregunta o tema
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={submitting}
              placeholder={
                selectedTemplate?.id === "fotografia-realista" ||
                selectedTemplate?.id === "ilustracion"
                  ? "Describe la escena histórica que quieres visualizar..."
                  : "Cuéntame la historia de Manuel Cepeda Vargas, el último senador de la Unión Patriótica..."
              }
              rows={4}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring resize-none disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Sé específico: incluye nombres, fechas o contexto. Las preguntas vagas dan
              respuestas vagas.
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground">
            La generación toma 1-3 minutos. Te llevamos a la vista de documento al terminar.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-md hover:bg-muted text-foreground disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || question.trim().length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Iniciando…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Producir
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
