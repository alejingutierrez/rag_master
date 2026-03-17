"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDate } from "@/lib/utils";
import { Trash2, Eye, RefreshCw } from "lucide-react";

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

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" }> = {
  PENDING: { label: "Pendiente", variant: "secondary" },
  PROCESSING: { label: "Procesando", variant: "warning" },
  READY: { label: "Listo", variant: "success" },
  ERROR: { label: "Error", variant: "destructive" },
};

export function DocumentTable({ documents, onDelete, onRefresh }: DocumentTableProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-neutral-500">
          {documents.length} documento{documents.length !== 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="border rounded-xl overflow-hidden bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-neutral-50">
              <th className="text-left px-4 py-3 text-sm font-medium text-neutral-500">Archivo</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-neutral-500">Estado</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-neutral-500">Paginas</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-neutral-500">Chunks</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-neutral-500">Tamano</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-neutral-500">Fecha</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-neutral-500">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const sc = statusConfig[doc.status] || statusConfig.PENDING;
              return (
                <tr key={doc.id} className="border-b last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm text-neutral-900 truncate max-w-[200px]">
                      {doc.filename}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={sc.variant}>{sc.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600 text-right">{doc.pageCount}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600 text-right">{doc._count.chunks}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600 text-right">{formatBytes(doc.fileSize)}</td>
                  <td className="px-4 py-3 text-sm text-neutral-500">{formatDate(doc.createdAt)}</td>
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
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {documents.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-neutral-400">
                  No hay documentos cargados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
