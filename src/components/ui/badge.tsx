"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeStyles = cva(
  ["inline-flex items-center gap-1 font-medium leading-none whitespace-nowrap"],
  {
    variants: {
      variant: {
        solid: "bg-[var(--color-ink-800)] text-[var(--color-ink-0)]",
        subtle: "bg-[var(--bg-hover)] text-[var(--fg-default)]",
        outline:
          "bg-transparent text-[var(--fg-muted)] border border-[var(--border-strong)]",
        tinta:
          "bg-[var(--color-tinta-100)] text-[var(--color-tinta-700)]",
        success:
          "bg-[var(--color-success-bg)] text-[var(--color-success-fg)]",
        warning:
          "bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)]",
        danger:
          "bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)]",
        info: "bg-[var(--color-info-bg)] text-[var(--color-info-fg)]",
      },
      size: {
        xs: "h-[18px] px-1.5 text-[11px] rounded-sm",
        sm: "h-[22px] px-2 text-xs rounded-sm",
        md: "h-[26px] px-2.5 text-sm rounded-sm",
      },
      shape: {
        rect: "",
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "subtle",
      size: "sm",
      shape: "rect",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeStyles> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, shape, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeStyles({ variant, size, shape }), className)}
        {...props}
      >
        {children}
      </span>
    );
  },
);
Badge.displayName = "Badge";

/* ─── Chip removable ──────────────────────────────────────────────────────── */

export interface ChipProps extends Omit<BadgeProps, "shape" | "children"> {
  children: React.ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(
  (
    {
      className,
      variant,
      size,
      onRemove,
      removeLabel = "Remover",
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <span
        ref={ref}
        className={cn(badgeStyles({ variant, size, shape: "pill" }), className)}
        {...props}
      >
        {children}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className={cn(
              "ml-0.5 -mr-0.5 inline-flex items-center justify-center",
              "rounded-full opacity-70 hover:opacity-100",
              "hover:bg-black/10 dark:hover:bg-white/10",
              size === "xs" && "size-3",
              size === "sm" && "size-3.5",
              (!size || size === "md") && "size-4",
            )}
            aria-label={removeLabel}
          >
            <svg
              viewBox="0 0 12 12"
              fill="currentColor"
              className="size-2.5"
              aria-hidden
            >
              <path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        )}
      </span>
    );
  },
);
Chip.displayName = "Chip";
