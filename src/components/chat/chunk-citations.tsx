"use client";

import { Badge } from "@/components/ui/badge";
import { SimilarityIndicator } from "@/components/domain/similarity-indicator";

interface ChunkCitation {
  id: string;
  documentId: string;
  documentFilename?: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
  content: string;
}

interface ChunkCitationsProps {
  chunks: ChunkCitation[];
}

export function ChunkCitations({ chunks }: ChunkCitationsProps) {
  if (chunks.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">
        Fragmentos utilizados ({chunks.length})
      </h4>
      {chunks.map((chunk, i) => (
        <div
          key={chunk.id}
          className="border border-border rounded-lg p-3 bg-surface text-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-xs">
              Fragmento {i + 1}
            </Badge>
            <SimilarityIndicator score={chunk.similarity} />
            <span className="text-xs text-muted-foreground ml-auto">
              {chunk.documentFilename} - Pag. {chunk.pageNumber}
            </span>
          </div>
          <p className="text-xs text-foreground/70 line-clamp-3 whitespace-pre-wrap">
            {chunk.content}
          </p>
        </div>
      ))}
    </div>
  );
}
