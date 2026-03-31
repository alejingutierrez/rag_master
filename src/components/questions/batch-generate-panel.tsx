"use client";

import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface BatchGeneratePanelProps {
  pendingCount: number;
  onComplete: () => void;
}

interface BatchEvent {
  type: string;
  documentId?: string;
  filename?: string;
  questionsGenerated?: number;
  index?: number;
  total?: number;
  totalDocuments?: number;
  generated?: number;
  failed?: number;
  error?: string;
  message?: string;
}

export function BatchGeneratePanel({
  pendingCount,
  onComplete,
}: BatchGeneratePanelProps) {
  const [generating, setGenerating] = useState(false);
  const [events, setEvents] = useState<BatchEvent[]>([]);
  const [currentDoc, setCurrentDoc] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ generated: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setEvents([]);
    setCurrentDoc(null);
    setProgress({ current: 0, total: 0 });
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/questions/generate-batch", { method: "POST" });
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
            const event: BatchEvent = JSON.parse(line.slice(6));

            if (event.type === "start") {
              setProgress({ current: 0, total: event.totalDocuments ?? 0 });
            }

            if (event.type === "progress") {
              setCurrentDoc(event.filename ?? null);
              setProgress((prev) => ({ ...prev, current: event.index ?? prev.current }));
            }

            if (event.type === "document_complete") {
              setEvents((prev) => [...prev, event]);
              setProgress((prev) => ({ ...prev, current: event.index ?? prev.current }));
            }

            if (event.type === "document_error") {
              setEvents((prev) => [...prev, event]);
            }

            if (event.type === "complete") {
              setResult({
                generated: event.generated ?? 0,
                failed: event.failed ?? 0,
                total: event.total ?? 0,
              });
              onComplete();
            }

            if (event.type === "error") {
              setError(event.message ?? "Error desconocido");
            }
          } catch {/* skip malformed */}
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action button */}
      {pendingCount > 0 && !result && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
            generating
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary-hover"
          )}
        >
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generando preguntas...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Generar preguntas para {pendingCount} documento{pendingCount !== 1 ? "s" : ""}</>
          )}
        </button>
      )}

      {/* Progress bar */}
      {generating && progress.total > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Procesando {progress.current} de {progress.total}
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
          {currentDoc && (
            <p className="text-xs text-muted-foreground truncate">
              <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
              {currentDoc}
            </p>
          )}
        </div>
      )}

      {/* Events log */}
      {events.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4 max-h-60 overflow-y-auto space-y-1.5">
          {events.map((evt, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              {evt.type === "document_complete" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <span className={evt.type === "document_complete" ? "text-foreground" : "text-destructive"}>
                  {evt.filename}
                </span>
                {evt.type === "document_complete" && evt.questionsGenerated && (
                  <span className="text-muted-foreground ml-1">— {evt.questionsGenerated} preguntas</span>
                )}
                {evt.type === "document_error" && (
                  <span className="text-destructive/70 ml-1">({evt.error})</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Result summary */}
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
              {result.generated} documento{result.generated !== 1 ? "s" : ""} procesado{result.generated !== 1 ? "s" : ""}
              {result.failed > 0 && `, ${result.failed} con error`}
            </p>
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
    </div>
  );
}
