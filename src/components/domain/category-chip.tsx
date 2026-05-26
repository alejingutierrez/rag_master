"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { categoryInfo, categorySlug } from "@/lib/design-tokens";

const categoryChipStyles = cva(
  "inline-flex items-center gap-1 font-medium leading-none whitespace-nowrap rounded-full",
  {
    variants: {
      size: {
        xs: "h-[18px] px-2 text-[11px]",
        sm: "h-[22px] px-2.5 text-xs",
        md: "h-[26px] px-3 text-sm",
      },
      variant: {
        subtle: "",
        outline: "bg-transparent",
        solid: "text-[var(--color-ink-0)]",
      },
    },
    defaultVariants: { size: "sm", variant: "subtle" },
  },
);

export interface CategoryChipProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof categoryChipStyles> {
  code: string;
  interactive?: boolean;
  onRemove?: () => void;
}

export const CategoryChip = forwardRef<HTMLSpanElement, CategoryChipProps>(
  (
    {
      className,
      code,
      size,
      variant = "subtle",
      interactive,
      onRemove,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const info = categoryInfo(code);
    const slug = categorySlug(code);
    const colorVar = `var(--color-category-${slug})`;

    const variantStyle: React.CSSProperties = (() => {
      if (variant === "solid") {
        return { background: colorVar, color: "var(--color-ink-0)" };
      }
      if (variant === "outline") {
        return { borderWidth: 1, borderStyle: "solid", borderColor: colorVar, color: colorVar };
      }
      return {
        background: `color-mix(in oklab, ${colorVar} 12%, transparent)`,
        color: colorVar,
      };
    })();

    return (
      <span
        ref={ref}
        className={cn(
          categoryChipStyles({ size, variant }),
          interactive && "cursor-pointer hover:brightness-110",
          className,
        )}
        style={{ ...variantStyle, ...style }}
        title={info?.label}
        {...props}
      >
        {children ?? info?.label ?? code}
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="ml-0.5 inline-flex items-center justify-center opacity-70 hover:opacity-100"
            aria-label="Remover"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
              <path
                d="M3 3 L9 9 M9 3 L3 9"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
              />
            </svg>
          </button>
        )}
      </span>
    );
  },
);
CategoryChip.displayName = "CategoryChip";
