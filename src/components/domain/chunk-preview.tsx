import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import { SimilarityIndicator } from "./similarity-indicator";

interface ChunkPreviewProps {
  content: string;
  chunkIndex?: number;
  pageNumber?: number;
  similarity?: number;
  documentName?: string;
  className?: string;
  onClick?: () => void;
}

export function ChunkPreview({
  content,
  chunkIndex,
  pageNumber,
  similarity,
  documentName,
  className,
  onClick,
}: ChunkPreviewProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-3 space-y-2 transition-colors",
        onClick && "cursor-pointer hover:bg-surface-hover hover:border-border-hover",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          {documentName && (
            <span className="truncate">{documentName}</span>
          )}
          {chunkIndex !== undefined && (
            <span className="font-mono">#{chunkIndex}</span>
          )}
          {pageNumber !== undefined && (
            <span>p.{pageNumber}</span>
          )}
        </div>
        {similarity !== undefined && (
          <SimilarityIndicator score={similarity} />
        )}
      </div>
      <p className="text-sm text-foreground/80 line-clamp-3 leading-relaxed">
        {content}
      </p>
    </div>
  );
}
