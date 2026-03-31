"use client";

import { Search, X } from "lucide-react";
import { getDocumentDisplayName } from "@/lib/enrichment-types";

export interface FilterState {
  documentId: string;
  periodo: string;
  categoria: string;
  search: string;
}

interface QuestionFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  documents: { id: string; filename: string; metadata?: Record<string, unknown> }[];
  periodos: { code: string; nombre: string }[];
  categorias: { code: string; nombre: string }[];
}

const PERIOD_OPTIONS = [
  { code: "PRE", nombre: "Prehispanico" },
  { code: "CON", nombre: "Conquista" },
  { code: "COL", nombre: "Colonia" },
  { code: "PRE_IND", nombre: "Crisis Colonial" },
  { code: "IND", nombre: "Independencia" },
  { code: "NGR", nombre: "Nueva Granada" },
  { code: "EUC", nombre: "E.U. Colombia" },
  { code: "REG", nombre: "Regeneracion" },
  { code: "REP_LIB", nombre: "Rep. Liberal" },
  { code: "VIO", nombre: "La Violencia" },
  { code: "FN", nombre: "Frente Nacional" },
  { code: "CNA", nombre: "Narcotrafico" },
  { code: "C91", nombre: "Const. 91" },
  { code: "SDE", nombre: "Seg. Democratica" },
  { code: "POS", nombre: "Posconflicto" },
  { code: "TRANS", nombre: "Transversal" },
];

const CATEGORY_OPTIONS = [
  { code: "POL", nombre: "Politica" },
  { code: "ECO", nombre: "Economia" },
  { code: "CON", nombre: "Conflicto" },
  { code: "SOC", nombre: "Sociedad" },
  { code: "CUL", nombre: "Cultura" },
  { code: "REL", nombre: "Relaciones Int." },
  { code: "TER", nombre: "Territorio" },
  { code: "MOV", nombre: "Movimientos" },
  { code: "INS", nombre: "Instituciones" },
  { code: "HIS", nombre: "Historiografia" },
];

export function QuestionFilters({
  filters,
  onFiltersChange,
  documents,
}: QuestionFiltersProps) {
  const hasFilters =
    filters.documentId || filters.periodo || filters.categoria || filters.search;

  const update = (partial: Partial<FilterState>) =>
    onFiltersChange({ ...filters, ...partial });

  const selectClass = "h-8 px-2.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-ring min-w-0";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Busqueda */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar..."
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="h-8 w-44 pl-8 pr-3 bg-surface border border-border rounded-md text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring"
        />
      </div>

      <select value={filters.documentId} onChange={(e) => update({ documentId: e.target.value })} className={selectClass}>
        <option value="">Documento</option>
        {documents.map((d) => (
          <option key={d.id} value={d.id}>
            {(() => { const name = getDocumentDisplayName(d); return name.length > 40 ? name.slice(0, 40) + "..." : name; })()}
          </option>
        ))}
      </select>

      <select value={filters.periodo} onChange={(e) => update({ periodo: e.target.value })} className={selectClass}>
        <option value="">Periodo</option>
        {PERIOD_OPTIONS.map((p) => (
          <option key={p.code} value={p.code}>{p.nombre}</option>
        ))}
      </select>

      <select value={filters.categoria} onChange={(e) => update({ categoria: e.target.value })} className={selectClass}>
        <option value="">Categoria</option>
        {CATEGORY_OPTIONS.map((c) => (
          <option key={c.code} value={c.code}>{c.nombre}</option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={() => onFiltersChange({ documentId: "", periodo: "", categoria: "", search: "" })}
          className="h-8 px-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-surface-hover transition-colors"
          title="Limpiar filtros"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
