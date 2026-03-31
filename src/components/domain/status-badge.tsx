import { cn } from "@/lib/utils";
import { CheckCircle, AlertCircle, Loader2, Clock } from "lucide-react";

type DocumentStatus = "PENDING" | "PROCESSING" | "READY" | "ERROR";

const statusConfig: Record<DocumentStatus, {
  label: string;
  icon: React.ElementType;
  classes: string;
}> = {
  PENDING: {
    label: "Pendiente",
    icon: Clock,
    classes: "bg-warning-muted text-warning",
  },
  PROCESSING: {
    label: "Procesando",
    icon: Loader2,
    classes: "bg-info-muted text-info",
  },
  READY: {
    label: "Listo",
    icon: CheckCircle,
    classes: "bg-success-muted text-success",
  },
  ERROR: {
    label: "Error",
    icon: AlertCircle,
    classes: "bg-destructive-muted text-destructive",
  },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as DocumentStatus] ?? statusConfig.PENDING;
  const Icon = config.icon;
  const isProcessing = status === "PROCESSING";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        config.classes,
        className
      )}
    >
      <Icon className={cn("h-3 w-3", isProcessing && "animate-spin")} />
      {config.label}
    </span>
  );
}
