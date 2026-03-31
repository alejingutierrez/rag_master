"use client";

import { useState, useRef } from "react";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, XCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface BatchEnrichPanelProps {
  totalDocuments: number;
  enrichedCount: number;
  pendingCount: number;
  onComplete: () => void;
}

interface BatchEvent {
  type: string;
  documentId?: string;
  filename?: string;
  bookTitle?: string;
  author?: string;
  index?: number;
  total?: number;
  totalDocuments?: number;
  enriched?: number;
  failed?: number;
  error?: string;
  message?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

export function BatchEnrichPanel({
  totalDocuments,
  enrichedCount,
  pendingCount,
  onComplete,
}: BatchEnrichPanelProps) {
  const [enriching, setEnriching] = useState(false);
  const [events, setEvents] = useState<BatchEvent[]>([]);
  const [currentDoc, setCurrentDoc] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ enriched: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryInfo, setRetryInfo] = useState<{ count: number; active: boolean }>({ count: 0, active: false });

  // Refs para valores mutables dentro del stream async (evitar closures obsoletos)
  const eventsRef = useRef<BatchEvent[]>([]);
  const totalProcessedRef = useRef(0);

  async function runStream(isRetry: boolean): Promise<"complete" | "retry" | "error"> {
    const controller = new AbortController();

    try {
      const response = await fetch("/api/documents/enrich-batch", {
        method: "POST",
        signal: controller.signal,
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
              if (!isRetry) {
                setProgress({ current: 0, total: event.total ?? event.totalDocuments ?? 0 });
              } else {
                setProgress((prev) => ({
                  current: prev.current,
                  total: prev.current + (event.totalDocuments ?? 0),
                }));
              }
            }

            if (event.type === "progress") {
              setCurrentDoc(event.filename ?? null);
              if (isRetry) {
                setProgress((prev) => ({
                  ...prev,
                  current: totalProcessedRef.current + (event.index ?? 0),
                }));
              } else {
                setProgress((prev) => ({ ...prev, current: event.index ?? prev.current }));
              }
            }

            if (event.type === "document_complete") {
              eventsRef.current = [...eventsRef.current, event];
              setEvents(eventsRef.current);
              totalProcessedRef.current++;
              if (isRetry) {
                setProgress((prev) => ({ ...prev, current: totalProcessedRef.current }));
              } else {
                setProgress((prev) => ({ ...prev, current: event.index ?? prev.current }));
                totalProcessedRef.current = event.index ?? totalProcessedRef.current;
              }
            }

            if (event.type === "document_error") {
              eventsRef.current = [...eventsRef.current, event];
              setEvents(eventsRef.current);
              totalProcessedRef.current++;
            }

            if (event.type === "complete") {
              receivedComplete = true;
              const prevCompleted = eventsRef.current.filter((e) => e.type === "document_complete").length;
              const prevFailed = eventsRef.current.filter((e) => e.type === "document_error").length;
              // En el ultimo segmento el server reporta sus propios counts
              // Pero los acumulados son mas precisos
              const totalEnriched = isRetry ? prevCompleted : (event.enriched ?? 0);
              const totalFailed = isRetry ? prevFailed : (event.failed ?? 0);

              setResult({
                enriched: totalEnriched,
                failed: totalFailed,
                total: totalEnriched + totalFailed,
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

      if (!receivedComplete && !controller.signal.aborted) {
        return "retry";
      }

      return "complete";
    } catch {
      if (controller.signal.aborted) return "complete";
      return "retry";
    }
  }

  async function runWithRetry(isRetry: boolean) {
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      const result = await runStream(attempt > 0 || isRetry);

      if (result === "complete" || result === "error") return;

      // Conexion cortada — reintentar
      attempt++;
      if (attempt > MAX_RETRIES) {
        setError(
          `Conexion perdida despues de ${MAX_RETRIES} reintentos. Los documentos ya enriquecidos se guardaron. Puedes reiniciar para continuar con los pendientes.`
        );
        return;
      }

      setRetryInfo({ count: attempt, active: true });
      setError(null);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      setRetryInfo({ count: attempt, active: false });
    }
  }

  const handleEnrich = async () => {
    setEnriching(true);
    setEvents([]);
    eventsRef.current = [];
    setCurrentDoc(null);
    setProgress({ current: 0, total: 0 });
    setResult(null);
    setError(null);
    setRetryInfo({ count: 0, active: false });
    totalProcessedRef.current = 0;

    await runWithRetry(false);
    setEnriching(false);
  };

  const handleRetryManual = async () => {
    setEnriching(true);
    setError(null);
    setRetryInfo({ count: 0, active: false });

    await runWithRetry(true);
    setEnriching(false);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-foreground font-mono">{totalDocuments}</p>
          <p className="text-xs text-muted-foreground mt-1">Total documentos</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-success font-mono">{enrichedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Enriquecidos</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-warning font-mono">{pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Pendientes</p>
        </div>
      </div>

      {/* Action button */}
      {pendingCount > 0 && !result && !enriching && !error && (
        <button
          onClick={handleEnrich}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          <Sparkles className="h-4 w-4" /> Enriquecer {pendingCount} documento{pendingCount !== 1 ? "s" : ""} faltante{pendingCount !== 1 ? "s" : ""}
        </button>
      )}

      {/* Progress bar */}
      {enriching && progress.total > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {retryInfo.active ? "Reconectando..." : `Procesando ${progress.current} de ${progress.total}`}
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

      {/* Enriching indicator without progress */}
      {enriching && progress.total === 0 && !retryInfo.active && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Iniciando enriquecimiento...
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
                  {evt.bookTitle || evt.filename}
                </span>
                {evt.type === "document_complete" && evt.author && (
                  <span className="text-muted-foreground ml-1">— {evt.author}</span>
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
            <p className="font-medium">Enriquecimiento completado</p>
            <p className="text-xs mt-0.5 opacity-80">
              {result.enriched} enriquecido{result.enriched !== 1 ? "s" : ""}
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
              {events.length > 0 && (
                <p className="text-xs mt-1 opacity-70">
                  {events.filter((e) => e.type === "document_complete").length} documento(s) enriquecidos antes del error
                </p>
              )}
            </div>
          </div>
          {!enriching && (
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
