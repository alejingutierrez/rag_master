"use client";

import { forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { DialogOverlay } from "./dialog";

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

const drawerContentStyles = cva(
  [
    "fixed z-50 flex flex-col",
    "bg-[var(--bg-page)] shadow-[var(--elev-4)]",
    "border-[var(--border-default)]",
    "focus-visible:outline-none",
    "data-[state=open]:animate-in data-[state=open]:duration-300",
    "data-[state=closed]:animate-out data-[state=closed]:duration-200",
  ],
  {
    variants: {
      side: {
        right: [
          "top-0 right-0 h-full",
          "border-l rounded-l-xl",
          "data-[state=open]:slide-in-from-right",
          "data-[state=closed]:slide-out-to-right",
        ],
        left: [
          "top-0 left-0 h-full",
          "border-r rounded-r-xl",
          "data-[state=open]:slide-in-from-left",
          "data-[state=closed]:slide-out-to-left",
        ],
        bottom: [
          "left-0 right-0 bottom-0 w-full",
          "border-t rounded-t-xl",
          "data-[state=open]:slide-in-from-bottom",
          "data-[state=closed]:slide-out-to-bottom",
        ],
      },
      size: {
        sm: "",
        md: "",
        lg: "",
      },
    },
    compoundVariants: [
      { side: "right", size: "sm", className: "w-[320px]" },
      { side: "right", size: "md", className: "w-[440px]" },
      { side: "right", size: "lg", className: "w-[560px]" },
      { side: "left", size: "sm", className: "w-[320px]" },
      { side: "left", size: "md", className: "w-[440px]" },
      { side: "left", size: "lg", className: "w-[560px]" },
      { side: "bottom", size: "sm", className: "max-h-[30vh]" },
      { side: "bottom", size: "md", className: "max-h-[50vh]" },
      { side: "bottom", size: "lg", className: "max-h-[75vh]" },
    ],
    defaultVariants: { side: "right", size: "md" },
  },
);

export interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof drawerContentStyles> {
  hideClose?: boolean;
}

export const DrawerContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(
  (
    { className, side, size, hideClose = false, children, ...props },
    ref,
  ) => (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(drawerContentStyles({ side, size }), className)}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            className={cn(
              "absolute right-4 top-4 size-7 inline-flex items-center justify-center",
              "rounded-md text-[var(--fg-subtle)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-default)]",
              "transition-colors duration-[var(--duration-instant)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]",
            )}
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
DrawerContent.displayName = "DrawerContent";

export function DrawerHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 px-6 pt-6 pb-4 pr-12",
        "border-b border-[var(--border-default)]",
        className,
      )}
      {...props}
    />
  );
}

export const DrawerTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "serif-title text-[22px] leading-tight text-[var(--color-ink-1000)]",
      className,
    )}
    {...props}
  />
));
DrawerTitle.displayName = "DrawerTitle";

export const DrawerDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-[var(--fg-muted)]", className)}
    {...props}
  />
));
DrawerDescription.displayName = "DrawerDescription";

export function DrawerBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 overflow-auto p-6 text-sm", className)}
      {...props}
    />
  );
}

export function DrawerFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 px-6 py-4",
        "border-t border-[var(--border-default)]",
        className,
      )}
      {...props}
    />
  );
}
