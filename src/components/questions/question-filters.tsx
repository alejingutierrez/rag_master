"use client";

import { Search, X } from "lucide-react";

export interface FilterState {
  documentId: string;
  periodo: string;
  categoria: string;
  search: string;
}

interface QuestionFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  documents: { id: string; filename: string }[];
  periodos: { code: string; nombre: string }[];
  categorias: { code: string; nombre: string }[];
}

const PERIOD_OPTIONS = [
  { code: "PRE", nombre: "Prehispanico" },
  { code: "CON", nombre: "Conquista y Colonia Temprana" },
  { code: "COL", nombre: "Colonia Madura" },
  { code: "PRE_IND", nombre: "Crisis Colonial" },
  { code: "IND", nombre: "Independencia" },
  { code: "NGR", nombre: "Nueva Granada" },
  { code: "EUC", nombre: "Est. Unidos de Colombia" },
  { code: "REG", nombre: "Regeneracion" },
  { code: "REP_LIB", nombre: "Republica Liberal" },
  { code: "VIO", nombre: "La Violencia" },
  { code: "FN", nombre: "Frente Nacional" },
  { code: "CNA", nombre: "Crisis y Narcotrafico" },
  { code: "C91", nombre: "Constitucion del 91" },
  { code: "SDE", nombre: "Seguridad Democratica" },
  { code: "POS", nombre: "Posconflicto" },
  { code: "TRANS", nombre: "Transversal" },
];

const CATEGORY_OPTIONS = [
  { code: "POL", nombre: "Politica y Estado" },
  { code: "ECO", nombre: "Economia y Desarrollo" },
  { code: "CON", nombre: "Conflicto Armado" },
  { code: "SOC", nombre: "Sociedad" },
  { code: "CUL", nombre: "Cultura e Ideologia" },
  { code: "REL", nombre: "Relaciones Internacionales" },
  { code: "TER", nombre: "Territorio y Ambiente" },
  { code: "MOV", nombre: "Movimientos Sociales" },
  { code: "INS", nombre: "Instituciones y Justicia" },
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

  const selectClass = "w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-ring";

  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
      {/* Busqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar en preguntas..."
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="w-full pl-9 pr-4 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring"
        />
      </div>

      <select value={filters.documentId} onChange={(e) => update({ documentId: e.target.value })} className={selectClass}>
        <option value="">Todos los documentos</option>
        {documents.map((d) => (
          <option key={d.id} value={d.id}>
            {d.filename.length > 50 ? d.filename.slice(0, 50) + "..." : d.filename}
          </option>
        ))}
      </select>

      <select value={filters.periodo} onChange={(e) => update({ periodo: e.target.value })} className={selectClass}>
        <option value="">Todos los periodos</option>
        {PERIOD_OPTIONS.map((p) => (
          <option key={p.code} value={p.code}>{p.code} — {p.nombre}</option>
        ))}
      </select>

      <select value={filters.categoria} onChange={(e) => update({ categoria: e.target.value })} className={selectClass}>
        <option value="">Todas las categorias</option>
        {CATEGORY_OPTIONS.map((c) => (
          <option key={c.code} value={c.code}>{c.code} — {c.nombre}</option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={() => onFiltersChange({ documentId: "", periodo: "", categoria: "", search: "" })}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
