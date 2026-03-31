"use client";

import { useState, useCallback } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { Dropzone } from "@/components/upload/dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
} from "lucide-react";

type FileStatus = "pending" | "uploading" | "processing" | "embedding" | "success" | "error";

interface FileUploadState {
  file: File;
  status: FileStatus;
  message: string;
  chunkCount?: number;
  embeddingProgress?: { processed: number; total: number };
}

const CHUNK_CONFIG = {
  chunkSize: 3000,
  chunkOverlap: 750,
  strategy: "FIXED",
} as const;

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStates, setUploadStates] = useState<FileUploadState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFilesSelect = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClear = useCallback(() => {
    setFiles([]);
    setUploadStates([]);
  }, []);

  const updateFileState = (
    index: number,
    update: Partial<FileUploadState>
  ) => {
    setUploadStates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...update };
      return next;
    });
  };

  const uploadSingleFile = async (
    file: File,
    index: number
  ): Promise<void> => {
    try {
      updateFileState(index, { status: "uploading", message: "Subiendo a S3..." });

      const presignRes = await fetch("/api/documents/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });

      if (!presignRes.ok) throw new Error("Error al obtener URL de subida");
      const { url, s3Key, s3Url } = await presignRes.json();

      const uploadRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Error al subir a S3");

      updateFileState(index, { status: "processing", message: "Parseando PDF y creando chunks..." });

      const processRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s3Key, s3Url, filename: file.name, fileSize: file.size,
          chunkSize: CHUNK_CONFIG.chunkSize, chunkOverlap: CHUNK_CONFIG.chunkOverlap, strategy: CHUNK_CONFIG.strategy,
        }),
      });

      if (!processRes.ok) {
        const error = await processRes.json();
        throw new Error(error.error || "Error al procesar");
      }

      const data = await processRes.json();
      const documentId = data.document.id;
      const chunkCount = data.document._count?.chunks ?? 0;

      // Disparar procesamiento server-side (continúa aunque cierre el navegador)
      await fetch(`/api/documents/${documentId}/process`, { method: "POST" });

      updateFileState(index, {
        status: "embedding", message: `Generando embeddings en servidor: 0/${chunkCount}`,
        chunkCount, embeddingProgress: { processed: 0, total: chunkCount },
      });

      // Polling ligero para mostrar progreso — si se cierra la pestaña,
      // el servidor sigue procesando igual
      while (true) {
        await new Promise((r) => setTimeout(r, 3000));

        try {
          const progressRes = await fetch(`/api/documents/${documentId}/process`);
          if (!progressRes.ok) continue;

          const progress = await progressRes.json();

          updateFileState(index, {
            message: `Generando embeddings en servidor: ${progress.processedChunks}/${progress.totalChunks}`,
            embeddingProgress: { processed: progress.processedChunks, total: progress.totalChunks },
          });

          if (progress.status === "READY") break;
          if (progress.status === "ERROR") throw new Error("Error al generar embeddings");
        } catch (e) {
          // Si el polling falla, el servidor sigue procesando — simplemente reintentar
          if (e instanceof Error && e.message === "Error al generar embeddings") throw e;
          continue;
        }
      }

      updateFileState(index, {
        status: "success", message: `${chunkCount} chunks con embeddings`,
        chunkCount, embeddingProgress: { processed: chunkCount, total: chunkCount },
      });
    } catch (error) {
      updateFileState(index, {
        status: "error", message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  };

  const handleUploadAll = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);

    const initialStates: FileUploadState[] = files.map((file) => ({
      file, status: "pending" as FileStatus, message: "En cola...",
    }));
    setUploadStates(initialStates);

    const CONCURRENCY = 4;
    const queue = [...files.map((f, i) => ({ file: f, index: i }))];

    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        await uploadSingleFile(item.file, item.index);
      }
    });

    await Promise.all(workers);
    setIsProcessing(false);
  };

  const successCount = uploadStates.filter((s) => s.status === "success").length;
  const errorCount = uploadStates.filter((s) => s.status === "error").length;
  const totalChunks = uploadStates.reduce((sum, s) => sum + (s.chunkCount || 0), 0);

  return (
    <PageContainer maxWidth="md">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Cargar PDFs</h2>
          <p className="text-muted-foreground mt-1">
            Sube documentos PDF para analizarlos y vectorizarlos.
          </p>
        </div>

        {!isProcessing && uploadStates.length === 0 && (
          <Dropzone
            onFilesSelect={handleFilesSelect}
            selectedFiles={files}
            onRemoveFile={handleRemoveFile}
            onClear={handleClear}
          />
        )}

        {uploadStates.length > 0 && (
          <div className="space-y-2">
            {!isProcessing && successCount > 0 && (
              <div className="rounded-lg border border-success/30 bg-success-muted p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <p className="text-sm text-success">
                    {successCount} de {uploadStates.length} archivos procesados correctamente.{" "}
                    {totalChunks} chunks totales creados.
                    {errorCount > 0 && (
                      <span className="text-destructive ml-2">{errorCount} con error.</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {uploadStates.map((state, i) => (
              <div
                key={`${state.file.name}-${i}`}
                className={`border rounded-lg px-4 py-3 flex items-center gap-3 ${
                  state.status === "success"
                    ? "bg-success-muted/50 border-success/20"
                    : state.status === "error"
                      ? "bg-destructive-muted/50 border-destructive/20"
                      : "bg-surface border-border"
                }`}
              >
                {state.status === "pending" && <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
                {(state.status === "uploading" || state.status === "processing" || state.status === "embedding") && (
                  <Loader2 className="h-5 w-5 text-info animate-spin flex-shrink-0" />
                )}
                {state.status === "success" && <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />}
                {state.status === "error" && <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{state.file.name}</p>
                  <p className={`text-xs ${
                    state.status === "success" ? "text-success"
                    : state.status === "error" ? "text-destructive"
                    : "text-muted-foreground"
                  }`}>
                    {state.message}
                  </p>
                  {state.status === "embedding" && state.embeddingProgress && (
                    <Progress
                      value={state.embeddingProgress.processed}
                      max={state.embeddingProgress.total}
                      variant="default"
                      className="mt-1.5"
                    />
                  )}
                </div>
              </div>
            ))}

            {!isProcessing && (
              <Button variant="outline" onClick={handleClear} className="w-full mt-2">
                Cargar mas documentos
              </Button>
            )}
          </div>
        )}

        {uploadStates.length === 0 && (
          <Button onClick={handleUploadAll} disabled={files.length === 0 || isProcessing} className="w-full" size="lg">
            {isProcessing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</>
            ) : (
              <><Upload className="h-4 w-4" /> Subir y Procesar {files.length > 0 ? `${files.length} PDF${files.length > 1 ? "s" : ""}` : "PDFs"}</>
            )}
          </Button>
        )}
      </div>
    </PageContainer>
  );
}
