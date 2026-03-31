"use client";

import { useState } from "react";
import { Check, BookOpen, BookText, AtSign, Camera, Palette, Video, Clapperboard, Mic } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTemplateById } from "@/lib/chat-templates";
import { DeliverableViewer } from "./deliverable-viewer";

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

interface DeliverableSummary {
  id: string;
  templateId: string;
  status: string;
}

interface DeliverableBadgesProps {
  deliverables: DeliverableSummary[];
}

export function DeliverableBadges({ deliverables }: DeliverableBadgesProps) {
  const [viewingId, setViewingId] = useState<string | null>(null);

  if (deliverables.length === 0) return null;

  const completed = deliverables.filter((d) => d.status === "COMPLETE");

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {completed.map((d) => {
          const template = getTemplateById(d.templateId);
          if (!template) return null;
          const Icon = ICON_MAP[template.icon];

          return (
            <button
              key={d.id}
              onClick={() => setViewingId(d.id)}
              title={template.name}
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                "bg-success/10 text-success border border-success/20 hover:bg-success/20"
              )}
            >
              {Icon && <Icon className="h-2.5 w-2.5" />}
              <Check className="h-2.5 w-2.5" />
            </button>
          );
        })}
      </div>

      {viewingId && (
        <DeliverableViewer
          deliverableId={viewingId}
          open={!!viewingId}
          onClose={() => setViewingId(null)}
        />
      )}
    </>
  );
}
