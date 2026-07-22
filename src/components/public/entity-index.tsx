"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchInput } from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import { PeriodSelector } from "@/components/public/period-selector";
import { useUrlState } from "@/lib/use-url-state";
import type { PublicEntity } from "@/lib/public-data";
import "@/components/public/typology-index.css";
import "@/components/public/wiki.css";
import { imageAt } from "@/lib/image-url";

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Inicial normalizada (A–Z) de un nombre; lo que no sea letra cae en «#». */
function inicialDe(name: string): string {
  const c = norm(name).trim().charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

/** Inicial tal cual se ve (con tilde) — solo para el marcador sin imagen. */
function inicialVisible(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "·";
}

/**
 * Índice filtrable de entidades de un tipo (personas / lugares / ideas).
 *
 * Solo se listan entidades con su propia pieza publicada, así que son pocas y
 * casi todas traen portada: la rejilla se arma con la imagen producida de cada
 * una. Dos organizaciones posibles:
 *   · por ÉPOCA (personas · ideas), con la cinta cronológica compartida;
 *   · ALFABÉTICA (lugares), porque un lugar no pertenece a una época — Bogotá
 *     atraviesa todo el archivo. Se cambia con `showPeriodFilter`.
 */
export function EntityBrowser({
  entities,
  kicker,
  title,
  intro,
  emptyNote,
  typeLabel,
  color,
  total,
  showPeriodFilter = true,
}: {
  entities: PublicEntity[];
  kicker: string;
  title: string;
  intro: string;
  emptyNote: string;
  typeLabel: string;
  color: string;
  /** Tamaño total del directorio conectado (para vistas filtradas por época). */
  total?: number;
  /** false → sin épocas: orden alfabético + filtro por inicial (lugares). */
  showPeriodFilter?: boolean;
}) {
  const [periodo, setPeriodo] = useUrlState<string | null>({
    key: "periodo",
    default: null,
    debounceMs: 0,
  });
  const [inicial, setInicial] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // Épocas presentes, en orden cronológico (por el periodoOrden mínimo de la entidad).
  const periods = useMemo(() => {
    if (!showPeriodFilter) return [];
    const seen = new Map<string, number>();
    for (const e of entities) {
      for (const code of e.periods) {
        if (!seen.has(code)) seen.set(code, e.periodoOrden);
      }
    }
    return [...seen.entries()]
      .sort((a, b) => (PERIODS[a[0] as PeriodCode] ? 0 : 1) - (PERIODS[b[0] as PeriodCode] ? 0 : 1) || a[1] - b[1])
      .map(([code]) => code)
      .filter((code) => PERIODS[code as PeriodCode]);
  }, [entities, showPeriodFilter]);

  // Iniciales presentes (solo en el modo alfabético).
  const letters = useMemo(() => {
    if (showPeriodFilter) return [];
    const seen = new Set<string>();
    for (const e of entities) seen.add(inicialDe(e.name));
    return [...seen].sort((a, b) => a.localeCompare(b, "es"));
  }, [entities, showPeriodFilter]);

  const selectedPeriodo = showPeriodFilter && periodo && periods.includes(periodo) ? periodo : null;
  const selectedInicial = !showPeriodFilter && inicial && letters.includes(inicial) ? inicial : null;
  const nq = norm(q.trim());

  const filtered = useMemo(() => {
    const list = entities.filter((e) => {
      if (selectedPeriodo && !e.periods.includes(selectedPeriodo)) return false;
      if (selectedInicial && inicialDe(e.name) !== selectedInicial) return false;
      if (nq && !norm(`${e.name} ${e.resumen ?? ""}`).includes(nq)) return false;
      return true;
    });
    // Sin épocas el orden es alfabético: es la única jerarquía honesta para un lugar.
    if (!showPeriodFilter) list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return list;
  }, [entities, selectedPeriodo, selectedInicial, nq, showPeriodFilter]);

  const hasFilter = selectedPeriodo != null || selectedInicial != null || q.trim().length > 0;
  const showFilters = entities.length >= 6 || hasFilter;

  // Rótulo del conteo. Al elegir época la página se recarga ya filtrada en el
  // servidor, así que ahí "N de N" no diría nada: se nombra la selección.
  const rotulo =
    nq || selectedInicial
      ? `${filtered.length} de ${entities.length}`
      : selectedPeriodo
        ? `${filtered.length} en esta época`
        : total && total > entities.length
          ? `${entities.length.toLocaleString("es-CO")} en esta selección · ${total.toLocaleString("es-CO")} en el archivo`
          : `${entities.length} con historia propia`;

  const limpiar = () => {
    setPeriodo(null);
    setInicial(null);
    setQ("");
  };

  return (
    <div className="tix-wrap">
      <header className="tix-head">
        <div className="tix-kick">{kicker}</div>
        <h1 className="tix-title">{title}</h1>
        <p className="tix-intro">{intro}</p>
      </header>

      {showFilters && (
        <div className="tix-filters">
          {showPeriodFilter && periods.length >= 1 && (
            <PeriodSelector present={new Set(periods)} selected={selectedPeriodo} onSelect={setPeriodo} />
          )}
          {!showPeriodFilter && letters.length > 1 && (
            <div className="ent-alpha">
              <div className="ent-alpha-head">
                <div className="ent-alpha-label">Filtrar por inicial</div>
                <div className="ent-alpha-cap">
                  {selectedInicial ? `Inicial ${selectedInicial}` : "Todas las iniciales"}
                </div>
              </div>
              <div className="ent-alpha-row" role="group" aria-label="Filtrar por inicial">
                {letters.map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={"ent-letter" + (l === selectedInicial ? " is-on" : "")}
                    aria-pressed={l === selectedInicial}
                    onClick={() => setInicial(selectedInicial === l ? null : l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="tix-searchrow">
            <SearchInput value={q} onChange={setQ} placeholder={`Buscar ${title.toLowerCase()}…`} width={260} />
          </div>
        </div>
      )}

      <div className="tix-count">{rotulo}</div>

      {entities.length === 0 ? (
        <div className="tix-empty">{emptyNote}</div>
      ) : filtered.length === 0 ? (
        <div className="tix-empty">
          Nada coincide con el filtro.{" "}
          <button type="button" className="tix-clear" onClick={limpiar}>
            Limpiar
          </button>
        </div>
      ) : (
        <ul className="ent-grid">
          {filtered.map((e) => (
            <li key={e.slug} className="ent-card">
              <Link href={e.href}>
                {/* La portada de la pieza dedicada es el retrato/vista de la entidad. */}
                <div className={"ent-fig" + (e.type === "persona" ? " is-retrato" : "")}>
                  {e.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={imageAt(e.imageUrl, 480)!} alt={e.name} loading="lazy" />
                  ) : (
                    <span className="ent-fig-ph" aria-hidden>
                      {inicialVisible(e.name)}
                    </span>
                  )}
                </div>
                <div className="ent-body">
                  <div className="ent-kmeta">
                    <span className="dot" style={{ background: color }} />
                    {typeLabel}
                    {e.mentions > 0
                      ? ` · ${e.mentions} ${e.mentions === 1 ? "aparición" : "apariciones"}`
                      : ""}
                  </div>
                  <div className="ent-name">{e.name}</div>
                  {e.resumen && <div className="ent-sum">{e.resumen}</div>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
