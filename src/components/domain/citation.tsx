"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

export interface CitationProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Número de la cita (1, 2, 42…). */
  number: number;
  /** Título corto de la fuente (para popover preview). */
  sourceTitle?: string;
  /** Snippet contextualizado de la fuente. */
  snippet?: string;
  /** Metadata adicional: autor, año, etc. */
  meta?: string;
  /** Estado activo: la SourceDrawer está mostrando esta fuente. */
  active?: boolean;
  /** Click → abre SourceDrawer. */
  onOpenSource?: () => void;
}

export const Citation = forwardRef<HTMLButtonElement, CitationProps>(
  (
    {
      className,
      number,
      sourceTitle,
      snippet,
      meta,
      active,
      onOpenSource,
      onClick,
      ...props
    },
    ref,
  ) => {
    const hasPreview = !!(sourceTitle || snippet);

    const trigger = (
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          onClick?.(e);
          onOpenSource?.();
        }}
        className={cn(
          "inline-flex items-center align-baseline",
          "font-mono text-[0.75em] font-medium",
          "px-1 py-0 rounded-sm",
          "border transition-colors duration-[var(--duration-instant)]",
          "cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]",
          active
            ? "bg-[var(--accent-bg-strong)] border-[var(--color-tinta-500)] text-[var(--color-tinta-700)]"
            : "bg-[var(--accent-bg-subtle)] border-[color-mix(in_oklab,var(--accent)_18%,transparent)] text-[var(--color-tinta-700)] hover:bg-[var(--accent-bg-strong)]",
          className,
        )}
        aria-label={`Ver fuente ${number}${sourceTitle ? `: ${sourceTitle}` : ""}`}
        {...props}
      >
        {number}
      </button>
    );

    if (!hasPreview) return trigger;

    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="start"
          className="max-w-[420px] p-4"
          onClick={(e) => e.stopPropagation()}
        >
          {sourceTitle && (
            <h5 className="serif-title text-[15px] leading-snug mb-1 text-[var(--color-ink-1000)]">
              {sourceTitle}
            </h5>
          )}
          {meta && (
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)] mb-2">
              {meta}
            </div>
          )}
          {snippet && (
            <p
              className="text-[13px] text-[var(--fg-muted)] leading-relaxed italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              «{snippet}»
            </p>
          )}
          {onOpenSource && (
            <button
              type="button"
              onClick={onOpenSource}
              className="mt-3 text-[12px] text-[var(--accent)] hover:underline font-medium"
            >
              Ver fuente completa →
            </button>
          )}
        </PopoverContent>
      </Popover>
    );
  },
);
Citation.displayName = "Citation";
