"use client";

import { forwardRef } from "react";
import {
  Book,
  FileText,
  Newspaper,
  ScrollText,
  GraduationCap,
  Mic,
  MapPin,
  Image as ImageIcon,
  Film,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { PeriodBadge } from "./period-badge";
import { CategoryChip } from "./category-chip";
import { periodCssVar } from "@/lib/design-tokens";

export type SourceType =
  | "book"
  | "article"
  | "archive"
  | "newspaper"
  | "thesis"
  | "speech"
  | "map"
  | "image"
  | "av";

const SOURCE_ICONS: Record<SourceType, React.ComponentType<{ className?: string }>> = {
  book: Book,
  article: FileText,
  archive: ScrollText,
  newspaper: Newspaper,
  thesis: GraduationCap,
  speech: Mic,
  map: MapPin,
  image: ImageIcon,
  av: Film,
};

const SOURCE_LABELS: Record<SourceType, string> = {
  book: "Libro",
  article: "Artículo",
  archive: "Documento de archivo",
  newspaper: "Periódico",
  thesis: "Tesis",
  speech: "Discurso",
  map: "Mapa",
  image: "Imagen",
  av: "Audio/Video",
};

export interface SourceCardProps extends React.HTMLAttributes<HTMLElement> {
  type?: SourceType;
  title: string;
  author?: string;
  year?: string | number;
  publisher?: string;
  snippet?: string;
  periodCode?: string;
  categoryCodes?: string[];
  documentUrl?: string;
  onOpenSource?: () => void;
}

export const SourceCard = forwardRef<HTMLElement, SourceCardProps>(
  (
    {
      className,
      type = "book",
      title,
      author,
      year,
      publisher,
      snippet,
      periodCode,
      categoryCodes,
      documentUrl,
      onOpenSource,
      ...props
    },
    ref,
  ) => {
    const Icon = SOURCE_ICONS[type];
    const typeLabel = SOURCE_LABELS[type];

    const meta = [author, year, publisher].filter(Boolean).join(" · ");

    return (
      <article
        ref={ref}
        className={cn(
          "relative overflow-hidden",
          "bg-[var(--bg-page)] border border-[var(--border-default)] rounded-lg",
          "p-5 transition-shadow duration-[var(--duration-fast)]",
          "hover:shadow-[var(--elev-2)] hover:border-[var(--border-strong)]",
          onOpenSource && "cursor-pointer",
          className,
        )}
        onClick={onOpenSource}
        style={
          periodCode
            ? { boxShadow: `inset 4px 0 0 ${periodCssVar(periodCode)}` }
            : undefined
        }
        {...props}
      >
        <header className="flex items-start gap-3 mb-2">
          <div className="shrink-0 size-9 rounded-md bg-[var(--bg-muted)] flex items-center justify-center text-[var(--fg-muted)]">
            <Icon className="size-4" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--fg-subtle)] mb-1">
              {typeLabel}
            </div>
            <h4 className="serif-title text-[16px] leading-snug text-[var(--color-ink-1000)] line-clamp-2">
              {title}
            </h4>
            {meta && (
              <p className="text-[12px] text-[var(--fg-muted)] mt-1">{meta}</p>
            )}
          </div>
          {documentUrl && (
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 size-7 inline-flex items-center justify-center rounded-md text-[var(--fg-subtle)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-default)] transition-colors"
              aria-label="Abrir documento original"
            >
              <ArrowUpRight className="size-4" />
            </a>
          )}
        </header>

        {snippet && (
          <p
            className="text-[13px] leading-relaxed text-[var(--fg-muted)] italic mt-3 line-clamp-4"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            «{snippet}»
          </p>
        )}

        {(periodCode || (categoryCodes && categoryCodes.length > 0)) && (
          <footer className="mt-3 flex flex-wrap items-center gap-1.5">
            {periodCode && <PeriodBadge code={periodCode} size="xs" />}
            {categoryCodes?.map((c) => (
              <CategoryChip key={c} code={c} size="xs" />
            ))}
          </footer>
        )}
      </article>
    );
  },
);
SourceCard.displayName = "SourceCard";
