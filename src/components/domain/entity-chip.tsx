"use client";

import { forwardRef } from "react";
import { User, MapPin, Building2, Calendar } from "lucide-react";
import { cn } from "@/lib/cn";

export type EntityType = "person" | "place" | "institution" | "event";

const ENTITY_ICONS: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  person: User,
  place: MapPin,
  institution: Building2,
  event: Calendar,
};

const ENTITY_COLORS: Record<EntityType, string> = {
  person: "var(--color-category-soc)",
  place: "var(--color-category-ter)",
  institution: "var(--color-category-ins)",
  event: "var(--color-category-his)",
};

export interface EntityChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  type: EntityType;
  name: string;
  /** Año o rango asociado. */
  year?: string | number;
  size?: "xs" | "sm" | "md";
}

export const EntityChip = forwardRef<HTMLSpanElement, EntityChipProps>(
  ({ className, type, name, year, size = "sm", style, ...props }, ref) => {
    const Icon = ENTITY_ICONS[type];
    const color = ENTITY_COLORS[type];

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 font-medium leading-none whitespace-nowrap rounded-full",
          size === "xs" && "h-[18px] px-1.5 text-[11px]",
          size === "sm" && "h-[22px] px-2 text-xs",
          size === "md" && "h-[26px] px-2.5 text-sm",
          className,
        )}
        style={{
          background: `color-mix(in oklab, ${color} 12%, transparent)`,
          color,
          ...style,
        }}
        {...props}
      >
        <Icon className={cn(size === "xs" ? "size-3" : "size-3.5", "shrink-0")} aria-hidden />
        <span className="truncate">{name}</span>
        {year && (
          <span
            className="font-mono opacity-70"
            style={{ fontSize: "0.85em" }}
          >
            {year}
          </span>
        )}
      </span>
    );
  },
);
EntityChip.displayName = "EntityChip";
