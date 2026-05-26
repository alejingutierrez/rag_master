"use client";

import { forwardRef } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  size?: "sm" | "md";
}

export const Checkbox = forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, size = "md", ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer shrink-0 inline-flex items-center justify-center",
      "rounded-sm border border-[var(--color-ink-300)] bg-[var(--bg-page)]",
      "transition-colors duration-[var(--duration-fast)]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-[var(--accent)] data-[state=checked]:border-[var(--accent)]",
      "data-[state=indeterminate]:bg-[var(--accent)] data-[state=indeterminate]:border-[var(--accent)]",
      "data-[state=checked]:text-[var(--fg-inverted)] data-[state=indeterminate]:text-[var(--fg-inverted)]",
      size === "sm" ? "size-4" : "size-[18px]",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center">
      {props.checked === "indeterminate" ? (
        <Minus className={size === "sm" ? "size-3" : "size-3.5"} strokeWidth={3} />
      ) : (
        <Check className={size === "sm" ? "size-3" : "size-3.5"} strokeWidth={3} />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";
