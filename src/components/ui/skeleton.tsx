"use client";

import { cn } from "@/lib/cn";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "line" | "block" | "circle";
}

export function Skeleton({
  className,
  variant = "block",
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "shimmer",
        variant === "line" && "h-4 w-full rounded-sm",
        variant === "block" && "rounded-md",
        variant === "circle" && "rounded-full",
        className,
      )}
      role="status"
      aria-busy="true"
      aria-label="Cargando"
      {...props}
    />
  );
}
