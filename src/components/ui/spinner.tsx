"use client";

import { cn } from "@/lib/cn";

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number;
}

export function Spinner({ size = 16, className, ...props }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("animate-spin shrink-0", className)}
      aria-label="Cargando"
      role="status"
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M12 2 A 10 10 0 0 1 22 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
