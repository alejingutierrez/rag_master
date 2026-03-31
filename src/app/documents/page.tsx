"use client";

import { useState, useEffect, useCallback } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { DocumentTable } from "@/components/documents/document-table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

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
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/documents");
      const data = await response.json();
      setDocuments(data.documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Error al cargar documentos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast.success("Documento eliminado");
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Error al eliminar documento");
    }
  };

  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === "PROCESSING");
    if (!hasProcessing) return;
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  return (
    <PageContainer maxWidth="lg">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Documentos</h2>
          <p className="text-muted-foreground mt-1">
            Visualiza todos los documentos cargados y sus vectores.
          </p>
        </div>

        {loading && documents.length === 0 ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-8 w-24" />
            </div>
            <div className="border border-border rounded-lg overflow-hidden bg-surface">
              <div className="bg-muted/50 px-4 py-3">
                <Skeleton className="h-4 w-full" />
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3 border-t border-border">
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <DocumentTable
            documents={documents}
            onDelete={(id) => setDeleteTarget(id)}
            onRefresh={fetchDocuments}
          />
        )}
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
        title="Eliminar documento"
        description="Estas seguro de que quieres eliminar este documento y todos sus chunks? Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
      />
    </PageContainer>
  );
}
