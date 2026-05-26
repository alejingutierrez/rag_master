"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  FileText,
  Inbox,
  UploadCloud,
  Network,
  FlaskConical,
  CheckCircle,
  XCircle,
  Copy,
  Loader2,
  RotateCw,
  Eraser,
  Eye,
  X,
  AlertCircle,
} from "lucide-react";
import { Badge, Button, Card, IconButton } from "@/components/ui";
import { cn } from "@/lib/cn";

type FileStatus =
  | "queued"
  | "hashing"
  | "uploading"
  | "processing"
  | "embedding"
  | "success"
  | "error"
  | "duplicate";

interface FileUploadState {
  id: string;
  file: File;
  status: FileStatus;
  message: string;
  chunkCount?: number;
  embeddingProgress?: { processed: number; total: number };
  documentId?: string;
}

const LARGE_FILE_MB = 50;

// Unidad: PALABRAS (chunking cross-page por palabras desde 2026-05-25)
const CHUNK_CONFIG = {
  chunkSize: 2000,
  chunkOverlap: 500,
  strategy: "FIXED" as const,
};

const CONCURRENCY = 2;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 2000;
const POLLING_INTERVAL = 4000;
const POLLING_TIMEOUT = 20 * 60 * 1000;

async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY * 2 ** attempt + Math.random() * 1000));
          continue;
        }
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY * 2 ** attempt + Math.random() * 1000));
        continue;
      }
    }
  }
  throw lastError || new Error("Fetch failed after retries");
}

const PIPELINE_STEPS = [
  { key: "queued", title: "En cola", Icon: FileText },
  { key: "hashing", title: "Hash SHA-256", Icon: Copy },
  { key: "uploading", title: "Subir a S3", Icon: UploadCloud },
  { key: "processing", title: "Chunking", Icon: Network },
  { key: "embedding", title: "Embeddings", Icon: FlaskConical },
  { key: "success", title: "Listo", Icon: CheckCircle },
];

function pipelineStepIndex(s: FileStatus): number {
  const idx = PIPELINE_STEPS.findIndex((p) => p.key === s);
  return idx === -1 ? 0 : idx;
}

