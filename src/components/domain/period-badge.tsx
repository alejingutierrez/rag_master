"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { periodInfo, periodSlug } from "@/lib/design-tokens";

const periodBadgeStyles = cva(
  "inline-flex items-center gap-1.5 font-medium leading-none whitespace-nowrap rounded-sm",
  {
    variants: {
      size: {
        xs: "h-[18px] px-1.5 text-[11px]",
        sm: "h-[22px] px-2 text-xs",
        md: "h-[26px] px-2.5 text-sm",
      },
      variant: {
        solid: "text-[var(--color-ink-0)]",
        subtle: "",
        outline: "bg-transparent",
      },
    },
    defaultVariants: { size: "sm", variant: "subtle" },
  },
);

export interface PeriodBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof periodBadgeStyles> {
  /** Código del período (PRE, IND, C91, etc.). */
  code: string;
  /** Mostrar solo la sigla en lugar del label completo. */
  short?: boolean;
  /** Mostrar el rango de años después del label. */
  showYears?: boolean;
}

export const PeriodBadge = forwardRef<HTMLSpanElement, PeriodBadgeProps>(
  ({ className, code, size, variant = "subtle", short, showYears, style, ...props }, ref) => {
    const info = periodInfo(code);
    const slug = periodSlug(code);
    const colorVar = `var(--color-period-${slug})`;

    const variantStyle: React.CSSProperties = (() => {
      if (variant === "solid") {
        return { background: colorVar, color: "var(--color-ink-0)" };
      }
      if (variant === "outline") {
        return { borderWidth: 1, borderStyle: "solid", borderColor: colorVar, color: colorVar };
      }
      // subtle
      return {
        background: `color-mix(in oklab, ${colorVar} 12%, transparent)`,
        color: colorVar,
      };
    })();

    return (
      <span
        ref={ref}
        className={cn(periodBadgeStyles({ size, variant }), className)}
        style={{ ...variantStyle, ...style }}
        title={info?.label}
        {...props}
      >
        {short || size === "xs" ? info?.short ?? code : info?.label ?? code}
        {showYears && info?.yearRange && (
          <span className="opacity-70 font-mono text-[0.85em]">{info.yearRange}</span>
        )}
      </span>
    );
  },
);
PeriodBadge.displayName = "PeriodBadge";
