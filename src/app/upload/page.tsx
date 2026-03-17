"use client";

import { useState } from "react";
import { Dropzone } from "@/components/upload/dropzone";
import { ConfigForm, type ChunkConfig } from "@/components/upload/config-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";

type UploadStatus = "idle" | "uploading" | "success" | "error";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [config, setConfig] = useState<ChunkConfig>({
    chunkSize: 1024,
    chunkOverlap: 128,
    strategy: "FIXED",
  });
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");

  const handleUpload = async () => {
    if (!file) return;

    setStatus("uploading");
    setMessage("Subiendo y procesando PDF...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("chunkSize", config.chunkSize.toString());
      formData.append("chunkOverlap", config.chunkOverlap.toString());
      formData.append("strategy", config.strategy);

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al subir el documento");
      }

      const data = await response.json();
      setStatus("success");
      setMessage(
        `Documento "${data.document.filename}" subido correctamente. Se esta procesando en segundo plano.`
      );
      setFile(null);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Error al subir el documento"
      );
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Cargar PDF</h2>
        <p className="text-neutral-500 mt-1">
          Sube un documento PDF para analizarlo, chunkeizarlo y vectorizarlo.
        </p>
      </div>

      <Dropzone
        onFileSelect={setFile}
        selectedFile={file}
        onClear={() => {
          setFile(null);
          setStatus("idle");
          setMessage("");
        }}
      />

      <ConfigForm config={config} onChange={setConfig} />

      {status !== "idle" && (
        <Card
          className={
            status === "success"
              ? "border-green-200 bg-green-50"
              : status === "error"
                ? "border-red-200 bg-red-50"
                : ""
          }
        >
          <CardContent className="flex items-center gap-3 py-4">
            {status === "uploading" && (
              <Loader2 className="h-5 w-5 text-neutral-500 animate-spin" />
            )}
            {status === "success" && (
              <CheckCircle className="h-5 w-5 text-green-600" />
            )}
            {status === "error" && (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <p
              className={`text-sm ${
                status === "success"
                  ? "text-green-800"
                  : status === "error"
                    ? "text-red-800"
                    : "text-neutral-600"
              }`}
            >
              {message}
            </p>
          </CardContent>
        </Card>
      )}

      <Button
        onClick={handleUpload}
        disabled={!file || status === "uploading"}
        className="w-full"
        size="lg"
      >
        {status === "uploading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Procesando...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Subir y Procesar PDF
          </>
        )}
      </Button>
    </div>
  );
}
