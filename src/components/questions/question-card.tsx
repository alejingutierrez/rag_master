"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { PeriodBadge } from "@/components/domain/period-badge";
import { CategoryBadge } from "@/components/domain/category-badge";
import { getPeriodColor, getCategoryColor } from "./period-colors";
import { getDocumentDisplayName } from "@/lib/enrichment-types";
import { DeliverableBadges } from "@/components/deliverables/deliverable-badges";

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
    document?: { filename: string; metadata?: Record<string, unknown> };
    deliverables?: { id: string; templateId: string; status: string }[];
    createdAt?: string;
    ordenPeriodo?: number | null;
    ordenCategoria?: number | null;
    ordenSubcategoria?: number | null;
    temaPeriodo?: string | null;
    temaCategoria?: string | null;
    temaSubcategoria?: string | null;
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
          {q.ordenPeriodo != null && (
            <span className="text-[9px] font-mono text-primary/60 -ml-0.5">#{q.ordenPeriodo}</span>
          )}
          <CategoryBadge code={q.categoriaCode} name={q.categoriaNombre} showIcon />
          {q.ordenCategoria != null && (
            <span className="text-[9px] font-mono text-primary/60 -ml-0.5">#{q.ordenCategoria}</span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
            {q.subcategoriaCode}
          </span>
          {q.ordenSubcategoria != null && (
            <span className="text-[9px] font-mono text-primary/60 -ml-0.5">#{q.ordenSubcategoria}</span>
          )}
        </div>

        {/* Temas asignados por el ordenamiento inteligente */}
        {(q.temaPeriodo || q.temaCategoria || q.temaSubcategoria) && (
          <div className="flex flex-wrap gap-1.5 mt-1.5 ml-9">
            {q.temaPeriodo && (
              <span className="text-[10px] italic text-muted-foreground/70">{q.temaPeriodo}</span>
            )}
            {q.temaCategoria && q.temaCategoria !== q.temaPeriodo && (
              <>
                <span className="text-[10px] text-muted-foreground/40">|</span>
                <span className="text-[10px] italic text-muted-foreground/70">{q.temaCategoria}</span>
              </>
            )}
            {q.temaSubcategoria && q.temaSubcategoria !== q.temaCategoria && (
              <>
                <span className="text-[10px] text-muted-foreground/40">|</span>
                <span className="text-[10px] italic text-muted-foreground/70">{q.temaSubcategoria}</span>
              </>
            )}
          </div>
        )}

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

      {/* Deliverable badges */}
      {q.deliverables && q.deliverables.length > 0 && (
        <div className="px-4 pb-2">
          <DeliverableBadges deliverables={q.deliverables} />
        </div>
      )}

      {/* Footer: documento + justificacion */}
      <div className="border-t border-border px-4 py-2 flex items-center justify-between">
        {showDocument && q.document ? (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">{getDocumentDisplayName(q.document)}</span>
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
