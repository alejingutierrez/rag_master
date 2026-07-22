import Link from "next/link";
import { pageWindow } from "@/components/public/archive-filtering";
import "@/components/public/archive-filters.css";

/**
 * Paginación real: enlaces con la página en la URL (`?pagina=3`). Sin estado en
 * cliente, indexable y compartible. La usan el archivo y los resultados de
 * búsqueda. `hrefFor` la arma cada página conservando sus propios filtros.
 */
export function ArchivePagination({
  current,
  totalPages,
  hrefFor,
  ariaLabel = "Paginación",
}: {
  current: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  ariaLabel?: string;
}) {
  if (totalPages <= 1) return null;
  const pages = pageWindow(current, totalPages);

  return (
    <nav className="apg" aria-label={ariaLabel}>
      {current > 1 ? (
        <Link href={hrefFor(current - 1)} className="apg-step" rel="prev">
          ← Anterior
        </Link>
      ) : (
        <span className="apg-step is-off">← Anterior</span>
      )}

      <div className="apg-pages">
        {pages.map((page, index) =>
          page === null ? (
            <span key={`gap-${index}`} className="apg-gap" aria-hidden>
              ···
            </span>
          ) : page === current ? (
            <span key={page} className="apg-page is-active" aria-current="page">
              {page}
            </span>
          ) : (
            <Link key={page} href={hrefFor(page)} className="apg-page">
              {page}
            </Link>
          ),
        )}
      </div>

      {current < totalPages ? (
        <Link href={hrefFor(current + 1)} className="apg-step" rel="next">
          Siguiente →
        </Link>
      ) : (
        <span className="apg-step is-off">Siguiente →</span>
      )}
    </nav>
  );
}
