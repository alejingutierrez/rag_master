"use client";

import { useState, useEffect, useCallback } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/domain/empty-state";
import { MetadataEditor } from "@/components/enrich/metadata-editor";
import { ChunkEditor } from "@/components/enrich/chunk-editor";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Document {
  id: string;
  filename: string;
  status: string;
  metadata: Record<string, unknown>;
  chunks: Array<{
    id: string;
    content: string;
    pageNumber: number;
    chunkIndex: number;
  }>;
}

export default function EnrichPage() {
  const [documents, setDocuments] = useState<Array<{ id: string; filename: string; status: string }>>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchDocs() {
      const response = await fetch("/api/documents?limit=100");
      const data = await response.json();
      setDocuments(data.documents);
    }
    fetchDocs();
  }, []);

  const loadDocument = useCallback(async (id: string) => {
    if (!id) { setDocument(null); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/documents/${id}`);
      const data = await response.json();
      setDocument(data.document);
    } catch (error) {
      console.error("Error loading document:", error);
      toast.error("Error al cargar documento");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDocId) loadDocument(selectedDocId);
  }, [selectedDocId, loadDocument]);

  const handleSaveMetadata = async (metadata: Record<string, unknown>) => {
    await fetch(`/api/documents/${selectedDocId}/enrich`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata }),
    });
    toast.success("Metadata guardada");
    await loadDocument(selectedDocId);
  };

  const handleSaveChunk = async (chunkId: string, content: string) => {
    await fetch(`/api/chunks/${chunkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    toast.success("Chunk actualizado");
    await loadDocument(selectedDocId);
  };

  return (
    <PageContainer maxWidth="lg">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Enriquecer Documentos</h2>
          <p className="text-muted-foreground mt-1">
            Agrega metadata, edita chunks y mejora la calidad de tus documentos.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground block mb-2">Selecciona un documento</label>
          <Select value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)}>
            <option value="">-- Seleccionar documento --</option>
            {documents
              .filter((d) => d.status === "READY")
              .map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.filename}</option>
              ))}
          </Select>
        </div>

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        )}

        {document && !loading && (
          <div className="space-y-6">
            <MetadataEditor documentId={document.id} metadata={document.metadata} onSave={handleSaveMetadata} />
            <ChunkEditor chunks={document.chunks} onSaveChunk={handleSaveChunk} />
          </div>
        )}

        {!selectedDocId && !loading && (
          <EmptyState
            icon={Sparkles}
            title="Selecciona un documento"
            description="Elige un documento para editar su metadata y chunks"
          />
        )}
      </div>
    </PageContainer>
  );
}
