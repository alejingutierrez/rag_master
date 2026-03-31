import { cn } from "@/lib/utils";

interface SimilarityIndicatorProps {
  score: number;
  showLabel?: boolean;
  className?: string;
}

export function SimilarityIndicator({ score, showLabel = true, className }: SimilarityIndicatorProps) {
  const percentage = Math.round(score * 100);
  const color =
    percentage >= 70 ? "bg-success" :
    percentage >= 40 ? "bg-warning" :
    "bg-destructive";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground font-mono">{percentage}%</span>
      )}
    </div>
  );
}