export default function UploadPage() {
  const [states, setStates] = useState<FileUploadState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);
  const sessionHashesRef = useRef<Set<string>>(new Set());

  const updateState = (id: string, update: Partial<FileUploadState>) => {
    setStates((prev) => prev.map((s) => (s.id === id ? { ...s, ...update } : s)));
  };

  const removeState = (id: string) => {
    setStates((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClear = useCallback(() => {
    setStates([]);
    abortRef.current = false;
    sessionHashesRef.current.clear();
  }, []);

  const uploadSingle = async (state: FileUploadState) => {
    const { file, id } = state;
    if (abortRef.current) return;
    try {
      const sizeMB = file.size / 1024 / 1024;
      if (sizeMB > LARGE_FILE_MB) {
        updateState(id, {
          status: "hashing",
          message: `Archivo grande (${sizeMB.toFixed(1)} MB). Calculando hash, puede tardar 10‑30s…`,
        });
      } else {
        updateState(id, { status: "hashing", message: "Calculando hash SHA-256…" });
      }
      const fileHash = await computeFileHash(file);

      if (sessionHashesRef.current.has(fileHash)) {
        updateState(id, { status: "duplicate", message: "Duplicado en esta carga (mismo contenido)." });
        return;
      }

      const checkRes = await fetchWithRetry("/api/documents/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileHash, filename: file.name }),
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.isDuplicate) {
          updateState(id, {
            status: "duplicate",
            message: `Ya existe en el sistema como "${checkData.existingFilename}".`,
          });
          return;
        }
      }
      sessionHashesRef.current.add(fileHash);

      updateState(id, { status: "uploading", message: "Obteniendo URL de subida…" });
      const presignRes = await fetchWithRetry("/api/documents/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!presignRes.ok) throw new Error("Error al obtener URL de subida");
      const { url, s3Key, s3Url } = await presignRes.json();

      updateState(id, { message: "Subiendo a S3…" });
      const uploadRes = await fetchWithRetry(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(`Error al subir a S3 (${uploadRes.status})`);

      updateState(id, { status: "processing", message: "Parseando PDF y creando chunks…" });
      const processRes = await fetchWithRetry("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s3Key,
          s3Url,
          filename: file.name,
          fileSize: file.size,
          fileHash,
          ...CHUNK_CONFIG,
        }),
      });
      if (!processRes.ok) {
        const err = await processRes.json().catch(() => ({ error: `HTTP ${processRes.status}` }));
        throw new Error(err.error || "Error al procesar");
      }
      const data = await processRes.json();
      const documentId = data.document.id;
      const chunkCount = data.document._count?.chunks ?? 0;
      updateState(id, { documentId });

      await fetchWithRetry(`/api/documents/${documentId}/process`, { method: "POST" });

      updateState(id, {
        status: "embedding",
        message: `Generando embeddings: 0/${chunkCount}`,
        chunkCount,
        embeddingProgress: { processed: 0, total: chunkCount },
      });

      const pollingStart = Date.now();
      let consecutiveErrors = 0;
      while (!abortRef.current) {
        await new Promise((r) => setTimeout(r, POLLING_INTERVAL));
        if (Date.now() - pollingStart > POLLING_TIMEOUT) {
          updateState(id, {
            status: "success",
            message: `${chunkCount} chunks — embeddings continuando en servidor`,
            chunkCount,
          });
          return;
        }
        try {
          const progressRes = await fetch(`/api/documents/${documentId}/process`);
          if (!progressRes.ok) {
            if (++consecutiveErrors >= 10) {
              updateState(id, { status: "success", message: "Embeddings continuando en background", chunkCount });
              return;
            }
            continue;
          }
          consecutiveErrors = 0;
          const progress = await progressRes.json();
          updateState(id, {
            message: `Generando embeddings: ${progress.processedChunks}/${progress.totalChunks}`,
            embeddingProgress: { processed: progress.processedChunks, total: progress.totalChunks },
          });
          if (progress.status === "READY") break;
          if (progress.status === "ERROR") throw new Error("Error al generar embeddings");
        } catch (e) {
          if (e instanceof Error && e.message === "Error al generar embeddings") throw e;
          if (++consecutiveErrors >= 10) {
            updateState(id, { status: "success", message: "Embeddings continuando en background", chunkCount });
            return;
          }
        }
      }

      updateState(id, {
        status: "success",
        message: `${chunkCount} chunks con embeddings`,
        chunkCount,
        embeddingProgress: { processed: chunkCount, total: chunkCount },
      });
    } catch (err) {
      updateState(id, {
        status: "error",
        message: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  };

  // Acepta File[] (de input change o drop) y crea estados deduplicados
  const ingestFiles = useCallback((rawFiles: File[]) => {
    const newFiles = rawFiles.filter((f) => f.type === "application/pdf");
    if (newFiles.length === 0) return;
    const newStates: FileUploadState[] = newFiles.map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}-${Math.random()}`,
      file: f,
      status: "queued",
      message: "En cola",
    }));
    setStates((prev) => {
      const existing = new Set(prev.map((s) => `${s.file.name}|${s.file.size}`));
      const filtered = newStates.filter((s) => !existing.has(`${s.file.name}|${s.file.size}`));
      if (filtered.length < newStates.length) {
        toast.info(`${newStates.length - filtered.length} duplicados ya en la lista`);
      }
      return [...prev, ...filtered];
    });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    ingestFiles(Array.from(e.target.files));
    // reset input para permitir reseleccionar el mismo archivo
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isProcessing) return;
    if (!e.dataTransfer.files) return;
    ingestFiles(Array.from(e.dataTransfer.files));
  };

  const startUpload = async () => {
    const pendingStates = states.filter((s) => s.status === "queued" || s.status === "error");
    if (pendingStates.length === 0) return;
    setIsProcessing(true);
    abortRef.current = false;
    const queue = [...pendingStates];
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0 && !abortRef.current) {
        const item = queue.shift();
        if (!item) break;
        await uploadSingle(item);
      }
    });
    await Promise.all(workers);
    setIsProcessing(false);
  };

  const successCount = states.filter((s) => s.status === "success").length;
  const errorCount = states.filter((s) => s.status === "error").length;
  const dupCount = states.filter((s) => s.status === "duplicate").length;
  const totalChunks = states.reduce((s, x) => s + (x.chunkCount ?? 0), 0);
  const pendingCount = states.filter((s) => s.status === "queued" || s.status === "error").length;

  return (
    <div className="app-page-narrow">
      <div className="mb-6">
        <h2 className="serif-title text-[28px] leading-tight text-[var(--color-ink-1000)] m-0" style={{ fontWeight: 700 }}>
          Cargar PDFs
        </h2>
        <p className="text-[15px] leading-relaxed text-[var(--fg-muted)] mt-1.5 mb-0">
          Sube fuentes históricas. El sistema calcula el hash para evitar duplicados, las divide en chunks de 3000 caracteres con overlap de 750, y genera embeddings con Cohere Embed v4.
        </p>
      </div>

      <Card variant="default" size="md" className="mb-5">
        <div
          onClick={() => !isProcessing && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isProcessing) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "rounded-lg border-2 border-dashed py-10 px-6 text-center transition-colors duration-[var(--duration-instant)]",
            isProcessing ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            isDragOver
              ? "border-[var(--accent)] bg-[var(--accent-bg-subtle)]"
              : "border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]",
          )}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !isProcessing) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleInputChange}
            disabled={isProcessing}
          />
          <div className="flex flex-col items-center gap-3">
            <Inbox className="size-12 text-[var(--accent)]" />
            <p className="text-[16px] font-medium text-[var(--fg-default)]">
              Arrastra PDFs aquí o haz click para seleccionar
            </p>
            <p className="text-[13px] text-[var(--fg-subtle)]">
              Soporta múltiples archivos. El procesamiento es paralelo (concurrencia {CONCURRENCY}).
            </p>
          </div>
        </div>
      </Card>

      {states.length > 0 && (
        <>
          <Card variant="default" size="md" className="mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBlock label="En cola" value={pendingCount} />
              <StatBlock label="Listos" value={successCount} colorVar="--color-success-fg" />
              <StatBlock label="Duplicados" value={dupCount} colorVar="--color-warning-fg" />
              <StatBlock label="Chunks totales" value={totalChunks} />
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="primary"
                size="md"
                onClick={startUpload}
                disabled={isProcessing || pendingCount === 0}
                leadingIcon={
                  isProcessing ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />
                }
              >
                {isProcessing
                  ? "Procesando…"
                  : `Subir y procesar ${pendingCount} archivo${pendingCount !== 1 ? "s" : ""}`}
              </Button>
              {isProcessing && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => (abortRef.current = true)}
                  leadingIcon={<XCircle className="size-4" />}
                >
                  Detener
                </Button>
              )}
              {!isProcessing && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleClear}
                  leadingIcon={<Eraser className="size-4" />}
                >
                  Limpiar
                </Button>
              )}
            </div>
          </Card>

          {successCount > 0 && !isProcessing && errorCount === 0 && (
            <div className="mb-4 p-4 rounded-lg border border-[var(--color-success-fg)]/40 bg-[var(--color-success-bg)] flex items-start gap-3">
              <CheckCircle className="size-4 text-[var(--color-success-fg)] mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--color-success-fg)]">
                  {successCount} archivo{successCount !== 1 ? "s" : ""} procesado{successCount !== 1 ? "s" : ""}
                </div>
                <div className="text-sm text-[var(--color-success-fg)]/80 mt-0.5">
                  {totalChunks} chunks creados y vectorizados. Ya puedes consultarlos en /chat o generar preguntas.
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {states.map((s) => (
              <FileRow
                key={s.id}
                state={s}
                onRemove={() => removeState(s.id)}
                onRetry={() => uploadSingle(s)}
                disabled={isProcessing}
              />
            ))}
          </div>
        </>
      )}

      {states.length === 0 && (
        <Card variant="default" size="md">
          <div className="py-10 text-center">
            <Inbox className="size-10 text-[var(--fg-disabled)] mx-auto mb-3" />
            <div className="text-[13px] text-[var(--fg-subtle)]">
              Arrastra archivos arriba para comenzar
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatBlock({
  label,
  value,
  colorVar,
}: {
  label: string;
  value: number;
  colorVar?: string;
}) {
  return (
    <div>
      <div className="text-[12px] text-[var(--fg-subtle)]">{label}</div>
      <div
        className="text-[22px] font-semibold tabular-nums mt-0.5"
        style={colorVar ? { color: `var(${colorVar})` } : { color: "var(--fg-default)" }}
      >
        {value.toLocaleString("es-CO")}
      </div>
    </div>
  );
}

function FileRow({
  state,
  onRemove,
  onRetry,
  disabled,
}: {
  state: FileUploadState;
  onRemove: () => void;
  onRetry: () => void;
  disabled: boolean;
}) {
  const stepIdx = pipelineStepIndex(state.status);
  const isError = state.status === "error";
  const isDup = state.status === "duplicate";
  const isSuccess = state.status === "success";
  const isWorking = ["hashing", "uploading", "processing", "embedding"].includes(state.status);

  const statusColorVar = isError
    ? "--color-danger-fg"
    : isDup
    ? "--color-warning-fg"
    : isSuccess
    ? "--color-success-fg"
    : "--accent";

  return (
    <Card
      variant="default"
      size="sm"
      style={{
        borderLeft: `3px solid var(${statusColorVar})`,
      }}
    >
      <div className="flex flex-col gap-1.5 w-full">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="size-4 shrink-0" style={{ color: `var(${statusColorVar})` }} />
            <span className="text-[13px] font-semibold text-[var(--fg-default)] truncate">
              {state.file.name}
            </span>
            <span className="text-[11px] text-[var(--fg-subtle)] shrink-0">
              {(state.file.size / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {state.chunkCount !== undefined && (
              <Badge variant="subtle" size="xs">
                {state.chunkCount.toLocaleString("es")} chunks
              </Badge>
            )}
            {isSuccess && state.documentId && (
              <Link href={`/documents/${state.documentId}`}>
                <Button variant="link" size="sm" leadingIcon={<Eye className="size-3.5" />}>
                  Abrir
                </Button>
              </Link>
            )}
            {isError && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onRetry}
                disabled={disabled}
                leadingIcon={<RotateCw className="size-3.5" />}
              >
                Reintentar
              </Button>
            )}
            {!isWorking && (
              <IconButton aria-label="Eliminar" size="sm" variant="ghost" onClick={onRemove}>
                <X className="size-3.5" />
              </IconButton>
            )}
          </div>
        </div>

        <div
          className="text-[12px] flex items-center gap-1.5"
          style={{ color: `var(${statusColorVar})` }}
        >
          {isWorking && <Loader2 className="size-3 animate-spin" />}
          <span>{state.message}</span>
        </div>

        {state.status === "embedding" && state.embeddingProgress && (
          <div className="h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${Math.round(
                  (state.embeddingProgress.processed / Math.max(1, state.embeddingProgress.total)) * 100,
                )}%`,
                background: "var(--accent)",
              }}
            />
          </div>
        )}

        {!isError && !isDup && (
          <PipelineSteps current={stepIdx} isWorking={isWorking} isSuccess={isSuccess} />
        )}
      </div>
    </Card>
  );
}

