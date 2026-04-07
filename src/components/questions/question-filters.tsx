"use client";

import { Search, X } from "lucide-react";
import { getDocumentDisplayName } from "@/lib/enrichment-types";

export interface FilterState {
  documentId: string;
  periodo: string;
  categoria: string;
  subcategoria: string;
  search: string;
  sortBy: string;
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

const SUBCATEGORY_OPTIONS: Record<string, { code: string; nombre: string }[]> = {
  POL: [
    { code: "POL.FOR", nombre: "Formas de Estado" },
    { code: "POL.REG", nombre: "Regimenes politicos" },
    { code: "POL.PAR", nombre: "Partidos politicos" },
    { code: "POL.ELE", nombre: "Elecciones" },
    { code: "POL.CON", nombre: "Constituciones" },
    { code: "POL.DES", nombre: "Descentralizacion" },
    { code: "POL.COR", nombre: "Corrupcion" },
    { code: "POL.MIL", nombre: "Militarismo" },
    { code: "POL.REF", nombre: "Reformas" },
    { code: "POL.OPO", nombre: "Oposicion" },
  ],
  ECO: [
    { code: "ECO.AGR", nombre: "Agricultura" },
    { code: "ECO.EXT", nombre: "Extractivismo" },
    { code: "ECO.EXP", nombre: "Exportaciones" },
    { code: "ECO.IND", nombre: "Industria" },
    { code: "ECO.FIS", nombre: "Politica fiscal" },
    { code: "ECO.MON", nombre: "Moneda y banca" },
    { code: "ECO.LAB", nombre: "Trabajo" },
    { code: "ECO.INF", nombre: "Infraestructura" },
    { code: "ECO.APE", nombre: "Apertura economica" },
    { code: "ECO.DES", nombre: "Desigualdad" },
  ],
  CON: [
    { code: "CON.GCI", nombre: "Guerras civiles" },
    { code: "CON.VIO", nombre: "La Violencia" },
    { code: "CON.GUE", nombre: "Guerrillas" },
    { code: "CON.PAR", nombre: "Paramilitarismo" },
    { code: "CON.NAR", nombre: "Narcotrafico" },
    { code: "CON.DES", nombre: "Desplazamiento" },
    { code: "CON.PAZ", nombre: "Procesos de paz" },
    { code: "CON.JTR", nombre: "Justicia transicional" },
    { code: "CON.MEM", nombre: "Memoria historica" },
    { code: "CON.DDH", nombre: "Derechos humanos" },
    { code: "CON.GEO", nombre: "Geografia del conflicto" },
  ],
  SOC: [
    { code: "SOC.CLA", nombre: "Clases sociales" },
    { code: "SOC.RAZ", nombre: "Raza y etnicidad" },
    { code: "SOC.IND", nombre: "Pueblos indigenas" },
    { code: "SOC.AFR", nombre: "Comunidades afro" },
    { code: "SOC.GEN", nombre: "Genero" },
    { code: "SOC.URB", nombre: "Urbanizacion" },
    { code: "SOC.RUR", nombre: "Mundo rural" },
    { code: "SOC.MIG", nombre: "Migracion" },
    { code: "SOC.DEM", nombre: "Demografia" },
    { code: "SOC.EDU", nombre: "Educacion" },
    { code: "SOC.FAM", nombre: "Familia" },
  ],
  CUL: [
    { code: "CUL.IDE", nombre: "Ideologias" },
    { code: "CUL.REL", nombre: "Religion" },
    { code: "CUL.LIT", nombre: "Literatura" },
    { code: "CUL.ART", nombre: "Artes" },
    { code: "CUL.PER", nombre: "Periodismo" },
    { code: "CUL.INT", nombre: "Intelectuales" },
    { code: "CUL.POP", nombre: "Cultura popular" },
    { code: "CUL.CIE", nombre: "Ciencia" },
    { code: "CUL.LEN", nombre: "Lenguas" },
  ],
  REL: [
    { code: "REL.ESP", nombre: "Rel. con Espana" },
    { code: "REL.USA", nombre: "Rel. con EE.UU." },
    { code: "REL.LAT", nombre: "Latinoamerica" },
    { code: "REL.EUR", nombre: "Europa" },
    { code: "REL.GFR", nombre: "Guerra Fria" },
    { code: "REL.PAN", nombre: "Panama" },
    { code: "REL.FRO", nombre: "Fronteras" },
    { code: "REL.COM", nombre: "Comercio ext." },
    { code: "REL.ORI", nombre: "Oriente" },
    { code: "REL.MUL", nombre: "Multilateralismo" },
  ],
  TER: [
    { code: "TER.REG", nombre: "Regiones" },
    { code: "TER.FRO", nombre: "Fronteras" },
    { code: "TER.GEO", nombre: "Geografia" },
    { code: "TER.AMB", nombre: "Medio ambiente" },
    { code: "TER.TIE", nombre: "Tenencia de tierra" },
    { code: "TER.COC", nombre: "Colonizacion" },
    { code: "TER.RES", nombre: "Resguardos" },
    { code: "TER.CIU", nombre: "Ciudades" },
  ],
  MOV: [
    { code: "MOV.OBR", nombre: "Obrero" },
    { code: "MOV.CAM", nombre: "Campesino" },
    { code: "MOV.EST", nombre: "Estudiantil" },
    { code: "MOV.CIV", nombre: "Civico" },
    { code: "MOV.ETN", nombre: "Etnico" },
    { code: "MOV.MUJ", nombre: "De mujeres" },
    { code: "MOV.PAZ", nombre: "Por la paz" },
    { code: "MOV.AMB", nombre: "Ambiental" },
    { code: "MOV.DIG", nombre: "Digital" },
    { code: "MOV.PLE", nombre: "Plebiscitos" },
  ],
  INS: [
    { code: "INS.JUD", nombre: "Justicia" },
    { code: "INS.MIL", nombre: "Fuerzas militares" },
    { code: "INS.POL", nombre: "Policia" },
    { code: "INS.IGE", nombre: "Iglesia" },
    { code: "INS.UNI", nombre: "Universidad" },
    { code: "INS.BUR", nombre: "Burocracia" },
    { code: "INS.TIE", nombre: "Tierras" },
    { code: "INS.BAN", nombre: "Banca central" },
    { code: "INS.MED", nombre: "Medios" },
  ],
  HIS: [
    { code: "HIS.MAR", nombre: "Marxista" },
    { code: "HIS.ACA", nombre: "Academia" },
    { code: "HIS.OFI", nombre: "Historia oficial" },
    { code: "HIS.NUE", nombre: "Nueva historia" },
    { code: "HIS.ORA", nombre: "Historia oral" },
    { code: "HIS.REG", nombre: "Historia regional" },
    { code: "HIS.COM", nombre: "Comparada" },
    { code: "HIS.MEM", nombre: "Memoria" },
    { code: "HIS.FUE", nombre: "Fuentes" },
  ],
};

export function QuestionFilters({
  filters,
  onFiltersChange,
  documents,
}: QuestionFiltersProps) {
  const hasFilters =
    filters.documentId || filters.periodo || filters.categoria || filters.subcategoria || filters.search || filters.sortBy;

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

      <select
        value={filters.categoria}
        onChange={(e) => {
          const newCat = e.target.value;
          update({ categoria: newCat, subcategoria: "" });
        }}
        className={selectClass}
      >
        <option value="">Categoria</option>
        {CATEGORY_OPTIONS.map((c) => (
          <option key={c.code} value={c.code}>{c.nombre}</option>
        ))}
      </select>

      {filters.categoria && SUBCATEGORY_OPTIONS[filters.categoria] && (
        <select value={filters.subcategoria} onChange={(e) => update({ subcategoria: e.target.value })} className={selectClass}>
          <option value="">Subcategoria</option>
          {SUBCATEGORY_OPTIONS[filters.categoria].map((s) => (
            <option key={s.code} value={s.code}>{s.nombre}</option>
          ))}
        </select>
      )}

      {/* Separador visual */}
      <div className="w-px h-5 bg-border mx-0.5" />

      <select value={filters.sortBy} onChange={(e) => update({ sortBy: e.target.value })} className={selectClass}>
        <option value="">Recientes</option>
        <option value="periodo">Por periodo</option>
        <option value="categoria">Por categoria</option>
        <option value="subcategoria">Por subcategoria</option>
      </select>

      {hasFilters && (
        <button
          onClick={() => onFiltersChange({ documentId: "", periodo: "", categoria: "", subcategoria: "", search: "", sortBy: "" })}
          className="h-8 px-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-surface-hover transition-colors"
          title="Limpiar filtros"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
