"use client";

import { forwardRef } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/cn";

export const RadioGroup = forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    className={cn("grid gap-2", className)}
    {...props}
  />
));
RadioGroup.displayName = "RadioGroup";

export interface RadioGroupItemProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  size?: "sm" | "md";
}

export const RadioGroupItem = forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(({ className, size = "md", ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "aspect-square shrink-0 rounded-full",
      "border border-[var(--color-ink-300)] bg-[var(--bg-page)]",
      "transition-colors duration-[var(--duration-fast)]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:border-[var(--accent)]",
      size === "sm" ? "size-4" : "size-[18px]",
      className,
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center w-full h-full">
      <span
        className={cn(
          "rounded-full bg-[var(--accent)]",
          size === "sm" ? "size-1.5" : "size-2",
        )}
      />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = "RadioGroupItem";
