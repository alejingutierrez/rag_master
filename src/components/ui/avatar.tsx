"use client";

import { forwardRef } from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const avatarStyles = cva(
  [
    "relative inline-flex shrink-0 overflow-hidden",
    "bg-[var(--bg-hover)] text-[var(--fg-default)]",
    "font-medium select-none",
  ],
  {
    variants: {
      size: {
        xs: "size-5 text-[10px]",
        sm: "size-7 text-[12px]",
        md: "size-9 text-[14px]",
        lg: "size-12 text-[18px]",
        xl: "size-16 text-[22px]",
      },
      shape: {
        circle: "rounded-full",
        square: "rounded-md",
      },
    },
    defaultVariants: { size: "md", shape: "circle" },
  },
);

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarStyles> {}

export const Avatar = forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size, shape, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(avatarStyles({ size, shape }), className)}
    {...props}
  />
));
Avatar.displayName = "Avatar";

export const AvatarImage = forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square size-full object-cover", className)}
    {...props}
  />
));
AvatarImage.displayName = "AvatarImage";

export const AvatarFallback = forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex size-full items-center justify-center", className)}
    {...props}
  />
));
AvatarFallback.displayName = "AvatarFallback";
