"use client";

import { useState, useEffect } from "react";
import { X, Copy, Check, Loader2, BookOpen, BookText, AtSign, Camera, Palette, Video, Clapperboard, Mic } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { getTemplateById } from "@/lib/chat-templates";

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

interface DeliverableViewerProps {
  deliverableId: string;
  open: boolean;
  onClose: () => void;
}

interface DeliverableData {
  id: string;
  templateId: string;
  answer: string;
  modelUsed: string;
  createdAt: string;
  question: {
    pregunta: string;
    periodoNombre: string;
    categoriaNombre: string;
    document?: { filename: string };
  };
}

export function DeliverableViewer({ deliverableId, open, onClose }: DeliverableViewerProps) {
  const [data, setData] = useState<DeliverableData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !deliverableId) return;
    setLoading(true);
    fetch(`/api/deliverables/${deliverableId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, deliverableId]);

  const handleCopy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  const template = data ? getTemplateById(data.templateId) : null;
  const Icon = template ? ICON_MAP[template.icon] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-primary" />}
            <h3 className="text-lg font-semibold text-foreground">
              {template?.name || "Entregable"}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground border border-border hover:bg-surface-hover transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data ? (
            <div className="space-y-4">
              {/* Question context */}
              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-1">Pregunta:</p>
                <p className="text-sm text-foreground">{data.question.pregunta}</p>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                  <span>{data.question.periodoNombre}</span>
                  <span>·</span>
                  <span>{data.question.categoriaNombre}</span>
                  {data.question.document && (
                    <>
                      <span>·</span>
                      <span>{data.question.document.filename}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Answer */}
              <div className="prose-container">
                <MarkdownRenderer content={data.answer} />
              </div>

              {/* Footer metadata */}
              <div className="text-[10px] text-muted-foreground pt-2 border-t border-border">
                Generado: {new Date(data.createdAt).toLocaleString("es-CO")} · Modelo: {data.modelUsed}
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">
              No se pudo cargar el entregable
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
