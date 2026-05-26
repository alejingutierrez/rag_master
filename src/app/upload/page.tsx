"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  PageHeader,
  SectionHeader,
  primaryBtn,
  ghostBtn,
} from "@/components/editorial";

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

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if ([429, 502, 503, 504].includes(res.status)) {
        if (attempt < maxRetries) {
          await new Promise((r) =>
            setTimeout(r, RETRY_BASE_DELAY * 2 ** attempt + Math.random() * 1000),
          );
          continue;
        }
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise((r) =>
          setTimeout(r, RETRY_BASE_DELAY * 2 ** attempt + Math.random() * 1000),
        );
        continue;
      }
    }
  }
  throw lastError || new Error("Fetch failed after retries");
}

const PIPELINE_STEPS: { key: FileStatus; label: string }[] = [
  { key: "queued", label: "En cola" },
  { key: "hashing", label: "Hash SHA-256" },
  { key: "uploading", label: "Subir a S3" },
  { key: "processing", label: "Chunking" },
  { key: "embedding", label: "Embeddings" },
  { key: "success", label: "Listo" },
];

function pipelineStepIndex(s: FileStatus): number {
  const idx = PIPELINE_STEPS.findIndex((p) => p.key === s);
  return idx === -1 ? 0 : idx;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  const uploadSingle = async (state: FileUploadState) => {
    const { file, id } = state;
    if (abortRef.current) return;
    try {
      const sizeMB = file.size / 1024 / 1024;
      updateState(id, {
        status: "hashing",
        message:
          sizeMB > LARGE_FILE_MB
            ? `Archivo grande (${sizeMB.toFixed(1)} MB). Calculando hash, puede tardar 10-30s…`
            : "Calculando hash SHA-256…",
      });
      const fileHash = await computeFileHash(file);

      if (sessionHashesRef.current.has(fileHash)) {
        updateState(id, { status: "duplicate", message: "Duplicado en esta carga." });
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
            message: `Ya existe como "${checkData.existingFilename}".`,
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
              updateState(id, {
                status: "success",
                message: "Embeddings continuando en background",
                chunkCount,
              });
              return;
            }
            continue;
          }
          consecutiveErrors = 0;
          const progress = await progressRes.json();
          updateState(id, {
            message: `Generando embeddings: ${progress.processedChunks}/${progress.totalChunks}`,
            embeddingProgress: {
              processed: progress.processedChunks,
              total: progress.totalChunks,
            },
          });
          if (progress.status === "READY") break;
          if (progress.status === "ERROR") throw new Error("Error al generar embeddings");
        } catch (e) {
          if (e instanceof Error && e.message === "Error al generar embeddings") throw e;
          if (++consecutiveErrors >= 10) {
            updateState(id, {
              status: "success",
              message: "Embeddings continuando en background",
              chunkCount,
            });
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

  const ingestFiles = useCallback((rawFiles: File[]) => {
    const newFiles = rawFiles.filter((f) => f.type === "application/pdf");
    if (newFiles.length === 0) {
      toast.info("Sólo PDFs por ahora.");
      return;
    }
    const newStates: FileUploadState[] = newFiles.map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}-${Math.random()}`,
      file: f,
      status: "queued",
      message: "En cola",
    }));
    setStates((prev) => {
      const existing = new Set(prev.map((s) => `${s.file.name}|${s.file.size}`));
      const filtered = newStates.filter(
        (s) => !existing.has(`${s.file.name}|${s.file.size}`),
      );
      if (filtered.length < newStates.length) {
        toast.info(`${newStates.length - filtered.length} duplicados ignorados`);
      }
      return [...prev, ...filtered];
    });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    ingestFiles(Array.from(e.target.files));
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
    const pending = states.filter((s) => s.status === "queued" || s.status === "error");
    if (pending.length === 0) return;
    setIsProcessing(true);
    abortRef.current = false;
    const queue = [...pending];
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

  const pendingCount = states.filter(
    (s) => s.status === "queued" || s.status === "error",
  ).length;

  return (
    <div className="fade-up" data-screen-label="Upload">
      <PageHeader
        label="Repositorio"
        title="Cargar"
        italic="PDFs al corpus"
        subtitle="Arrastra tus PDFs. Cada archivo pasa por hash, S3, chunking y vectorización. Procesamiento concurrente: 2 archivos en paralelo."
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section style={{ padding: "44px 56px 0", maxWidth: 1100 }}>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleInputChange}
          style={{ display: "none" }}
        />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            padding: "80px 32px",
            border:
              "1px dashed " +
              (isDragOver ? "var(--accent)" : "var(--line-strong)"),
            background: isDragOver ? "var(--accent-soft)" : "transparent",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 160ms var(--ease-out-custom)",
          }}
        >
          <div
            className="display"
            style={{
              fontSize: 56,
              color: isDragOver ? "var(--accent)" : "var(--fg)",
              margin: 0,
              lineHeight: 1.0,
            }}
          >
            Arrastra{" "}
            <span className="display-italic" style={{ color: "var(--fg-muted)" }}>
              aquí.
            </span>
          </div>
          <div
            className="serif"
            style={{
              fontSize: 17,
              color: "var(--fg-muted)",
              marginTop: 14,
              fontStyle: "italic",
            }}
          >
            O haz clic para seleccionar archivos. Tamaño máximo: 100 MB por PDF.
          </div>
          <div style={{ marginTop: 28 }}>
            <button
              type="button"
              style={primaryBtn}
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Seleccionar archivos →
            </button>
          </div>
        </div>

        {/* Config strip */}
        <div
          style={{
            marginTop: 24,
            padding: "16px 0",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            borderTop: "1px solid var(--line)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          {[
            ["Chunk size", "2000 palabras"],
            ["Overlap", "500 palabras"],
            ["Estrategia", "FIXED · cross-page"],
            ["Embedding", "Cohere v4.0"],
          ].map(([l, v], i) => (
            <div
              key={i}
              style={{
                paddingLeft: i === 0 ? 0 : 24,
                borderLeft: i === 0 ? 0 : "1px solid var(--line)",
              }}
            >
              <div className="label" style={{ marginBottom: 4 }}>
                {l}
              </div>
              <div className="mono" style={{ fontSize: 12, color: "var(--fg)" }}>
                {v}
              </div>
            </div>
          ))}
        </div>
      </section>

      {states.length > 0 && (
        <section style={{ padding: "56px 56px 96px", maxWidth: 1100 }}>
          <SectionHeader
            index="01"
            title="Cola de procesamiento"
            caption={`${states.length} archivos · ${pendingCount} pendientes`}
            action={
              <div style={{ display: "flex", gap: 8 }}>
                {pendingCount > 0 && !isProcessing && (
                  <button type="button" style={primaryBtn} onClick={startUpload}>
                    Iniciar carga →
                  </button>
                )}
                {isProcessing && (
                  <button
                    type="button"
                    style={ghostBtn}
                    onClick={() => {
                      abortRef.current = true;
                    }}
                  >
                    Detener
                  </button>
                )}
                {!isProcessing && (
                  <button
                    type="button"
                    style={ghostBtn}
                    onClick={() => {
                      setStates([]);
                      sessionHashesRef.current.clear();
                    }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            }
          />
          {states.map((f) => (
            <UploadRow key={f.id} file={f} />
          ))}
        </section>
      )}
    </div>
  );
}

function UploadRow({ file }: { file: FileUploadState }) {
  const step = pipelineStepIndex(file.status);
  const isError = file.status === "error";
  const isDup = file.status === "duplicate";
  const labelColor = isError
    ? "var(--danger)"
    : file.status === "success"
      ? "var(--success)"
      : isDup
        ? "var(--fg-faint)"
        : "var(--accent)";
  const stepLabel = isError ? "Error" : isDup ? "Duplicado" : PIPELINE_STEPS[step].label;

  return (
    <div style={{ padding: "20px 0", borderBottom: "1px solid var(--line)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 14,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="serif" style={{ fontSize: 16, color: "var(--fg)" }}>
            {file.file.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 3 }}>
            {formatSize(file.file.size)} · {file.message}
          </div>
        </div>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: labelColor,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {stepLabel}
        </div>
      </div>

      {!isDup && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${PIPELINE_STEPS.length}, 1fr)`,
              gap: 4,
              marginBottom: 4,
            }}
          >
            {PIPELINE_STEPS.map((s, i) => (
              <div
                key={s.key}
                style={{
                  height: 2,
                  background: isError
                    ? i <= step
                      ? "var(--danger)"
                      : "var(--line)"
                    : i < step
                      ? "var(--success)"
                      : i === step
                        ? "var(--accent)"
                        : "var(--line)",
                  transition: "background 220ms var(--ease-out-custom)",
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${PIPELINE_STEPS.length}, 1fr)`,
              gap: 4,
            }}
          >
            {PIPELINE_STEPS.map((s, i) => (
              <div
                key={s.key}
                className="mono"
                style={{
                  fontSize: 10,
                  color: i <= step ? "var(--fg-muted)" : "var(--fg-faint)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {s.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
