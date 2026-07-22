"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchInput } from "@/components/editorial";
import { getPeriodColor } from "@/lib/design-tokens";
import { PeriodSelector } from "@/components/public/period-selector";
import { useUrlState } from "@/lib/use-url-state";
import { imageAt } from "@/lib/image-url";
import type { TypologyCard } from "@/lib/public-data";

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function haystack(c: TypologyCard): string {
  return norm(
    [
      c.titulo,
      c.resumen,
      c.meta ?? "",
      ...c.entidades.personas,
      ...c.entidades.lugares,
      ...c.entidades.ideas,
    ].join(" "),
  );
}

/**
 * Índice filtrable de fichas — filtra por ÉPOCA (chips) y por texto, conservando
 * el orden cronológico que ya trae `cards`. Cliente; la cabecera vive en el server.
 */
export function TypologyBrowser({
  cards,
  emptyNote,
}: {
  cards: TypologyCard[];
  emptyNote: string;
}) {
  const [periodo, setPeriodo] = useUrlState<string | null>({
    key: "periodo",
    default: null,
    debounceMs: 0,
  });
  const [q, setQ] = useState("");

  // Épocas presentes, en el orden cronológico de las tarjetas.
  const periods = useMemo(() => {
    const seen = new Map<string, number>();
    for (const c of cards) {
      if (c.periodCode && !seen.has(c.periodCode)) seen.set(c.periodCode, c.periodoOrden);
    }
    return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([code]) => code);
  }, [cards]);

  const selectedPeriodo = periodo && periods.includes(periodo) ? periodo : null;
  const nq = norm(q.trim());
  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (selectedPeriodo && c.periodCode !== selectedPeriodo) return false;
      if (nq && !haystack(c).includes(nq)) return false;
      return true;
    });
  }, [cards, selectedPeriodo, nq]);

  const showFilters = cards.length >= 4 || selectedPeriodo != null || q.trim().length > 0;

  return (
    <>
      {showFilters && (
        <div className="tix-filters">
          {periods.length >= 1 && (
            <PeriodSelector present={new Set(periods)} selected={selectedPeriodo} onSelect={setPeriodo} />
          )}
          <div className="tix-searchrow">
            <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre, entidad…" width={260} />
          </div>
        </div>
      )}

      <div className="tix-count">
        {selectedPeriodo || nq
          ? `${filtered.length} de ${cards.length}`
          : filtered.length === cards.length
          ? `${cards.length} ${cards.length === 1 ? "publicada" : "publicadas"}`
          : `${filtered.length} de ${cards.length}`}
      </div>

      {cards.length === 0 ? (
        <div className="tix-empty">{emptyNote}</div>
      ) : filtered.length === 0 ? (
        <div className="tix-empty">
          Nada coincide con el filtro. <button type="button" className="tix-clear" onClick={() => { setPeriodo(null); setQ(""); }}>Limpiar</button>
        </div>
      ) : (
        <ul className="tix-grid">
          {filtered.map((c) => {
            const dot = c.periodCode ? getPeriodColor(c.periodCode) : "var(--fg-dim)";
            return (
              <li key={c.id} className="tix-card">
                <Link href={c.href}>
                  {c.imageUrl && (
                    <div className="tix-thumb">
                      {/* Miniatura de rejilla: se pide al ancho real, no la portada
                          entera (el índice de hechos son 200+ tarjetas). */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageAt(c.imageUrl, 480)!} alt={c.titulo} loading="lazy" />
                    </div>
                  )}
                  <div className="tix-kmeta">
                    <span className="tix-dot" style={{ background: dot }} />
                    {c.meta ?? " "}
                  </div>
                  <div className="tix-ct">{c.titulo}</div>
                  {c.resumen && <div className="tix-cr">{c.resumen}</div>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
