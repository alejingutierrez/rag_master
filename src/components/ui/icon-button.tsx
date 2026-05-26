"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const iconButtonStyles = cva(
  [
    "inline-flex items-center justify-center",
    "border border-transparent",
    "transition-colors duration-[var(--duration-instant)] ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-[var(--bg-page)]",
    "disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--accent)] text-[var(--fg-inverted)] hover:bg-[var(--accent-hover)]",
        secondary:
          "bg-[var(--bg-page)] text-[var(--fg-default)] border-[var(--border-default)] hover:bg-[var(--bg-hover)]",
        ghost:
          "bg-transparent text-[var(--fg-default)] hover:bg-[var(--bg-hover)]",
        danger:
          "bg-transparent text-[var(--color-danger-fg)] hover:bg-[var(--color-danger-bg)]",
      },
      size: {
        sm: "h-7 w-7 rounded-md [&_svg]:size-3.5",
        md: "h-8 w-8 rounded-md [&_svg]:size-4",
        lg: "h-10 w-10 rounded-md [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "md",
    },
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonStyles> {
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(iconButtonStyles({ variant, size }), className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);
IconButton.displayName = "IconButton";
