"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { PeriodBadge } from "./period-badge";
import { CategoryChip } from "./category-chip";

export interface ResearchHeaderProps
  extends React.HTMLAttributes<HTMLElement> {
  title: string;
  subtitle?: string;
  periodCode?: string;
  categoryCodes?: string[];
  meta?: Array<{ label: string; value: React.ReactNode }>;
  breadcrumb?: React.ReactNode;
}

/**
 * ResearchHeader — header de un research artifact / página de respuesta.
 * Title en Newsreader grande, divider verde monte (acento editorial).
 */
export const ResearchHeader = forwardRef<HTMLElement, ResearchHeaderProps>(
  (
    {
      className,
      title,
      subtitle,
      periodCode,
      categoryCodes,
      meta,
      breadcrumb,
      ...props
    },
    ref,
  ) => {
    return (
      <header
        ref={ref}
        className={cn("max-w-[var(--container-reading)]", className)}
        {...props}
      >
        {breadcrumb && (
          <div className="text-[12px] text-[var(--fg-subtle)] mb-3">
            {breadcrumb}
          </div>
        )}

        <h1
          className="serif-title text-[36px] md:text-[44px] leading-[1.1] text-[var(--color-ink-1000)] tracking-tight"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 700 }}
        >
          {title}
        </h1>

        {subtitle && (
          <p className="text-[16px] text-[var(--fg-muted)] mt-3 leading-relaxed">
            {subtitle}
          </p>
        )}

        {(periodCode || (categoryCodes && categoryCodes.length > 0) || meta) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
            {periodCode && <PeriodBadge code={periodCode} size="sm" />}
            {categoryCodes?.map((c) => (
              <CategoryChip key={c} code={c} size="sm" />
            ))}
            {meta?.map((m, i) => (
              <span key={i} className="text-[var(--fg-subtle)] flex items-center gap-1">
                {i > 0 || periodCode || categoryCodes?.length ? <span>·</span> : null}
                <span className="text-[var(--fg-muted)]">{m.value}</span>
                <span className="font-mono text-[11px] text-[var(--fg-subtle)]">
                  {m.label}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Divider editorial: acento monte */}
        <div
          className="mt-6 h-px"
          style={{ background: "var(--color-monte-700)" }}
          aria-hidden
        />
      </header>
    );
  },
);
ResearchHeader.displayName = "ResearchHeader";
