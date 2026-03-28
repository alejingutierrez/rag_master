"use client";

import { useState, useCallback } from "react";
import { Dropzone } from "@/components/upload/dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
} from "lucide-react";

type FileStatus = "pending" | "uploading" | "processing" | "success" | "error";

interface FileUploadState {
  file: File;
  status: FileStatus;
  message: string;
  chunkCount?: number;
}

// Valores fijos de chunking — optimizados para contexto rico
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

      // 1. Obtener presigned URL
      const presignRes = await fetch("/api/documents/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });

      if (!presignRes.ok) throw new Error("Error al obtener URL de subida");
      const { url, s3Key, s3Url } = await presignRes.json();

      // 2. Subir a S3
      const uploadRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Error al subir a S3");

      // 3. Procesar documento
      updateFileState(index, {
        status: "processing",
        message: "Procesando y generando embeddings...",
      });

      const processRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s3Key,
          s3Url,
          filename: file.name,
          fileSize: file.size,
          chunkSize: CHUNK_CONFIG.chunkSize,
          chunkOverlap: CHUNK_CONFIG.chunkOverlap,
          strategy: CHUNK_CONFIG.strategy,
        }),
      });

      if (!processRes.ok) {
        const error = await processRes.json();
        throw new Error(error.error || "Error al procesar");
      }

      const data = await processRes.json();
      const chunkCount = data.document._count?.chunks ?? 0;

      updateFileState(index, {
        status: "success",
        message: `${chunkCount} chunks creados`,
        chunkCount,
      });
    } catch (error) {
      updateFileState(index, {
        status: "error",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  };

  const handleUploadAll = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);

    // Inicializar estados
    const initialStates: FileUploadState[] = files.map((file) => ({
      file,
      status: "pending" as FileStatus,
      message: "En cola...",
    }));
    setUploadStates(initialStates);

    // Procesar de a 2 en paralelo (evita throttling de Bedrock embeddings)
    const CONCURRENCY = 2;
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
  const totalChunks = uploadStates.reduce(
    (sum, s) => sum + (s.chunkCount || 0),
    0
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Cargar PDFs</h2>
        <p className="text-neutral-500 mt-1">
          Sube documentos PDF para analizarlos y vectorizarlos. Se dividen en fragmentos de 6000 caracteres con solapamiento de 1000 para maximo contexto.
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

      {/* Progreso de procesamiento */}
      {uploadStates.length > 0 && (
        <div className="space-y-2">
          {/* Resumen */}
          {!isProcessing && successCount > 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="text-sm text-green-800">
                    {successCount} de {uploadStates.length} archivos procesados correctamente.{" "}
                    {totalChunks} chunks totales creados.
                    {errorCount > 0 && (
                      <span className="text-red-600 ml-2">
                        {errorCount} con error.
                      </span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progreso individual */}
          {uploadStates.map((state, i) => (
            <div
              key={`${state.file.name}-${i}`}
              className={`border rounded-lg px-4 py-3 flex items-center gap-3 ${
                state.status === "success"
                  ? "bg-green-50 border-green-200"
                  : state.status === "error"
                    ? "bg-red-50 border-red-200"
                    : "bg-white"
              }`}
            >
              {state.status === "pending" && (
                <FileText className="h-5 w-5 text-neutral-400 flex-shrink-0" />
              )}
              {(state.status === "uploading" ||
                state.status === "processing") && (
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin flex-shrink-0" />
              )}
              {state.status === "success" && (
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              )}
              {state.status === "error" && (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-900 truncate">
                  {state.file.name}
                </p>
                <p
                  className={`text-xs ${
                    state.status === "success"
                      ? "text-green-600"
                      : state.status === "error"
                        ? "text-red-600"
                        : "text-neutral-500"
                  }`}
                >
                  {state.message}
                </p>
              </div>
            </div>
          ))}

          {/* Botón para nueva carga */}
          {!isProcessing && (
            <Button
              variant="outline"
              onClick={() => {
                setFiles([]);
                setUploadStates([]);
              }}
              className="w-full mt-2"
            >
              Cargar mas documentos
            </Button>
          )}
        </div>
      )}

      {/* Botón principal */}
      {uploadStates.length === 0 && (
        <Button
          onClick={handleUploadAll}
          disabled={files.length === 0 || isProcessing}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Subir y Procesar {files.length > 0 ? `${files.length} PDF${files.length > 1 ? "s" : ""}` : "PDFs"}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
