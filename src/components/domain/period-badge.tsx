import { cn } from "@/lib/utils";
import { getPeriodColor } from "@/components/questions/period-colors";
import { Clock } from "lucide-react";

interface PeriodBadgeProps {
  code: string;
  name?: string;
  range?: string;
  showIcon?: boolean;
  className?: string;
}

export function PeriodBadge({ code, name, range, showIcon = false, className }: PeriodBadgeProps) {
  const colors = getPeriodColor(code);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        colors.bg,
        colors.text,
        colors.border,
        className
      )}
    >
      {showIcon && <Clock className="h-3 w-3" />}
      {name || code}
      {range && <span className="opacity-70">({range})</span>}
    </span>
  );
}
