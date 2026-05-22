"use client";

import { useState } from "react";
import {
  Check, BookOpen, BookText, AtSign, Camera, Palette, Video, Clapperboard, Mic,
  Circle, AlertCircle, Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAT_TEMPLATES, getTemplateById } from "@/lib/chat-templates";
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
  /**
   * Si se pasa, además del resumen muestra un strip con TODOS los templates y
   * su estado (visible o pendiente). Útil para `/questions`.
   */
  showAll?: boolean;
}

export function DeliverableBadges({ deliverables, showAll = true }: DeliverableBadgesProps) {
  const [viewingId, setViewingId] = useState<string | null>(null);

  const completed = deliverables.filter((d) => d.status === "COMPLETE");
  const generating = deliverables.filter((d) => d.status === "GENERATING");
  const errored = deliverables.filter((d) => d.status === "ERROR");
  const totalTemplates = CHAT_TEMPLATES.length;
  const completedCount = completed.length;

  const ratio = completedCount / totalTemplates;
  const summaryTone =
    ratio >= 1
      ? "bg-success/10 text-success border-success/20"
      : ratio > 0
      ? "bg-warning/10 text-warning border-warning/20"
      : "bg-muted text-muted-foreground border-border";

  if (!showAll && deliverables.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        {/* Resumen X/N */}
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border",
            summaryTone
          )}
          title={
            ratio >= 1
              ? "Todos los entregables completos"
              : ratio > 0
              ? "Algunos entregables generados"
              : "Sin entregables aún"
          }
        >
          {ratio >= 1 ? (
            <Check className="h-2.5 w-2.5" />
          ) : ratio > 0 ? (
            <Circle className="h-2.5 w-2.5" />
          ) : (
            <Circle className="h-2.5 w-2.5 opacity-50" />
          )}
          {completedCount}/{totalTemplates}
        </span>

        {/* Strip por template */}
        {showAll &&
          CHAT_TEMPLATES.map((t) => {
            const Icon = ICON_MAP[t.icon];
            const d = deliverables.find((x) => x.templateId === t.id);
            const status = d?.status;

            const stateClasses =
              status === "COMPLETE"
                ? "bg-success/10 text-success border-success/20 hover:bg-success/20 cursor-pointer"
                : status === "GENERATING"
                ? "bg-info/10 text-info border-info/20"
                : status === "ERROR"
                ? "bg-destructive/10 text-destructive border-destructive/20"
                : "bg-muted/50 text-muted-foreground/50 border-border/50";

            const StatusIcon =
              status === "COMPLETE"
                ? Check
                : status === "GENERATING"
                ? Loader2
                : status === "ERROR"
                ? AlertCircle
                : null;

            const isClickable = status === "COMPLETE" && d;
            const inner = (
              <>
                {Icon && <Icon className="h-2.5 w-2.5" />}
                {StatusIcon && (
                  <StatusIcon
                    className={cn("h-2.5 w-2.5", status === "GENERATING" && "animate-spin")}
                  />
                )}
              </>
            );

            return isClickable ? (
              <button
                key={t.id}
                onClick={() => setViewingId(d!.id)}
                title={`${t.name} — completo`}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border",
                  stateClasses
                )}
              >
                {inner}
              </button>
            ) : (
              <span
                key={t.id}
                title={`${t.name} — ${
                  status === "GENERATING"
                    ? "generando"
                    : status === "ERROR"
                    ? "con error"
                    : "pendiente"
                }`}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border",
                  stateClasses
                )}
              >
                {inner}
              </span>
            );
          })}

        {/* Indicador rápido de errores/generando para usuarios con prisa */}
        {!showAll && generating.length > 0 && (
          <span className="text-[10px] text-info">{generating.length} generando…</span>
        )}
        {!showAll && errored.length > 0 && (
          <span className="text-[10px] text-destructive">{errored.length} con error</span>
        )}
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

/** Solo para tooltips si el caller los necesita en otra parte de la UI. */
export function getTemplateName(templateId: string): string {
  return getTemplateById(templateId)?.name ?? templateId;
}
