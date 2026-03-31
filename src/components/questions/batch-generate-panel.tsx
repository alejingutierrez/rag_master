"use client";

import { useState, useRef } from "react";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, XCircle, RefreshCw } from "lucide-react";
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

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

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
  const [retryInfo, setRetryInfo] = useState<{ count: number; active: boolean }>({ count: 0, active: false });

  const eventsRef = useRef<BatchEvent[]>([]);
  // Track the original total to show accurate progress across retries
  const originalTotalRef = useRef(0);

  async function runStream(): Promise<"complete" | "retry" | "error"> {
    try {
      const response = await fetch("/api/questions/generate-batch", {
        method: "POST",
      });
      if (!response.body) throw new Error("No stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedComplete = false;

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          try {
            const event: BatchEvent = JSON.parse(line.slice(6));

            if (event.type === "start") {
              // On first start, set original total
              if (originalTotalRef.current === 0) {
                originalTotalRef.current = event.totalDocuments ?? 0;
                setProgress({ current: 0, total: originalTotalRef.current });
              }
              // On retry, total stays as original — current reflects real completions
            }

            if (event.type === "progress") {
              setCurrentDoc(event.filename ?? null);
            }

            // Only update progress on actual completions (not on progress events)
            if (event.type === "document_complete") {
              eventsRef.current = [...eventsRef.current, event];
              setEvents([...eventsRef.current]);
              const completed = eventsRef.current.filter((e) => e.type === "document_complete").length;
              setProgress({ current: completed, total: originalTotalRef.current });
            }

            if (event.type === "document_error") {
              eventsRef.current = [...eventsRef.current, event];
              setEvents([...eventsRef.current]);
              const processed = eventsRef.current.filter(
                (e) => e.type === "document_complete" || e.type === "document_error"
              ).length;
              setProgress({ current: processed, total: originalTotalRef.current });
            }

            if (event.type === "complete") {
              receivedComplete = true;
              const totalCompleted = eventsRef.current.filter((e) => e.type === "document_complete").length;
              const totalFailed = eventsRef.current.filter((e) => e.type === "document_error").length;

              setResult({
                generated: totalCompleted,
                failed: totalFailed,
                total: totalCompleted + totalFailed,
              });
              onComplete();
              return "complete";
            }

            if (event.type === "error") {
              setError(event.message ?? "Error desconocido");
              return "error";
            }
          } catch {/* skip malformed */}
        }
      }

      // Stream ended without complete — likely timeout, should retry
      if (!receivedComplete) {
        return "retry";
      }

      return "complete";
    } catch {
      return "retry";
    }
  }

  async function runWithRetry() {
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      const streamResult = await runStream();

      if (streamResult === "complete" || streamResult === "error") return;

      attempt++;

      // Check if any docs are still pending before retrying
      try {
        const checkRes = await fetch("/api/questions/generate-batch");
        const checkData = await checkRes.json();
        if (checkData.pendingCount === 0) {
          // All done! The complete event was just lost
          const totalCompleted = eventsRef.current.filter((e) => e.type === "document_complete").length;
          const totalFailed = eventsRef.current.filter((e) => e.type === "document_error").length;
          setResult({
            generated: totalCompleted,
            failed: totalFailed,
            total: totalCompleted + totalFailed,
          });
          setProgress({ current: originalTotalRef.current, total: originalTotalRef.current });
          onComplete();
          return;
        }
      } catch { /* continue with retry */ }

      if (attempt > MAX_RETRIES) {
        const completed = eventsRef.current.filter((e) => e.type === "document_complete").length;
        setError(
          `Conexion perdida despues de ${MAX_RETRIES} reintentos. ${completed} documentos procesados exitosamente. Puedes reiniciar para continuar con los pendientes.`
        );
        return;
      }

      setRetryInfo({ count: attempt, active: true });
      setError(null);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      setRetryInfo({ count: attempt, active: false });
    }
  }

  const handleGenerate = async () => {
    setGenerating(true);
    setEvents([]);
    eventsRef.current = [];
    setCurrentDoc(null);
    setProgress({ current: 0, total: 0 });
    setResult(null);
    setError(null);
    setRetryInfo({ count: 0, active: false });
    originalTotalRef.current = 0;

    await runWithRetry();
    setGenerating(false);
  };

  const handleRetryManual = async () => {
    setGenerating(true);
    setError(null);
    setRetryInfo({ count: 0, active: false });

    await runWithRetry();
    setGenerating(false);
  };

  const completedCount = events.filter((e) => e.type === "document_complete").length;
  const failedCount = events.filter((e) => e.type === "document_error").length;

  return (
    <div className="space-y-4">
      {/* Action button */}
      {pendingCount > 0 && !result && !generating && !error && (
        <button
          onClick={handleGenerate}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          <Sparkles className="h-4 w-4" /> Generar preguntas para {pendingCount} documento{pendingCount !== 1 ? "s" : ""}
        </button>
      )}

      {/* Progress bar */}
      {generating && progress.total > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {retryInfo.active
                ? "Reconectando..."
                : `${completedCount} completado${completedCount !== 1 ? "s" : ""} de ${progress.total}${failedCount > 0 ? ` (${failedCount} con error)` : ""}`}
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
          ) : currentDoc ? (
            <p className="text-xs text-muted-foreground truncate">
              <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
              {currentDoc}
            </p>
          ) : null}
        </div>
      )}

      {/* Generating indicator without progress */}
      {generating && progress.total === 0 && !retryInfo.active && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Iniciando generacion...
          </p>
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

      {/* Error with manual retry */}
      {error && (
        <div className="space-y-2">
          <div className="flex items-start gap-3 p-4 bg-destructive-muted border border-destructive/30 rounded-lg text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{error}</p>
            </div>
          </div>
          {!generating && (
            <button
              onClick={handleRetryManual}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Continuar con pendientes
            </button>
          )}
        </div>
      )}
    </div>
  );
}
