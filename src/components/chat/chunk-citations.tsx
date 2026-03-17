"use client";

import { Badge } from "@/components/ui/badge";

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
      <h4 className="text-sm font-semibold text-neutral-700">
        Fragmentos utilizados ({chunks.length})
      </h4>
      {chunks.map((chunk, i) => (
        <div
          key={chunk.id}
          className="border rounded-lg p-3 bg-neutral-50 text-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-xs">
              Fragmento {i + 1}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {(chunk.similarity * 100).toFixed(1)}%
            </Badge>
            <span className="text-xs text-neutral-400 ml-auto">
              {chunk.documentFilename} - Pag. {chunk.pageNumber}
            </span>
          </div>
          <p className="text-xs text-neutral-600 line-clamp-3 whitespace-pre-wrap">
            {chunk.content}
          </p>
        </div>
      ))}
    </div>
  );
}
