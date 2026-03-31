"use client";

import { useState } from "react";
import { Dialog, DialogHeader, DialogBody } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SimilarityIndicator } from "@/components/domain/similarity-indicator";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChunkCitation {
  id: string;
  documentId: string;
  documentFilename?: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
  content: string;
}

interface ChunksModalProps {
  open: boolean;
  onClose: () => void;
  chunks: ChunkCitation[];
}

export function ChunksModal({ open, onClose, chunks }: ChunksModalProps) {
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null);

  if (chunks.length === 0) return null;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        Fragmentos utilizados ({chunks.length})
      </DialogHeader>
      <DialogBody>
        <div className="space-y-2">
          {chunks.map((chunk, i) => {
            const isExpanded = expandedChunk === chunk.id;

            return (
              <div
                key={chunk.id}
                className="border border-border rounded-lg bg-surface text-sm overflow-hidden transition-all"
              >
                <button
                  onClick={() =>
                    setExpandedChunk(isExpanded ? null : chunk.id)
                  }
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-surface-hover transition-colors text-left"
                >
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    #{i + 1}
                  </Badge>
                  <SimilarityIndicator score={chunk.similarity} className="flex-shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">
                    {chunk.documentFilename} — Pag. {chunk.pageNumber}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 ml-auto text-muted-foreground transition-transform flex-shrink-0",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border bg-muted/30">
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap pt-3 leading-relaxed">
                      {chunk.content}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogBody>
    </Dialog>
  );
}
