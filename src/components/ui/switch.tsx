"use client";

import { forwardRef } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  size?: "sm" | "md";
}

export const Switch = forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, size = "md", ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex shrink-0 cursor-pointer items-center",
      "rounded-full transition-colors duration-[var(--duration-fast)]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-[var(--accent)] data-[state=unchecked]:bg-[var(--color-ink-300)]",
      size === "sm" ? "h-4 w-7" : "h-5 w-9",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block rounded-full",
        "bg-[var(--color-ink-0)] shadow-[var(--elev-1)]",
        "transition-transform duration-[var(--duration-fast)]",
        size === "sm"
          ? "size-3 data-[state=checked]:translate-x-3.5 data-[state=unchecked]:translate-x-0.5"
          : "size-4 data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0.5",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
