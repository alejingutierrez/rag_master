"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
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
    <div className="bg-surface border border-border rounded-lg hover:border-border-hover transition-colors">
      {/* Contenido principal */}
      <div className="p-4">
        {/* Pregunta con numero */}
        <div className="flex gap-3">
          <span className="text-xs font-bold text-primary font-mono bg-primary/10 rounded h-6 min-w-[1.75rem] flex items-center justify-center shrink-0">
            {q.questionNumber}
          </span>
          <p className="text-sm text-foreground leading-relaxed">{q.pregunta}</p>
        </div>

        {/* Clasificacion: periodo + categoria en una linea limpia */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3 ml-9">
          <PeriodBadge code={q.periodoCode} name={q.periodoNombre} range={q.periodoRango} showIcon />
          <CategoryBadge code={q.categoriaCode} name={q.categoriaNombre} showIcon />
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
            {q.subcategoriaCode}
          </span>
        </div>

        {/* Tags relacionados — compactos, solo si existen */}
        {(q.periodosRelacionados.length > 0 || q.categoriasRelacionadas.length > 0) && (
          <div className="flex flex-wrap gap-1 mt-2 ml-9">
            {q.periodosRelacionados.slice(0, 3).map((p) => {
              const c = getPeriodColor(p);
              return (
                <span key={p} className={cn("text-[10px] px-1.5 py-0.5 rounded opacity-50", c.bg, c.text)}>
                  {p}
                </span>
              );
            })}
            {q.categoriasRelacionadas.slice(0, 3).map((cat) => {
              const c = getCategoryColor(cat);
              return (
                <span key={cat} className={cn("text-[10px] px-1.5 py-0.5 rounded opacity-50", c.bg, c.text)}>
                  {cat}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: documento + justificacion */}
      <div className="border-t border-border px-4 py-2 flex items-center justify-between">
        {showDocument && q.document ? (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">{q.document.filename}</span>
          </div>
        ) : (
          <div />
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-2"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Ocultar" : "Justificacion"}
        </button>
      </div>

      {/* Justificacion expandible */}
      {expanded && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground leading-relaxed bg-muted/50 rounded-md p-3">
            {q.justificacion}
          </p>
        </div>
      )}
    </div>
  );
}
