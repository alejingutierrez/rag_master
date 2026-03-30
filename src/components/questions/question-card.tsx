"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Clock, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const periodColor = getPeriodColor(q.periodoCode);
  const catColor = getCategoryColor(q.categoriaCode);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl font-bold text-neutral-600 leading-none mt-0.5 min-w-[2rem]">
          {q.questionNumber}
        </span>
        <p className="text-sm text-white leading-relaxed flex-1">{q.pregunta}</p>
      </div>

      {/* Badges principales */}
      <div className="flex flex-wrap gap-2 mt-3">
        {/* Período */}
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium",
            periodColor.bg, periodColor.text, periodColor.border
          )}
        >
          <Clock className="h-3 w-3" />
          {q.periodoNombre}
          {q.periodoRango && (
            <span className="opacity-60 ml-1">· {q.periodoRango}</span>
          )}
        </span>

        {/* Categoría */}
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium",
            catColor.bg, catColor.text
          )}
        >
          <Tag className="h-3 w-3" />
          {q.categoriaNombre}
        </span>

        {/* Subcategoría */}
        <span className="text-xs px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-400 font-mono">
          {q.subcategoriaCode}
        </span>
      </div>

      {/* Relacionados (si hay) */}
      {(q.periodosRelacionados.length > 0 || q.categoriasRelacionadas.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {q.periodosRelacionados.slice(0, 3).map((p) => {
            const c = getPeriodColor(p);
            return (
              <span
                key={p}
                className={cn(
                  "text-xs px-2 py-0.5 rounded border text-opacity-70",
                  c.bg, c.text, c.border, "opacity-60"
                )}
              >
                {p}
              </span>
            );
          })}
          {q.categoriasRelacionadas.slice(0, 3).map((cat) => {
            const c = getCategoryColor(cat);
            return (
              <span
                key={cat}
                className={cn(
                  "text-xs px-2 py-0.5 rounded opacity-60",
                  c.bg, c.text
                )}
              >
                {cat}
              </span>
            );
          })}
        </div>
      )}

      {/* Justificación collapsible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        {expanded ? (
          <><ChevronUp className="h-3.5 w-3.5" /> Ocultar justificación</>
        ) : (
          <><ChevronDown className="h-3.5 w-3.5" /> Ver justificación</>
        )}
      </button>

      {expanded && (
        <p className="mt-2 text-xs text-neutral-400 leading-relaxed bg-neutral-800/50 rounded-lg p-3 border border-neutral-700">
          {q.justificacion}
        </p>
      )}

      {/* Documento fuente */}
      {showDocument && q.document && (
        <p className="mt-3 text-xs text-neutral-600 truncate border-t border-neutral-800 pt-2">
          📖 {q.document.filename}
        </p>
      )}
    </div>
  );
}
