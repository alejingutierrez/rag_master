"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  HISTORICAL_PERIODS,
  PERIODS,
  getPeriodColor,
  type PeriodCode,
} from "@/lib/design-tokens";
import "@/components/public/home/home-redesign.css";

type PeriodDestination =
  | "home"
  | "hechos"
  | "epocas"
  | "ensayos"
  | "personas"
  | "lugares"
  | "ideas"
  | "mapa"
  | "archivo";

const DESTINATION_LABELS: Record<PeriodDestination, string> = {
  home: "la portada",
  hechos: "hechos",
  epocas: "épocas",
  ensayos: "ensayos",
  personas: "personas",
  lugares: "lugares",
  ideas: "ideas",
  mapa: "el mapa",
  archivo: "el archivo",
};

export function HomePeriodSelector({
  selectedPeriod,
  destination = "home",
  onSelect,
  availablePeriods,
}: {
  selectedPeriod: PeriodCode | null;
  destination?: PeriodDestination;
  onSelect?: (period: PeriodCode | null) => void;
  availablePeriods?: readonly PeriodCode[];
}) {
  const searchParams = useSearchParams();
  const activeAnchorRef = useRef<HTMLAnchorElement | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [periodsOpen, setPeriodsOpen] = useState(false);
  const selected = selectedPeriod ? PERIODS[selectedPeriod] : null;
  const isFilter = typeof onSelect === "function";

  const hrefFor = (code: PeriodCode | null) => {
    const path = destination === "home" ? "/" : `/${destination}`;
    const key = destination === "home" || destination === "epocas" ? "epoca" : "periodo";
    const params = new URLSearchParams(searchParams.toString());
    params.delete("pagina");
    if (code) params.set(key, code);
    else params.delete(key);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  };

  useEffect(() => {
    if (!selectedPeriod || !periodsOpen) return;
    (activeButtonRef.current ?? activeAnchorRef.current)?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "center",
    });
  }, [periodsOpen, selectedPeriod]);

  return (
    <>
      <button
        type="button"
        className="hc-period-mobile-toggle"
        aria-expanded={periodsOpen}
        aria-controls="hc-period-selector"
        onClick={() => setPeriodsOpen((open) => !open)}
      >
        <span>
          <small>{destination === "home" ? "Edición histórica" : "Explorar épocas"}</small>
          <strong>{selected ? `${selected.label} · ${selected.yearRange}` : "Todas las épocas"}</strong>
        </span>
        <span>
          {periodsOpen ? "Cerrar" : "Cambiar"}
          <svg viewBox="0 0 12 12" aria-hidden>
            <path d="m2.5 4.5 3.5 3 3.5-3" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </span>
      </button>

      <nav
        id="hc-period-selector"
        className={`hc-period-selector${periodsOpen ? " is-mobile-open" : ""}`}
        aria-label={
          destination === "home"
            ? "Personalizar la portada por época"
            : `Filtrar ${DESTINATION_LABELS[destination]} por época`
        }
      >
        {HISTORICAL_PERIODS.map((code) => {
          const period = PERIODS[code];
          const active = code === selectedPeriod;
          const available = !isFilter || !availablePeriods || availablePeriods.includes(code);
          const href = hrefFor(active && destination !== "epocas" ? null : code);

          if (isFilter) {
            return (
              <button
                key={code}
                type="button"
                aria-pressed={active}
                aria-disabled={!available}
                disabled={!available}
                className={active ? "is-active" : ""}
                ref={active ? activeButtonRef : undefined}
                style={{ "--period-color": getPeriodColor(code) } as CSSProperties}
                onClick={() => {
                  if (!available) return;
                  onSelect?.(active ? null : code);
                  setPeriodsOpen(false);
                }}
                title={available ? undefined : "Sin biografías publicadas en esta época"}
              >
                <span>{period.label}</span>
                <small>{period.yearRange}</small>
              </button>
            );
          }

          return (
            <Link
              key={code}
              href={href}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={active ? "is-active" : ""}
              ref={active ? activeAnchorRef : undefined}
              style={{ "--period-color": getPeriodColor(code) } as CSSProperties}
              onClick={() => setPeriodsOpen(false)}
            >
              <span>{period.label}</span>
              <small>{period.yearRange}</small>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
