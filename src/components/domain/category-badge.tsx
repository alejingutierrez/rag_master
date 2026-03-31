import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/components/questions/period-colors";
import { Tag } from "lucide-react";

interface CategoryBadgeProps {
  code: string;
  name?: string;
  showIcon?: boolean;
  className?: string;
}

export function CategoryBadge({ code, name, showIcon = false, className }: CategoryBadgeProps) {
  const colors = getCategoryColor(code);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        colors.bg,
        colors.text,
        className
      )}
    >
      {showIcon && <Tag className="h-3 w-3" />}
      {name || code}
    </span>
  );
}
