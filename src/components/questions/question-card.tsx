"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { PeriodBadge } from "@/components/domain/period-badge";
import { CategoryBadge } from "@/components/domain/category-badge";
import { getPeriodColor, getCategoryColor } from "./period-colors";

interface QuestionCardProps {
  question: {
    id: string;
    questionNumber: number;
    pregunta: string;
    periodoCode: string;
    periodoNombre: string;
    periodoRango: string;
    categoriaCode: string;
    categoriaNombre: string;
    subcategoriaCode: string;
    subcategoriaNombre: string;
    periodosRelacionados: string[];
    categoriasRelacionadas: string[];
    justificacion: string;
    document?: { filename: string };
    createdAt?: string;
  };
  showDocument?: boolean;
}

export function QuestionCard({ question: q, showDocument = true }: QuestionCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-surface border border-border rounded-lg p-5 hover:border-border-hover transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl font-bold text-muted-foreground/40 leading-none mt-0.5 min-w-[2rem] font-mono">
          {q.questionNumber}
        </span>
        <p className="text-sm text-foreground leading-relaxed flex-1">{q.pregunta}</p>
      </div>

      {/* Badges principales */}
      <div className="flex flex-wrap gap-2 mt-3">
        <PeriodBadge code={q.periodoCode} name={q.periodoNombre} range={q.periodoRango} showIcon />
        <CategoryBadge code={q.categoriaCode} name={q.categoriaNombre} showIcon />
        <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-mono">
          {q.subcategoriaCode}
        </span>
      </div>

      {/* Relacionados */}
      {(q.periodosRelacionados.length > 0 || q.categoriasRelacionadas.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {q.periodosRelacionados.slice(0, 3).map((p) => {
            const c = getPeriodColor(p);
            return (
              <span key={p} className={cn("text-xs px-2 py-0.5 rounded border opacity-60", c.bg, c.text, c.border)}>
                {p}
              </span>
            );
          })}
          {q.categoriasRelacionadas.slice(0, 3).map((cat) => {
            const c = getCategoryColor(cat);
            return (
              <span key={cat} className={cn("text-xs px-2 py-0.5 rounded opacity-60", c.bg, c.text)}>
                {cat}
              </span>
            );
          })}
        </div>
      )}

      {/* Justificacion */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? (
          <><ChevronUp className="h-3.5 w-3.5" /> Ocultar justificacion</>
        ) : (
          <><ChevronDown className="h-3.5 w-3.5" /> Ver justificacion</>
        )}
      </button>

      {expanded && (
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed bg-muted/50 rounded-lg p-3 border border-border">
          {q.justificacion}
        </p>
      )}

      {/* Documento fuente */}
      {showDocument && q.document && (
        <p className="mt-3 text-xs text-muted-foreground truncate border-t border-border pt-2">
          {q.document.filename}
        </p>
      )}
    </div>
  );
}
