"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface ProseBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ancho de lectura. Default: reading (680px). */
  width?: "reading" | "prose";
}

/**
 * ProseBlock — wrapper para contenido editorial largo (research artifacts,
 * respuestas RAG, producciones académicas). Aplica .prose-academic.
 */
export const ProseBlock = forwardRef<HTMLDivElement, ProseBlockProps>(
  ({ className, width = "reading", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "prose-academic",
          width === "reading" && "max-w-[var(--container-reading)]",
          width === "prose" && "max-w-[var(--container-prose)]",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ProseBlock.displayName = "ProseBlock";
