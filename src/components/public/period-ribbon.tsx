"use client";

import type { CSSProperties } from "react";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import "@/components/public/period-ribbon.css";

/**
 * Cinta cronológica de época — el ÚNICO control de época del sitio público.
 *
 * Una sola fila: cada período es una barra (que ES el control) con su etiqueta
 * corta debajo; la activa crece y toma su color. Reemplaza el apilado de tres
 * filas (años + barras + pills) que se usaba antes. Unifica las cuatro
 * superficies — épocas, línea de tiempo, personas y ensayos — en un solo gesto.
 *
 * Dos modos:
 *   · "filter" — el índice filtra; incluye "Todas" y clic en la activa la quita.
 *   · "nav"    — la línea de tiempo navega; siempre hay una seleccionada.
 */
export function PeriodRibbon({
  order,
  selected,
  onSelect,
  label,
  mode = "filter",
}: {
  /** Períodos a mostrar, ya en orden cronológico. */
  order: PeriodCode[];
  selected: string | null;
  onSelect: (code: string | null) => void;
  /** Rótulo a la izquierda de la cabecera (opcional). */
  label?: string;
  mode?: "filter" | "nav";
}) {
  const sel = selected && order.includes(selected as PeriodCode) ? (selected as PeriodCode) : null;
  const selInfo = sel ? PERIODS[sel] : null;

  const click = (code: PeriodCode) => {
    if (mode === "filter") onSelect(selected === code ? null : code);
    else onSelect(code);
  };

  return (
    <div className="pr-wrap">
      <div className="pr-head">
        {label && <div className="pr-label">{label}</div>}
        <div
          className="pr-cap"
          style={{ color: selInfo ? `var(--p-${selInfo.slug})` : "var(--fg-muted)" }}
        >
          {selInfo ? `${selInfo.label} · ${selInfo.yearRange}` : "Todas las épocas"}
        </div>
      </div>

      <div className="pr-rib" role="group" aria-label={label ?? "Época"}>
        {order.map((code) => {
          const p = PERIODS[code];
          const active = code === sel;
          return (
            <button
              key={code}
              type="button"
              className={"pr-seg" + (active ? " is-on" : "")}
              style={{ "--pc": `var(--p-${p.slug})` } as CSSProperties}
              onClick={() => click(code)}
              aria-pressed={active}
              title={`${p.label} · ${p.yearRange}`}
              aria-label={`${p.label}, ${p.yearRange}`}
            >
              <span className="pr-bar" />
              <span className="pr-lab">{p.short}</span>
            </button>
          );
        })}
      </div>

      {mode === "filter" && (
        <div className="pr-foot">
          <button
            type="button"
            className="pr-reset"
            onClick={() => onSelect(null)}
            disabled={selected === null}
          >
            {selected === null ? "Mostrando todas las épocas" : "Ver todas las épocas"}
          </button>
        </div>
      )}
    </div>
  );
}
