"use client";

import { forwardRef } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/cn";

/**
 * TooltipProvider — envolver la app (o subárbol) con esto una sola vez.
 * Default delay: 400ms abrir, 100ms cerrar, skip 300ms entre tooltips.
 */
export const TooltipProvider = ({
  delayDuration = 400,
  skipDelayDuration = 300,
  ...props
}: TooltipPrimitive.TooltipProviderProps) => (
  <TooltipPrimitive.Provider
    delayDuration={delayDuration}
    skipDelayDuration={skipDelayDuration}
    {...props}
  />
);

export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipPortal = TooltipPrimitive.Portal;

export const TooltipContent = forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={8}
      className={cn(
        // Base
        "z-50 max-w-[280px] px-2.5 py-1.5",
        "text-xs font-medium leading-snug",
        "rounded-md shadow-[var(--elev-3)]",
        // Colors — invertido respecto al fondo
        "bg-[var(--color-ink-1000)] text-[var(--color-ink-0)]",
        // Animation
        "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        "data-[side=top]:data-[state=delayed-open]:slide-in-from-bottom-1",
        "data-[side=bottom]:data-[state=delayed-open]:slide-in-from-top-1",
        "data-[side=left]:data-[state=delayed-open]:slide-in-from-right-1",
        "data-[side=right]:data-[state=delayed-open]:slide-in-from-left-1",
        className,
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow
        className="fill-[var(--color-ink-1000)]"
        width={10}
        height={5}
      />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";

/**
 * Tooltip — wrapper de conveniencia. Para casos simples.
 * Uso: <Tooltip content="Texto"><Button /></Tooltip>
 */
export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  asChild?: boolean;
}

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration,
  asChild = true,
}: TooltipProps) {
  return (
    <TooltipRoot delayDuration={delayDuration}>
      <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {content}
      </TooltipContent>
    </TooltipRoot>
  );
}
