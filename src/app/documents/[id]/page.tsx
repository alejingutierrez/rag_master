"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { ChunkViewer } from "@/components/documents/chunk-viewer";
import { StatusBadge } from "@/components/domain/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, formatDate } from "@/lib/utils";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getDocumentDisplayName } from "@/lib/enrichment-types";

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
        body: JSON.stringify({ chunkSize: 1024, chunkOverlap: 128, strategy: "FIXED" }),
      });
      const response = await fetch(`/api/documents/${id}`);
      const data = await response.json();
      setDocument(data.document);
      toast.success("Reprocesamiento iniciado");
    } catch (error) {
      console.error("Error reprocessing:", error);
      toast.error("Error al reprocesar");
    } finally {
      setReprocessing(false);
    }
  };

  if (loading) {
    return (
      <PageContainer maxWidth="lg">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </PageContainer>
    );
  }

  if (!document) {
    return (
      <PageContainer maxWidth="lg">
        <div className="text-center py-12 text-muted-foreground">Documento no encontrado</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="lg">
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">{getDocumentDisplayName(document)}</CardTitle>
              {typeof (document.metadata as Record<string, unknown>)?.bookTitle === "string" && (
                <p className="text-xs text-muted-foreground font-mono mt-1">{document.filename}</p>
              )}
              <StatusBadge status={document.status} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Tamano</p>
                <p className="font-medium text-foreground font-mono">{formatBytes(document.fileSize)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paginas</p>
                <p className="font-medium text-foreground font-mono">{document.pageCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Chunks</p>
                <p className="font-medium text-foreground font-mono">{document.chunks.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha</p>
                <p className="font-medium text-foreground">{formatDate(document.createdAt)}</p>
              </div>
            </div>

            {document.error && (
              <div className="mt-4 p-3 bg-destructive-muted border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{document.error}</p>
              </div>
            )}

            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReprocess}
                disabled={reprocessing || document.status === "PROCESSING"}
              >
                {reprocessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Reprocesar
              </Button>
            </div>
          </CardContent>
        </Card>

        <ChunkViewer chunks={document.chunks} />
      </div>
    </PageContainer>
  );
}
