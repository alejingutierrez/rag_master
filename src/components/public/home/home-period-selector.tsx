"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  HISTORICAL_PERIODS,
  PERIODS,
  getPeriodColor,
  type PeriodCode,
} from "@/lib/design-tokens";

export function HomePeriodSelector({
  selectedPeriod,
  destination = "home",
  onSelect,
  availablePeriods,
}: {
  selectedPeriod: PeriodCode | null;
  destination?: "home" | "epocas" | "personas";
  onSelect?: (period: PeriodCode | null) => void;
  availablePeriods?: readonly PeriodCode[];
}) {
  const activeAnchorRef = useRef<HTMLAnchorElement | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [periodsOpen, setPeriodsOpen] = useState(false);
  const selected = selectedPeriod ? PERIODS[selectedPeriod] : null;
  const isFilter = destination === "personas";

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
            : destination === "personas"
              ? "Filtrar personas por época"
              : "Seleccionar una época histórica"
        }
      >
        {HISTORICAL_PERIODS.map((code) => {
          const period = PERIODS[code];
          const active = code === selectedPeriod;
          const available = !isFilter || !availablePeriods || availablePeriods.includes(code);
          const href =
            destination === "home"
              ? active
                ? "/"
                : `/?epoca=${code}`
              : `/epocas?epoca=${code}`;

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
