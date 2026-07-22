import Link from "next/link";
import "@/components/public/archive-filters.css";

export interface ArchiveChip {
  href: string;
  label: string;
  /** Número de piezas detrás del chip. Se omite cuando no aplica. */
  count?: number | null;
  active: boolean;
  /** Punto de color (época) a la izquierda del rótulo. */
  dot?: string | null;
}

/**
 * Fila de chips-filtro. Son enlaces reales (no botones): el filtro queda en la
 * URL, se puede compartir y el botón atrás recorre los filtros aplicados.
 * La comparten el archivo (tipos de pieza) y la búsqueda (facetas por tipo).
 */
export function ArchiveChips({
  items,
  label,
  ariaLabel,
}: {
  items: ArchiveChip[];
  /** Rótulo mono a la izquierda de la fila. */
  label?: string;
  ariaLabel: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="af-chiprow">
      {label && <div className="af-rowlabel">{label}</div>}
      <nav className="af-chips" aria-label={ariaLabel}>
        {items.map((chip) => (
          <Link
            key={chip.href + chip.label}
            href={chip.href}
            className={"af-chip" + (chip.active ? " is-active" : "")}
            aria-current={chip.active ? "true" : undefined}
            scroll={false}
          >
            {chip.dot && <span className="af-chip-dot" style={{ background: chip.dot }} />}
            <span>{chip.label}</span>
            {chip.count != null && <small>{chip.count}</small>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
