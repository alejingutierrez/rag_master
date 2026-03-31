import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max?: number;
  variant?: "default" | "success" | "warning" | "destructive";
  className?: string;
}

const variantColors = {
  default: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

export function Progress({ value, max = 100, variant = "default", className }: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div className={cn("w-full bg-muted rounded-full h-2", className)}>
      <div
        className={cn("h-2 rounded-full transition-all duration-300", variantColors[variant])}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
