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
  batchSize?: number;
  remaining?: number;
  generated?: number;
  failed?: number;
  error?: string;
  message?: string;
}

// Max consecutive stalls (no progress) before giving up
const MAX_STALLS = 3;
// Pause between auto-reconnections
const RECONNECT_DELAY_MS = 3000;

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
  const [reconnecting, setReconnecting] = useState(false);
  const [batchInfo, setBatchInfo] = useState<string | null>(null);

  const eventsRef = useRef<BatchEvent[]>([]);
  const originalTotalRef = useRef(0);

  /** Run one SSE connection. Returns events count produced in THIS connection. */
  async function runStream(): Promise<{ status: "complete" | "retry" | "error"; eventsThisRound: number; remaining: number }> {
    let eventsThisRound = 0;
    let remaining = 0;

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
              // On first start ever, capture the original total
              if (originalTotalRef.current === 0) {
                originalTotalRef.current = pendingCount || event.totalDocuments || 0;
                setProgress({ current: 0, total: originalTotalRef.current });
              }
              // Show batch info
              if (event.batchSize && event.totalDocuments) {
                setBatchInfo(`Lote de ${event.batchSize} de ${event.totalDocuments} pendientes`);
              }
            }

            if (event.type === "progress") {
              setCurrentDoc(event.filename ?? null);
            }

            if (event.type === "document_complete") {
              eventsThisRound++;
              eventsRef.current = [...eventsRef.current, event];
              setEvents([...eventsRef.current]);
              const completed = eventsRef.current.filter((e) => e.type === "document_complete").length;
              setProgress({ current: completed, total: originalTotalRef.current });
            }

            if (event.type === "document_error") {
              eventsThisRound++;
              eventsRef.current = [...eventsRef.current, event];
              setEvents([...eventsRef.current]);
              const processed = eventsRef.current.filter(
                (e) => e.type === "document_complete" || e.type === "document_error"
              ).length;
              setProgress({ current: processed, total: originalTotalRef.current });
            }

            if (event.type === "complete") {
              receivedComplete = true;
              remaining = event.remaining ?? 0;

              if (remaining === 0) {
                // All done!
                const totalCompleted = eventsRef.current.filter((e) => e.type === "document_complete").length;
                const totalFailed = eventsRef.current.filter((e) => e.type === "document_error").length;
                setResult({
                  generated: totalCompleted,
                  failed: totalFailed,
                  total: totalCompleted + totalFailed,
                });
                setProgress({ current: originalTotalRef.current, total: originalTotalRef.current });
                onComplete();
                return { status: "complete", eventsThisRound, remaining: 0 };
              }

              // More batches to go — return "retry" to auto-reconnect
              return { status: "retry", eventsThisRound, remaining };
            }

            if (event.type === "error") {
              setError(event.message ?? "Error desconocido");
              return { status: "error", eventsThisRound, remaining: 0 };
            }
          } catch {/* skip malformed */}
        }
      }

      // Stream ended without complete event — connection dropped
      if (!receivedComplete) {
        return { status: "retry", eventsThisRound, remaining: -1 };
      }

      return { status: "complete", eventsThisRound, remaining: 0 };
    } catch {
      return { status: "retry", eventsThisRound, remaining: -1 };
    }
  }

  async function runLoop() {
    let consecutiveStalls = 0;

    while (true) {
      const { status, eventsThisRound, remaining } = await runStream();

      if (status === "complete" || status === "error") return;

      // status === "retry" — check if we made progress
      if (eventsThisRound > 0) {
        consecutiveStalls = 0; // Reset — we made progress
      } else {
        consecutiveStalls++;
      }

      // Before retrying, check server for actual pending count
      try {
        const checkRes = await fetch("/api/questions/generate-batch");
        const checkData = await checkRes.json();
        if (checkData.pendingCount === 0) {
          // All done! Complete event was just lost
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
      } catch { /* continue */ }

      // Give up after MAX_STALLS consecutive connections with zero progress
      if (consecutiveStalls >= MAX_STALLS) {
        const completed = eventsRef.current.filter((e) => e.type === "document_complete").length;
        setError(
          `Sin progreso despues de ${MAX_STALLS} intentos consecutivos. ${completed} documentos procesados exitosamente. Puedes reiniciar para continuar con los pendientes.`
        );
        return;
      }

      // Auto-reconnect for next batch
      setReconnecting(true);
      setCurrentDoc(null);
      setBatchInfo(remaining > 0 ? `${remaining} documentos restantes...` : "Reconectando...");
      await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
      setReconnecting(false);
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
    setReconnecting(false);
    setBatchInfo(null);
    originalTotalRef.current = 0;

    await runLoop();
    setGenerating(false);
  };

  const handleRetryManual = async () => {
    setGenerating(true);
    setError(null);
    setReconnecting(false);
    setBatchInfo(null);

    await runLoop();
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
              {reconnecting
                ? "Conectando siguiente lote..."
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
          {reconnecting ? (
            <p className="text-xs text-info">
              <RefreshCw className="inline h-3 w-3 animate-spin mr-1" />
              {batchInfo || "Conectando siguiente lote..."}
            </p>
          ) : currentDoc ? (
            <p className="text-xs text-muted-foreground truncate">
              <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
              {currentDoc}
              {batchInfo && <span className="ml-2 text-muted-foreground/60">({batchInfo})</span>}
            </p>
          ) : null}
        </div>
      )}

      {/* Generating indicator without progress */}
      {generating && progress.total === 0 && !reconnecting && (
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
