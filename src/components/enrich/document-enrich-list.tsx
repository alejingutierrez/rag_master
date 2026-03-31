"use client";

import { getDocumentDisplayName } from "@/lib/enrichment-types";
import type { EnrichmentMetadata } from "@/lib/enrichment-types";
import { PeriodBadge } from "@/components/domain/period-badge";
import { CategoryBadge } from "@/components/domain/category-badge";
import { CheckCircle, Clock, ChevronRight, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPeriodByCode, getCategoryByCode } from "@/lib/taxonomy";

interface DocumentForList {
  id: string;
  filename: string;
  metadata: Record<string, unknown>;
  enriched: boolean;
  status: string;
  _count: { chunks: number; questions?: number };
}

interface DocumentEnrichListProps {
  documents: DocumentForList[];
  onSelect: (id: string) => void;
}

export function DocumentEnrichList({ documents, onSelect }: DocumentEnrichListProps) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No hay documentos disponibles
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Documento</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Periodo</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoria</th>
            <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Preguntas</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const meta = doc.metadata as EnrichmentMetadata;
            const displayName = getDocumentDisplayName(doc);
            const period = meta.primaryPeriod ? getPeriodByCode(meta.primaryPeriod) : null;
            const category = meta.primaryCategory ? getCategoryByCode(meta.primaryCategory) : null;
            const questionCount = doc._count.questions ?? 0;

            return (
              <tr
                key={doc.id}
                onClick={() => onSelect(doc.id)}
                className="border-b border-border last:border-0 hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground truncate max-w-[280px]">
                      {displayName}
                    </p>
                    {meta.author && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {meta.author}
                      </p>
                    )}
                    {meta.bookTitle && (
                      <p className="text-xs text-muted-foreground/60 truncate mt-0.5 font-mono">
                        {doc.filename}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
                      doc.enriched
                        ? "bg-success-muted text-success"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {doc.enriched ? (
                      <><CheckCircle className="h-3 w-3" /> Enriquecido</>
                    ) : (
                      <><Clock className="h-3 w-3" /> Pendiente</>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {period ? (
                    <PeriodBadge code={period.code} name={period.nombre} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {category ? (
                    <CategoryBadge code={category.code} name={category.nombre} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {questionCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="h-3 w-3" />
                      {questionCount}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
