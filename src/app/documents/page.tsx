"use client";

import { useState, useEffect, useCallback } from "react";
import { DocumentTable } from "@/components/documents/document-table";

interface Document {
  id: string;
  filename: string;
  fileSize: number;
  pageCount: number;
  status: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  _count: { chunks: number };
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/documents");
      const data = await response.json();
      setDocuments(data.documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDelete = async (id: string) => {
    if (!confirm("Estas seguro de que quieres eliminar este documento y todos sus chunks?")) {
      return;
    }

    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  // Auto-refresh para documentos en procesamiento
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === "PROCESSING");
    if (!hasProcessing) return;

    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900">Documentos</h2>
        <p className="text-neutral-500 mt-1">
          Visualiza todos los documentos cargados y sus vectores.
        </p>
      </div>

      {loading && documents.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">Cargando...</div>
      ) : (
        <DocumentTable
          documents={documents}
          onDelete={handleDelete}
          onRefresh={fetchDocuments}
        />
      )}
    </div>
  );
}
