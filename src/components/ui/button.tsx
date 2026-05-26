"use client";

import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

const buttonStyles = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "font-medium leading-none whitespace-nowrap",
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
          "bg-[var(--accent)] text-[var(--fg-inverted)] hover:bg-[var(--accent-hover)] active:translate-y-px",
        secondary:
          "bg-[var(--bg-page)] text-[var(--fg-default)] border-[var(--border-default)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)]",
        ghost:
          "bg-transparent text-[var(--fg-default)] hover:bg-[var(--bg-hover)]",
        link:
          "bg-transparent text-[var(--accent)] hover:text-[var(--accent-hover)] underline-offset-4 hover:underline px-0",
        danger:
          "bg-[var(--color-danger-fg)] text-[var(--fg-inverted)] hover:opacity-90 active:translate-y-px",
        "danger-outline":
          "bg-transparent text-[var(--color-danger-fg)] border-[var(--color-danger-fg)] hover:bg-[var(--color-danger-bg)]",
      },
      size: {
        sm: "h-7 px-2.5 text-xs rounded-md",
        md: "h-9 px-3.5 text-sm rounded-md",
        lg: "h-11 px-4.5 text-[15px] rounded-md",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled">,
    VariantProps<typeof buttonStyles> {
  isLoading?: boolean;
  disabled?: boolean;
  asChild?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      isLoading = false,
      disabled = false,
      asChild = false,
      leadingIcon,
      trailingIcon,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const isInteractionDisabled = disabled || isLoading;

    return (
      <Comp
        ref={ref}
        className={cn(buttonStyles({ variant, size, fullWidth }), className)}
        disabled={isInteractionDisabled}
        aria-busy={isLoading || undefined}
        data-loading={isLoading || undefined}
        {...props}
      >
        {isLoading ? (
          <Spinner size={size === "lg" ? 18 : size === "sm" ? 14 : 16} />
        ) : (
          leadingIcon
        )}
        {children}
        {!isLoading && trailingIcon}
      </Comp>
    );
  },
);
Button.displayName = "Button";
