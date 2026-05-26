"use client";

import { forwardRef } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

export interface PaginationProps {
  current: number;
  total: number;
  pageSize?: number;
  onChange: (page: number) => void;
  className?: string;
  /** Mostrar texto "página X de Y". */
  showInfo?: boolean;
  /** Tamaño de los botones. */
  size?: "sm" | "md";
}

/**
 * Compone la lista de páginas a mostrar (con elipsis).
 * Reglas: siempre mostrar 1, current-1, current, current+1, totalPages.
 * Elipsis entre extremos y vecinos si hay gap.
 */
function getPageItems(current: number, totalPages: number): Array<number | "..."> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: Array<number | "..."> = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(totalPages - 1, current + 1);

  if (left > 2) items.push("...");
  for (let i = left; i <= right; i++) items.push(i);
  if (right < totalPages - 1) items.push("...");

  items.push(totalPages);
  return items;
}

const buttonBase = cn(
  "inline-flex items-center justify-center",
  "border border-transparent rounded-md",
  "text-[13px] font-medium",
  "transition-colors duration-[var(--duration-instant)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2",
  "disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none",
);

export const Pagination = forwardRef<HTMLElement, PaginationProps>(
  (
    {
      current,
      total,
      pageSize = 20,
      onChange,
      className,
      showInfo = false,
      size = "md",
    },
    ref,
  ) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const items = getPageItems(current, totalPages);

    const sizeClasses =
      size === "sm" ? "h-7 min-w-[28px] px-2" : "h-9 min-w-[36px] px-2.5";

    return (
      <nav
        ref={ref}
        className={cn("flex items-center gap-1.5", className)}
        aria-label="Paginación"
      >
        <button
          type="button"
          onClick={() => onChange(Math.max(1, current - 1))}
          disabled={current <= 1}
          className={cn(
            buttonBase,
            sizeClasses,
            "bg-[var(--bg-page)] border-[var(--border-default)] text-[var(--fg-default)]",
            "hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)]",
          )}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </button>

        {items.map((item, i) =>
          item === "..." ? (
            <span
              key={`ellipsis-${i}`}
              className={cn(
                sizeClasses,
                "inline-flex items-center justify-center text-[var(--fg-subtle)]",
              )}
              aria-hidden
            >
              <MoreHorizontal className="size-4" />
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              className={cn(
                buttonBase,
                sizeClasses,
                item === current
                  ? "bg-[var(--accent)] text-[var(--fg-inverted)]"
                  : "bg-[var(--bg-page)] border-[var(--border-default)] text-[var(--fg-default)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)]",
              )}
              aria-current={item === current ? "page" : undefined}
              aria-label={`Página ${item}`}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, current + 1))}
          disabled={current >= totalPages}
          className={cn(
            buttonBase,
            sizeClasses,
            "bg-[var(--bg-page)] border-[var(--border-default)] text-[var(--fg-default)]",
            "hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)]",
          )}
          aria-label="Página siguiente"
        >
          <ChevronRight className="size-4" />
        </button>

        {showInfo && (
          <span className="ml-2 text-[12px] text-[var(--fg-subtle)]">
            página {current} de {totalPages}
          </span>
        )}
      </nav>
    );
  },
);
Pagination.displayName = "Pagination";
