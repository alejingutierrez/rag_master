"use client";

import { forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-40 bg-[var(--color-ink-1000)]/50",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

const dialogContentStyles = cva(
  [
    "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
    "w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] overflow-auto",
    "bg-[var(--bg-page)] rounded-xl shadow-[var(--elev-4)]",
    "border border-[var(--border-default)]",
    "focus-visible:outline-none",
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
  ],
  {
    variants: {
      size: {
        sm: "max-w-[400px]",
        md: "max-w-[560px]",
        lg: "max-w-[720px]",
        xl: "max-w-[960px]",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentStyles> {
  hideClose?: boolean;
}

export const DialogContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, size, hideClose = false, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(dialogContentStyles({ size }), className)}
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
));
DialogContent.displayName = "DialogContent";

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 px-6 pt-6 pb-4 pr-12",
        className,
      )}
      {...props}
    />
  );
}

export const DialogTitle = forwardRef<
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
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-[var(--fg-muted)]", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export function DialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-6 py-2 text-sm text-[var(--fg-default)]", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 px-6 py-4 mt-2",
        className,
      )}
      {...props}
    />
  );
}
