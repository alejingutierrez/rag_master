"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChunkViewer } from "@/components/documents/chunk-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, formatDate } from "@/lib/utils";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";

interface DocumentDetail {
  id: string;
  filename: string;
  s3Url: string;
  fileSize: number;
  pageCount: number;
  status: string;
  metadata: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
  chunks: Array<{
    id: string;
    content: string;
    pageNumber: number;
    chunkIndex: number;
    chunkSize: number;
    overlap: number;
    strategy: string;
    metadata: Record<string, unknown>;
  }>;
}

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  PROCESSING: "Procesando",
  READY: "Listo",
  ERROR: "Error",
};

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);

  useEffect(() => {
    async function fetchDocument() {
      try {
        const response = await fetch(`/api/documents/${id}`);
        const data = await response.json();
        setDocument(data.document);
      } catch (error) {
        console.error("Error fetching document:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDocument();
  }, [id]);

  // Auto-refresh si está procesando
  useEffect(() => {
    if (document?.status !== "PROCESSING") return;
    const interval = setInterval(async () => {
      const response = await fetch(`/api/documents/${id}`);
      const data = await response.json();
      setDocument(data.document);
    }, 3000);
    return () => clearInterval(interval);
  }, [document?.status, id]);

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      await fetch(`/api/documents/${id}/reprocess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chunkSize: 1024,
          chunkOverlap: 128,
          strategy: "FIXED",
        }),
      });
      // Refresh
      const response = await fetch(`/api/documents/${id}`);
      const data = await response.json();
      setDocument(data.document);
    } catch (error) {
      console.error("Error reprocessing:", error);
    } finally {
      setReprocessing(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-neutral-400">Cargando...</div>;
  }

  if (!document) {
    return <div className="text-center py-12 text-neutral-400">Documento no encontrado</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => router.back()} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{document.filename}</CardTitle>
            <Badge
              variant={
                document.status === "READY"
                  ? "success"
                  : document.status === "ERROR"
                    ? "destructive"
                    : document.status === "PROCESSING"
                      ? "warning"
                      : "secondary"
              }
            >
              {statusLabels[document.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-neutral-500">Tamano</p>
              <p className="font-medium">{formatBytes(document.fileSize)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Paginas</p>
              <p className="font-medium">{document.pageCount}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Chunks</p>
              <p className="font-medium">{document.chunks.length}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Fecha</p>
              <p className="font-medium">{formatDate(document.createdAt)}</p>
            </div>
          </div>

          {document.error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{document.error}</p>
            </div>
          )}

          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReprocess}
              disabled={reprocessing || document.status === "PROCESSING"}
            >
              {reprocessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Reprocesar
            </Button>
          </div>
        </CardContent>
      </Card>

      <ChunkViewer chunks={document.chunks} />
    </div>
  );
}