function PipelineSteps({
  current,
  isWorking,
  isSuccess,
}: {
  current: number;
  isWorking: boolean;
  isSuccess: boolean;
}) {
  return (
    <div className="flex items-center gap-1 mt-2 overflow-x-auto">
      {PIPELINE_STEPS.map((step, i) => {
        const Icon = step.Icon;
        const stateKind =
          isSuccess && i <= current
            ? "finish"
            : i < current
            ? "finish"
            : i === current
            ? isWorking
              ? "process"
              : isSuccess
              ? "finish"
              : "wait"
            : "wait";

        const color =
          stateKind === "finish"
            ? "var(--color-success-fg)"
            : stateKind === "process"
            ? "var(--accent)"
            : "var(--fg-disabled)";

        return (
          <div key={step.key} className="flex items-center gap-1 shrink-0">
            <div
              className={cn(
                "size-5 rounded-full flex items-center justify-center border",
                stateKind === "process" && "animate-pulse",
              )}
              style={{
                borderColor: color,
                color,
                background:
                  stateKind === "finish"
                    ? "color-mix(in oklab, var(--color-success-fg) 12%, transparent)"
                    : stateKind === "process"
                    ? "color-mix(in oklab, var(--accent) 12%, transparent)"
                    : "transparent",
              }}
            >
              <Icon className="size-2.5" />
            </div>
            <span
              className="text-[10.5px] font-mono uppercase tracking-wider"
              style={{ color }}
            >
              {step.title}
            </span>
            {i < PIPELINE_STEPS.length - 1 && (
              <div
                className="w-3 h-px mx-0.5"
                style={{
                  background:
                    i < current || (isSuccess && i <= current)
                      ? "var(--color-success-fg)"
                      : "var(--border-default)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
