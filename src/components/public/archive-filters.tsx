"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PeriodSelector } from "@/components/public/period-selector";
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
 * Barra de filtros del archivo: tipo de pieza, época y orden. Cada control
 * escribe en la URL (`?tipo=&periodo=&orden=`) y siempre devuelve a la página 1;
 * el listado se resuelve en el servidor. La época usa la misma cinta cronológica
 * que la línea de tiempo y los demás índices — un solo sistema visual.
 */
export function ArchiveFilters({
  basePath,
  tipo,
  periodo,
  orden,
  typeFacets,
  periodsPresent,
  total,
  totalAll,
}: {
  basePath: string;
  tipo: string | null;
  periodo: string | null;
  orden: string;
  typeFacets: ArchiveTypeFacet[];
  periodsPresent: string[];
  total: number;
  totalAll: number;
}) {
  const router = useRouter();
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

      {periodsPresent.length > 1 && (
        <div className="af-ribbon">
          <PeriodSelector
            present={new Set(periodsPresent)}
            selected={periodo}
            onSelect={(code) => router.push(hrefFor({ periodo: code }), { scroll: false })}
          />
        </div>
      )}

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
