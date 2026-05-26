"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const inputWrapperStyles = cva(
  [
    "flex items-center gap-2 w-full",
    "bg-[var(--bg-page)] text-[var(--fg-default)]",
    "border border-[var(--border-default)] rounded-md",
    "transition-colors duration-[var(--duration-fast)] ease-out",
    "has-[input:focus-visible]:border-[var(--color-tinta-500)] has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-[var(--ring-focus)]",
    "has-[textarea:focus-visible]:border-[var(--color-tinta-500)] has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-[var(--ring-focus)]",
    "hover:border-[var(--border-strong)]",
    "has-[input:disabled]:bg-[var(--bg-muted)] has-[input:disabled]:opacity-60 has-[input:disabled]:cursor-not-allowed",
  ],
  {
    variants: {
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-9 px-3 text-sm",
        lg: "h-11 px-3.5 text-[15px]",
      },
      error: {
        true: "border-[var(--color-danger-fg)] has-[input:focus-visible]:border-[var(--color-danger-fg)] has-[input:focus-visible]:ring-[var(--color-danger-fg)]/30",
        false: "",
      },
    },
    defaultVariants: { size: "md", error: false },
  },
);

const inputBaseStyles = cn(
  "flex-1 min-w-0 bg-transparent outline-none",
  "placeholder:text-[var(--color-ink-400)]",
  "disabled:cursor-not-allowed",
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputWrapperStyles> {
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      wrapperClassName,
      size,
      error,
      leadingIcon,
      trailingIcon,
      ...props
    },
    ref,
  ) => {
    return (
      <div className={cn(inputWrapperStyles({ size, error }), wrapperClassName)}>
        {leadingIcon && (
          <span
            className="text-[var(--fg-subtle)] [&_svg]:size-4 shrink-0"
            aria-hidden
          >
            {leadingIcon}
          </span>
        )}
        <input ref={ref} className={cn(inputBaseStyles, className)} {...props} />
        {trailingIcon && (
          <span
            className="text-[var(--fg-subtle)] [&_svg]:size-4 shrink-0"
            aria-hidden
          >
            {trailingIcon}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

/* ─── Textarea ───────────────────────────────────────────────────────────── */

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full min-h-20 max-h-96 px-3 py-2 text-sm",
          "bg-[var(--bg-page)] text-[var(--fg-default)]",
          "border rounded-md outline-none resize-y",
          "transition-colors duration-[var(--duration-fast)] ease-out",
          "placeholder:text-[var(--color-ink-400)]",
          "focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]",
          "disabled:bg-[var(--bg-muted)] disabled:opacity-60 disabled:cursor-not-allowed",
          error
            ? "border-[var(--color-danger-fg)] focus-visible:border-[var(--color-danger-fg)] focus-visible:ring-[var(--color-danger-fg)]/30"
            : "border-[var(--border-default)] hover:border-[var(--border-strong)] focus-visible:border-[var(--color-tinta-500)]",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

/* ─── Label + Help ───────────────────────────────────────────────────────── */

export interface FieldLabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function FieldLabel({
  children,
  required,
  className,
  ...props
}: FieldLabelProps) {
  return (
    <label
      className={cn(
        "block text-sm font-medium text-[var(--fg-default)] mb-1.5",
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="text-[var(--color-danger-fg)] ml-0.5" aria-hidden>
          *
        </span>
      )}
    </label>
  );
}

export function FieldHelp({
  children,
  error,
  className,
}: {
  children: React.ReactNode;
  error?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mt-1.5 text-xs",
        error ? "text-[var(--color-danger-fg)]" : "text-[var(--fg-subtle)]",
        className,
      )}
      role={error ? "alert" : undefined}
    >
      {children}
    </p>
  );
}
