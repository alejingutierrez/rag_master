"use client";

import { useState, useEffect, useCallback } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { BatchEnrichPanel } from "@/components/enrich/batch-enrich-panel";
import { DocumentEnrichList } from "@/components/enrich/document-enrich-list";
import { EnrichmentForm } from "@/components/enrich/enrichment-form";
import { ChunkEditor } from "@/components/enrich/chunk-editor";
import { getDocumentDisplayName } from "@/lib/enrichment-types";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface DocumentSummary {
  id: string;
  filename: string;
  metadata: Record<string, unknown>;
  enriched: boolean;
  status: string;
  _count: { chunks: number; questions?: number };
}

interface DocumentDetail {
  id: string;
  filename: string;
  metadata: Record<string, unknown>;
  enriched: boolean;
  status: string;
  chunks: Array<{
    id: string;
    content: string;
    pageNumber: number;
    chunkIndex: number;
  }>;
}

export default function EnrichPage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents?limit=200&status=READY");
      const data = await res.json();
      const docs: DocumentSummary[] = data.documents ?? [];

      // Enrich with question counts
      const enriched = await Promise.all(
        docs.map(async (doc) => {
          try {
            const qRes = await fetch(`/api/documents/${doc.id}/questions`);
            const qData = await qRes.json();
            return {
              ...doc,
              _count: { ...doc._count, questions: qData.count ?? 0 },
            };
          } catch {
            return { ...doc, _count: { ...doc._count, questions: 0 } };
          }
        })
      );

      setDocuments(enriched);
    } catch (err) {
      console.error("Error loading documents:", err);
      toast.error("Error al cargar documentos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const loadDocument = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/documents/${id}`);
      const data = await res.json();
      setDocument(data.document);
    } catch {
      toast.error("Error al cargar documento");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleSelect = (id: string) => {
    setSelectedDocId(id);
    loadDocument(id);
  };

  const handleBack = () => {
    setSelectedDocId(null);
    setDocument(null);
    loadDocuments();
  };

  const handleSaveMetadata = async (metadata: Record<string, unknown>) => {
    if (!selectedDocId) return;
    const res = await fetch(`/api/documents/${selectedDocId}/enrich`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata }),
    });
    if (!res.ok) {
      toast.error("Error al guardar");
      return;
    }
    toast.success("Metadata guardada");
    await loadDocument(selectedDocId);
  };

  const handleEnrichWithAI = async () => {
    if (!selectedDocId) return;
    const res = await fetch(`/api/documents/${selectedDocId}/enrich`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Error al enriquecer");
    }
    await loadDocument(selectedDocId);
  };

  const handleSaveChunk = async (chunkId: string, content: string) => {
    await fetch(`/api/chunks/${chunkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    toast.success("Chunk actualizado");
    if (selectedDocId) await loadDocument(selectedDocId);
  };

  const enrichedCount = documents.filter((d) => d.enriched).length;
  const pendingCount = documents.filter((d) => !d.enriched).length;

  if (loading) {
    return (
      <PageContainer maxWidth="lg">
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </PageContainer>
    );
  }

  // Detail view
  if (selectedDocId && document) {
    return (
      <PageContainer maxWidth="lg">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a lista
            </button>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {getDocumentDisplayName(document)}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Edita la información bibliográfica y clasificación del documento.
            </p>
          </div>

          <EnrichmentForm
            documentId={document.id}
            filename={document.filename}
            metadata={document.metadata}
            onSave={handleSaveMetadata}
            onEnrichWithAI={handleEnrichWithAI}
          />

          <ChunkEditor
            chunks={document.chunks}
            onSaveChunk={handleSaveChunk}
          />
        </div>
      </PageContainer>
    );
  }

  // Detail loading
  if (selectedDocId && loadingDetail) {
    return (
      <PageContainer maxWidth="lg">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-96" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </PageContainer>
    );
  }

  // List view
  return (
    <PageContainer maxWidth="lg">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Enriquecer Documentos</h2>
          <p className="text-muted-foreground mt-1">
            Enriquece automáticamente tus documentos con metadata bibliográfica usando IA, o edita manualmente.
          </p>
        </div>

        <BatchEnrichPanel
          totalDocuments={documents.length}
          enrichedCount={enrichedCount}
          pendingCount={pendingCount}
          onComplete={loadDocuments}
        />

        <DocumentEnrichList
          documents={documents}
          onSelect={handleSelect}
        />
      </div>
    </PageContainer>
  );
}
