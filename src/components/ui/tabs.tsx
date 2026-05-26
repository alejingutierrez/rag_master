"use client";

import { forwardRef } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

export const Tabs = TabsPrimitive.Root;

const tabsListStyles = cva("inline-flex items-center", {
  variants: {
    variant: {
      underline:
        "gap-6 border-b border-[var(--border-default)] w-full justify-start",
      pill: "gap-1 p-1 bg-[var(--bg-muted)] rounded-md",
      segmented:
        "gap-0 p-0.5 bg-[var(--bg-muted)] border border-[var(--border-default)] rounded-md",
    },
  },
  defaultVariants: { variant: "underline" },
});

export const TabsList = forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> &
    VariantProps<typeof tabsListStyles>
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListStyles({ variant }), className)}
    data-variant={variant}
    {...props}
  />
));
TabsList.displayName = "TabsList";

const tabsTriggerStyles = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "text-sm font-medium leading-none whitespace-nowrap",
    "transition-colors duration-[var(--duration-fast)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        underline: [
          "px-0 py-2.5 -mb-px",
          "text-[var(--fg-muted)] border-b-2 border-transparent",
          "hover:text-[var(--fg-default)]",
          "data-[state=active]:text-[var(--color-ink-1000)] data-[state=active]:border-[var(--accent)]",
        ],
        pill: [
          "px-3 py-1.5 rounded-md",
          "text-[var(--fg-muted)]",
          "hover:text-[var(--fg-default)]",
          "data-[state=active]:bg-[var(--accent-bg-subtle)] data-[state=active]:text-[var(--color-tinta-700)]",
        ],
        segmented: [
          "flex-1 px-3 py-1.5 rounded",
          "text-[var(--fg-muted)]",
          "hover:text-[var(--fg-default)]",
          "data-[state=active]:bg-[var(--bg-page)] data-[state=active]:text-[var(--fg-default)] data-[state=active]:shadow-[var(--elev-1)]",
        ],
      },
    },
    defaultVariants: { variant: "underline" },
  },
);

export const TabsTrigger = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> &
    VariantProps<typeof tabsTriggerStyles>
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerStyles({ variant }), className)}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 focus-visible:outline-none",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
