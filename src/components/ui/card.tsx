"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const cardStyles = cva(
  ["rounded-lg transition-shadow duration-[var(--duration-fast)] ease-out"],
  {
    variants: {
      variant: {
        default:
          "bg-[var(--bg-page)] border border-[var(--border-default)] shadow-[var(--elev-1)]",
        elevated: "bg-[var(--bg-page)] shadow-[var(--elev-2)]",
        inset: "bg-[var(--bg-subtle)]",
        outline:
          "bg-transparent border border-[var(--border-default)]",
      },
      size: {
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
      },
      interactive: {
        true: "cursor-pointer hover:shadow-[var(--elev-2)] hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      interactive: false,
    },
  },
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardStyles> {
  /** Color de período histórico — añade banda izquierda 4px. */
  periodColor?: string;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { className, variant, size, interactive, periodColor, children, ...props },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          cardStyles({ variant, size, interactive }),
          periodColor && "relative overflow-hidden pl-[calc(theme(spacing.6)+4px)]",
          className,
        )}
        style={
          periodColor
            ? {
                ...((props.style as React.CSSProperties) ?? {}),
                boxShadow: `inset 4px 0 0 var(--color-period-${periodColor})`,
              }
            : props.style
        }
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? "button" : undefined}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Card.displayName = "Card";

/* ─── Sub-componentes ─────────────────────────────────────────────────────── */

export const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mb-3 flex flex-col gap-1", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" | "h5" }
>(({ className, as: Tag = "h3", ...props }, ref) => (
  <Tag
    ref={ref}
    className={cn(
      "serif-title text-[var(--color-ink-1000)] leading-tight",
      Tag === "h2" && "text-[28px] font-semibold",
      Tag === "h3" && "text-[22px] font-semibold",
      Tag === "h4" && "text-[18px] font-semibold",
      Tag === "h5" && "text-[16px] font-semibold",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[var(--fg-muted)]", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardBody = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm text-[var(--fg-default)]", className)} {...props} />
));
CardBody.displayName = "CardBody";

export const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mt-4 flex items-center gap-2", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
