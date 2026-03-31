"use client";

import {
  BookOpen,
  BookText,
  AtSign,
  Camera,
  Palette,
  Video,
  Clapperboard,
  Mic,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  CHAT_TEMPLATES,
  CATEGORY_LABELS,
  type TemplateCategory,
} from "@/lib/chat-templates";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  "book-text": BookText,
  "at-sign": AtSign,
  camera: Camera,
  palette: Palette,
  video: Video,
  clapperboard: Clapperboard,
  mic: Mic,
};

interface TemplateSelectorProps {
  selectedTemplateId: string;
  onSelectTemplate: (id: string) => void;
  disabled?: boolean;
}

export function TemplateSelector({
  selectedTemplateId,
  onSelectTemplate,
  disabled = false,
}: TemplateSelectorProps) {
  const categories = Object.keys(CATEGORY_LABELS) as TemplateCategory[];

  return (
    <div className="mb-4 space-y-3">
      {categories.map((category) => {
        const templates = CHAT_TEMPLATES.filter(
          (t) => t.category === category
        );
        if (templates.length === 0) return null;

        return (
          <div key={category}>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {CATEGORY_LABELS[category]}
            </span>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {templates.map((template) => {
                const Icon = ICON_MAP[template.icon];
                const isSelected = template.id === selectedTemplateId;

                return (
                  <button
                    key={template.id}
                    onClick={() => onSelectTemplate(template.id)}
                    disabled={disabled}
                    title={template.description}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      "border focus:outline-none focus:ring-2 focus:ring-primary/50",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/50 text-secondary-foreground border-border hover:bg-secondary hover:border-secondary-foreground/20",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    {template.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
