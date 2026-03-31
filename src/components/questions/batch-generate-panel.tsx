"use client";

import { useState, useCallback } from "react";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface BatchGeneratePanelProps {
  pendingCount: number;
  onComplete: () => void;
}

// Polling interval to check progress
const POLL_INTERVAL_MS = 5000;

export function BatchGeneratePanel({
  pendingCount: initialPendingCount,
  onComplete,
}: BatchGeneratePanelProps) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({
    pending: initialPendingCount,
    completed: 0,
    total: 0,
  });
  const [result, setResult] = useState<{ generated: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollProgress = useCallback(async (originalPending: number): Promise<void> => {
    while (true) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      try {
        const res = await fetch("/api/questions/generate-batch");
        if (!res.ok) continue;

        const data = await res.json();
        const currentPending = data.pendingCount;
        const currentCompleted = data.completedCount;

        setProgress({
          pending: currentPending,
          completed: currentCompleted,
          total: data.totalReady,
        });

        // Si ya no quedan pendientes, terminamos
        if (currentPending === 0) {
          setResult({
            generated: currentCompleted,
            total: data.totalReady,
          });
          onComplete();
          return;
        }

        // Si no ha cambiado en mucho tiempo, el batch de 20 probablemente terminó
        // Disparar otro batch automáticamente
        // (El after() solo procesa 20 docs por invocación)
      } catch {
        // Si el polling falla, el servidor sigue procesando — simplemente reintentar
        continue;
      }
    }
  }, [onComplete]);

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);
    setError(null);

    try {
      // Disparar procesamiento server-side
      const res = await fetch("/api/questions/generate-batch", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al iniciar generación");
      }

      const data = await res.json();
      setProgress((prev) => ({ ...prev, pending: data.pendingCount }));

      // Polling ligero para mostrar progreso
      await pollProgress(data.pendingCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGenerating(false);
    }
  };

  const handleContinue = async () => {
    setGenerating(true);
    setError(null);

    try {
      // Disparar otro batch
      const res = await fetch("/api/questions/generate-batch", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al continuar");
      }

      await pollProgress(progress.pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGenerating(false);
    }
  };

  const pendingCount = generating ? progress.pending : initialPendingCount;
  const processedSoFar = initialPendingCount - progress.pending;
  const progressPct = initialPendingCount > 0
    ? Math.round(((initialPendingCount - progress.pending) / initialPendingCount) * 100)
    : 0;

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

      {/* Progress */}
      {generating && (
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Procesando en servidor — {processedSoFar > 0 ? `${processedSoFar} de ${initialPendingCount} completados` : "Iniciando..."}
            </span>
            <span className="text-foreground font-mono">{progressPct}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
            Generando con Claude Sonnet — continúa aunque cierre esta pestaña
          </p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={cn(
          "flex items-start gap-3 p-4 rounded-lg text-sm border",
          "bg-success-muted border-success/30 text-success"
        )}>
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Generación completada</p>
            <p className="text-xs mt-0.5 opacity-80">
              {result.generated} documento{result.generated !== 1 ? "s" : ""} con preguntas generadas
            </p>
          </div>
        </div>
      )}

      {/* Error with retry */}
      {error && (
        <div className="space-y-2">
          <div className="flex items-start gap-3 p-4 bg-destructive-muted border border-destructive/30 rounded-lg text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
          {!generating && (
            <button
              onClick={handleContinue}
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
