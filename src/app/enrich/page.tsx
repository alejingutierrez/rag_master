"use client";

import { useState, useEffect, useCallback } from "react";
import { Select } from "@/components/ui/select";
import { MetadataEditor } from "@/components/enrich/metadata-editor";
import { ChunkEditor } from "@/components/enrich/chunk-editor";

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

  // Cargar lista de documentos
  useEffect(() => {
    async function fetchDocs() {
      const response = await fetch("/api/documents?limit=100");
      const data = await response.json();
      setDocuments(data.documents);
    }
    fetchDocs();
  }, []);

  // Cargar documento seleccionado
  const loadDocument = useCallback(async (id: string) => {
    if (!id) {
      setDocument(null);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/documents/${id}`);
      const data = await response.json();
      setDocument(data.document);
    } catch (error) {
      console.error("Error loading document:", error);
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
    await loadDocument(selectedDocId);
  };

  const handleSaveChunk = async (chunkId: string, content: string) => {
    await fetch(`/api/chunks/${chunkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    await loadDocument(selectedDocId);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Enriquecer Documentos</h2>
        <p className="text-neutral-500 mt-1">
          Agrega metadata, edita chunks y mejora la calidad de tus documentos.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium block mb-2">Selecciona un documento</label>
        <Select
          value={selectedDocId}
          onChange={(e) => setSelectedDocId(e.target.value)}
        >
          <option value="">-- Seleccionar documento --</option>
          {documents
            .filter((d) => d.status === "READY")
            .map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.filename}
              </option>
            ))}
        </Select>
      </div>

      {loading && (
        <div className="text-center py-8 text-neutral-400">
          Cargando documento...
        </div>
      )}

      {document && !loading && (
        <div className="space-y-6">
          <MetadataEditor
            documentId={document.id}
            metadata={document.metadata}
            onSave={handleSaveMetadata}
          />

          <ChunkEditor
            chunks={document.chunks}
            onSaveChunk={handleSaveChunk}
          />
        </div>
      )}

      {!selectedDocId && !loading && (
        <div className="text-center py-12 text-neutral-400">
          Selecciona un documento para enriquecerlo
        </div>
      )}
    </div>
  );
}
