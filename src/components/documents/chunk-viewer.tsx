"use client";

import { Badge } from "@/components/ui/badge";

interface Chunk {
  id: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  chunkSize: number;
  overlap: number;
  strategy: string;
  metadata: Record<string, unknown>;
}

interface ChunkViewerProps {
  chunks: Chunk[];
}

export function ChunkViewer({ chunks }: ChunkViewerProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground">
        Chunks ({chunks.length})
      </h3>
      {chunks.map((chunk) => (
        <div
          key={chunk.id}
          className="border border-border rounded-lg p-4 bg-surface hover:bg-surface-hover transition-colors"
        >
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary">#{chunk.chunkIndex}</Badge>
            <Badge variant="outline">Pag. {chunk.pageNumber}</Badge>
            <Badge variant="outline">{chunk.strategy}</Badge>
            <span className="text-xs text-muted-foreground ml-auto font-mono">
              {chunk.content.length} chars
            </span>
          </div>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-6">
            {chunk.content}
          </p>
        </div>
      ))}
      {chunks.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          No hay chunks para este documento
        </p>
      )}
    </div>
  );
}
