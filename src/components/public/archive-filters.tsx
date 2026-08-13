"use client";

import Link from "next/link";
import { ArchiveChips, type ArchiveChip } from "@/components/public/archive-chips";
import {
  ARCHIVE_ORDERS,
  DEFAULT_ORDER,
  archiveHref,
  formatNumber,
} from "@/components/public/archive-filtering";
import "@/components/public/archive-filters.css";

export interface ArchiveTypeFacet {
  slug: string;
  plural: string;
  count: number;
}

/**
 * Barra de filtros del archivo: tipo de pieza y orden. Cada control
 * escribe en la URL (`?tipo=&periodo=&orden=`) y siempre devuelve a la página 1;
 * el listado se resuelve en el servidor. La época vive en el selector canónico
 * compartido por todas las secciones públicas.
 */
export function ArchiveFilters({
  basePath,
  tipo,
  periodo,
  orden,
  typeFacets,
  total,
  totalAll,
}: {
  basePath: string;
  tipo: string | null;
  periodo: string | null;
  orden: string;
  typeFacets: ArchiveTypeFacet[];
  total: number;
  totalAll: number;
}) {
  const ordenParam = orden === DEFAULT_ORDER ? null : orden;

  const hrefFor = (patch: { tipo?: string | null; periodo?: string | null; orden?: string | null }) =>
    archiveHref(basePath, {
      tipo: patch.tipo !== undefined ? patch.tipo : tipo,
      periodo: patch.periodo !== undefined ? patch.periodo : periodo,
      orden: patch.orden !== undefined ? patch.orden : ordenParam,
    });

  const typeChips: ArchiveChip[] = [
    { href: hrefFor({ tipo: null }), label: "Todo", count: totalAll, active: tipo === null },
    ...typeFacets.map((facet) => ({
      href: hrefFor({ tipo: facet.slug }),
      label: facet.plural,
      count: facet.count,
      active: tipo === facet.slug,
    })),
  ];

  const filtrando = tipo !== null || periodo !== null;

  return (
    <div className="af-bar">
      <ArchiveChips items={typeChips} label="Tipo" ariaLabel="Filtrar por tipo de pieza" />

      <div className="af-foot">
        <div className="af-count">
          {filtrando
            ? `${formatNumber(total)} de ${formatNumber(totalAll)} piezas`
            : `${formatNumber(totalAll)} piezas publicadas`}
          {filtrando && (
            <>
              {" · "}
              <Link href={archiveHref(basePath, { orden: ordenParam })} className="af-clear" scroll={false}>
                Limpiar filtros
              </Link>
            </>
          )}
        </div>
        <div className="af-orders">
          <span className="af-rowlabel">Orden</span>
          {ARCHIVE_ORDERS.map((option) => (
            <Link
              key={option.slug}
              href={hrefFor({ orden: option.slug === DEFAULT_ORDER ? null : option.slug })}
              className={"af-order" + (option.slug === orden ? " is-active" : "")}
              aria-current={option.slug === orden ? "true" : undefined}
              title={option.note}
              scroll={false}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
