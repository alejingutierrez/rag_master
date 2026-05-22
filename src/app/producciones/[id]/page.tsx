"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { getTemplateById, CATEGORY_LABELS } from "@/lib/chat-templates";
import {
  ArrowLeft, Copy, Check, Download, FileText, Loader2,
  BookOpen, BookText, AtSign, Camera, Palette, Video, Clapperboard, Mic,
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

interface DeliverableDetail {
  id: string;
  templateId: string;
  answer: string;
  modelUsed: string;
  status: string;
  source: string;
  userQuestion: string | null;
  createdAt: string;
  updatedAt: string;
  chunksUsed: Array<{ documentFilename?: string; pageNumber?: number; similarity?: number }>;
  question: null | {
    pregunta: string;
    periodoNombre: string;
    categoriaNombre: string;
    document?: { filename: string };
  };
}

export default function ProduccionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<DeliverableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch(`/api/deliverables/${id}`);
      if (!r.ok) {
        setError("Entregable no encontrado");
        return;
      }
      const d = await r.json();
      setData(d);
    } catch (e) {
      setError("Error cargando el entregable");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling mientras está GENERATING
  useEffect(() => {
    if (!data || data.status !== "GENERATING") return;
    const t = setInterval(() => fetchData(), 3000);
    return () => clearInterval(t);
  }, [data, fetchData]);

  const handleCopy = useCallback(async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data]);

  const handleDownload = useCallback(
    async (format: "md" | "docx" | "pdf") => {
      if (!data) return;
      setDownloading(format);
      try {
        const r = await fetch(`/api/deliverables/${id}/export?format=${format}`);
        if (!r.ok) {
          setError(`Error exportando ${format.toUpperCase()}`);
          return;
        }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slugify(data)}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        setError(`Error exportando ${format.toUpperCase()}`);
      } finally {
        setDownloading(null);
      }
    },
    [data, id]
  );

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
        </div>
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <PageContainer>
        <div className="text-center py-32">
          <p className="text-foreground mb-4">{error || "Entregable no encontrado"}</p>
          <button
            onClick={() => router.push("/producciones")}
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a producciones
          </button>
        </div>
      </PageContainer>
    );
  }

  const template = getTemplateById(data.templateId);
  const Icon = template ? ICON_MAP[template.icon] : FileText;

  const questionText = data.question?.pregunta || data.userQuestion || "(sin pregunta)";
  const wordCount = data.answer
    .split(/## Referencias/)[0]
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const uniqueSources = new Set(
    data.chunksUsed.map((c) => c.documentFilename).filter(Boolean)
  ).size;

  const isGenerating = data.status === "GENERATING" || (data.answer === "" && data.status !== "ERROR");

  return (
    <PageContainer>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/producciones")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Producciones
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted disabled:opacity-50 transition-colors"
            title="Copiar como Markdown"
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar MD"}
          </button>
          <button
            onClick={() => handleDownload("md")}
            disabled={isGenerating || downloading !== null}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted disabled:opacity-50 transition-colors"
          >
            {downloading === "md" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            .md
          </button>
          <button
            onClick={() => handleDownload("docx")}
            disabled={isGenerating || downloading !== null}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted disabled:opacity-50 transition-colors"
          >
            {downloading === "docx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            .docx
          </button>
          <button
            onClick={() => handleDownload("pdf")}
            disabled={isGenerating || downloading !== null}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted disabled:opacity-50 transition-colors"
          >
            {downloading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            .pdf
          </button>
        </div>
      </div>

      {/* Header con metadata */}
      <div className="border border-border rounded-xl bg-surface px-6 py-5 mb-8">
        <div className="flex items-start gap-3 mb-3">
          {Icon && <Icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {template?.name || data.templateId}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {template ? CATEGORY_LABELS[template.category] : ""}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {data.source === "chat" ? "Chat libre" : "Batch"}
              </span>
            </div>
            <h2 className="text-base font-medium text-foreground leading-snug">
              {questionText}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-2 border-t border-border">
          {!isGenerating && (
            <>
              <span><strong className="text-foreground">{wordCount}</strong> palabras</span>
              <span><strong className="text-foreground">{uniqueSources}</strong> fuentes</span>
            </>
          )}
          <span>
            {new Date(data.createdAt).toLocaleString("es-CO", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          {isGenerating && (
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Generando…
            </span>
          )}
          {data.status === "ERROR" && (
            <span className="text-destructive">Error en la generación</span>
          )}
        </div>
      </div>

      {/* Documento */}
      <article className="prose prose-neutral dark:prose-invert max-w-3xl mx-auto px-4 py-2">
        {isGenerating && data.answer === "" ? (
          <div className="text-muted-foreground italic text-center py-16">
            La producción se está generando. Esto puede tardar 1-3 minutos.
          </div>
        ) : (
          <MarkdownRenderer content={data.answer} />
        )}
      </article>
    </PageContainer>
  );
}

function slugify(d: DeliverableDetail): string {
  const q = d.question?.pregunta || d.userQuestion || "produccion";
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 60);
}
