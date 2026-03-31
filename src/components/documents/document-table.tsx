"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/domain/status-badge";
import { EmptyState } from "@/components/domain/empty-state";
import { formatBytes, formatDate } from "@/lib/utils";
import { Trash2, Eye, RefreshCw, FileText } from "lucide-react";

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

interface DocumentTableProps {
  documents: Document[];
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export function DocumentTable({ documents, onDelete, onRefresh }: DocumentTableProps) {
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Sin documentos"
        description="Carga tu primer PDF para empezar a analizar documentos historicos"
        action={{ label: "Cargar PDFs", onClick: () => window.location.href = "/upload" }}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">
          {documents.length} documento{documents.length !== 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-surface">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Archivo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Paginas</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Chunks</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tamano</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-surface-hover transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-sm text-foreground truncate max-w-[200px]">
                    {doc.filename}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground text-right font-mono">{doc.pageCount}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground text-right font-mono">{doc._count.chunks}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground text-right font-mono">{formatBytes(doc.fileSize)}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(doc.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Link href={`/documents/${doc.id}`}>
                      <Button variant="ghost" size="icon" title="Ver detalle">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(doc.id)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
