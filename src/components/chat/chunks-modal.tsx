"use client";

import { useState } from "react";
import { Dialog, DialogHeader, DialogBody } from "@/components/ui/dialog";
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
        <div className="space-y-3">
          {chunks.map((chunk, i) => {
            const isExpanded = expandedChunk === chunk.id;

            return (
              <div
                key={chunk.id}
                className="border rounded-lg bg-neutral-50 text-sm overflow-hidden transition-all"
              >
                {/* Header del chunk — clickeable para expandir */}
                <button
                  onClick={() =>
                    setExpandedChunk(isExpanded ? null : chunk.id)
                  }
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-neutral-100 transition-colors text-left"
                >
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    #{i + 1}
                  </Badge>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {(chunk.similarity * 100).toFixed(1)}%
                  </Badge>
                  <span className="text-xs text-neutral-500 truncate">
                    {chunk.documentFilename} — Pag. {chunk.pageNumber}
                  </span>
                  <svg
                    className={`h-4 w-4 ml-auto text-neutral-400 transition-transform flex-shrink-0 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Contenido expandible */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t bg-white">
                    <p className="text-xs text-neutral-600 whitespace-pre-wrap pt-3 leading-relaxed">
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
