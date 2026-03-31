"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, RefreshCw, CheckCircle2, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getDocumentDisplayName } from "@/lib/enrichment-types";

interface DocumentWithQuestions {
  id: string;
  filename: string;
  metadata?: Record<string, unknown>;
  status: string;
  _count: { chunks: number; questions: number };
  latestBatch?: string | null;
  latestDate?: string | null;
}

interface ProgressStep {
  step: string;
  message: string;
  done: boolean;
}

interface GeneratedQuestion {
  index: number;
  pregunta: string;
  periodoNombre: string;
  categoriaNombre: string;
}

export function GeneratePanel() {
  const [documents, setDocuments] = useState<DocumentWithQuestions[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const docsRes = await fetch("/api/documents?limit=100&status=READY");
      const docsData = await docsRes.json();
      const docs: DocumentWithQuestions[] = docsData.documents ?? [];

      const enriched = await Promise.all(
        docs.map(async (doc) => {
          try {
            const qRes = await fetch(`/api/documents/${doc.id}/questions`);
            const qData = await qRes.json();
            return {
              ...doc,
              _count: { ...doc._count, questions: qData.count ?? 0 },
              latestDate: qData.latestDate,
            };
          } catch {
            return { ...doc, _count: { ...doc._count, questions: 0 } };
          }
        })
      );

      setDocuments(enriched);
    } catch (err) {
      console.error("Error loading documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const selectedDocument = documents.find((d) => d.id === selectedDoc);
  const hasQuestions = (selectedDocument?._count.questions ?? 0) > 0;

  const handleGenerate = async () => {
    if (!selectedDoc) return;

    setGenerating(true);
    setProgress([]);
    setGeneratedQuestions([]);
    setError(null);
    setDone(false);

    const steps = [
      { step: "fetching_chunks", message: "Obteniendo chunks del documento..." },
      { step: "selecting_chunks", message: "Seleccionando fragmentos representativos..." },
      { step: "calling_claude", message: "Llamando a Claude Opus..." },
      { step: "parsing", message: "Procesando respuesta..." },
    ];

    try {
      const response = await fetch(`/api/documents/${selectedDoc}/questions/generate`, { method: "POST" });
      if (!response.body) throw new Error("No stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "progress") {
              setProgress((prev) => {
                const existing = prev.find((s) => s.step === event.step);
                if (existing) return prev.map((s) => s.step === event.step ? { ...s, done: true } : s);
                const stepDef = steps.find((s) => s.step === event.step);
                return [...prev.map((s) => ({ ...s, done: true })), {
                  step: event.step, message: stepDef?.message ?? event.message, done: false,
                }];
              });
            }

            if (event.type === "question") {
              setProgress((prev) => prev.map((s) => ({ ...s, done: true })));
              setGeneratedQuestions((prev) => [...prev, {
                index: event.index, pregunta: event.question.pregunta,
                periodoNombre: event.question.periodoNombre, categoriaNombre: event.question.categoriaNombre,
              }]);
            }

            if (event.type === "complete") {
              setProgress((prev) => prev.map((s) => ({ ...s, done: true })));
              setDone(true);
              loadDocuments();
            }

            if (event.type === "error") { setError(event.message); }
          } catch {/* skip malformed events */}
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  const readyDocs = documents.filter((d) => d.status === "READY");
  const withQuestions = documents.filter((d) => d._count.questions > 0).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-foreground font-mono">{readyDocs.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Documentos disponibles</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-success font-mono">{withQuestions}</p>
          <p className="text-xs text-muted-foreground mt-1">Con preguntas generadas</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-muted-foreground font-mono">{readyDocs.length - withQuestions}</p>
          <p className="text-xs text-muted-foreground mt-1">Pendientes</p>
        </div>
      </div>

      {/* Selector */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Seleccionar documento</h2>
        <select
          value={selectedDoc}
          onChange={(e) => { setSelectedDoc(e.target.value); setProgress([]); setGeneratedQuestions([]); setError(null); setDone(false); }}
          className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-ring"
        >
          <option value="">— Selecciona un documento —</option>
          {readyDocs.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc._count.questions > 0 ? "✓ " : "○ "}
              {(() => { const name = getDocumentDisplayName(doc); return name.length > 60 ? name.slice(0, 60) + "..." : name; })()}
              {doc._count.questions > 0 ? ` (${doc._count.questions} preguntas)` : ""}
            </option>
          ))}
        </select>

        {selectedDocument && (
          <div className="mt-4 p-4 bg-muted rounded-lg border border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedDocument._count.chunks}</span> chunks disponibles
                </p>
                {hasQuestions ? (
                  <p className="text-xs text-success mt-1">
                    {selectedDocument._count.questions} preguntas ya generadas
                    {selectedDocument.latestDate && (
                      <span className="text-muted-foreground ml-2">
                        &middot; {new Date(selectedDocument.latestDate).toLocaleDateString("es-CO")}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Sin preguntas generadas</p>
                )}
              </div>
              {hasQuestions && (
                <Link href={`/questions?documentId=${selectedDocument.id}`} className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors whitespace-nowrap">
                  Ver preguntas <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className={cn(
                "mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                generating
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : hasQuestions
                  ? "bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border"
                  : "bg-primary text-primary-foreground hover:bg-primary-hover"
              )}
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generando preguntas...</>
              ) : hasQuestions ? (
                <><RefreshCw className="h-4 w-4" /> Regenerar preguntas</>
              ) : (
                <><BookOpen className="h-4 w-4" /> Generar 20 preguntas</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Progreso */}
      {(progress.length > 0 || generating) && (
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Progreso</h3>
          <div className="space-y-2">
            {progress.map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-info flex-shrink-0" />
                )}
                <span className={step.done ? "text-muted-foreground" : "text-foreground"}>
                  {step.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-destructive-muted border border-destructive/30 rounded-lg text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Preview */}
      {generatedQuestions.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              {done ? `${generatedQuestions.length} preguntas generadas` : `Generando... ${generatedQuestions.length}/20`}
            </h3>
            {done && (
              <Link href={selectedDoc ? `/questions?documentId=${selectedDoc}` : "/questions"} className="text-xs text-accent hover:text-accent/80 flex items-center gap-1 transition-colors">
                Ver todas <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          <div className="space-y-2">
            {generatedQuestions.map((q) => (
              <div key={q.index} className="flex gap-3 p-3 bg-muted rounded-lg">
                <span className="text-muted-foreground font-mono text-xs min-w-[1.5rem]">{q.index}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground leading-relaxed line-clamp-2">{q.pregunta}</p>
                  <div className="flex gap-2 mt-1.5">
                    <span className="text-xs text-muted-foreground">{q.periodoNombre}</span>
                    <span className="text-muted-foreground/40">&middot;</span>
                    <span className="text-xs text-muted-foreground">{q.categoriaNombre}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
