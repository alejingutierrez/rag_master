"use client";

import { useEffect, useRef, useState } from "react";
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
}: {
  selectedPeriod: PeriodCode | null;
  destination?: "home" | "epocas";
}) {
  const activePeriodRef = useRef<HTMLAnchorElement | null>(null);
  const [periodsOpen, setPeriodsOpen] = useState(false);
  const selected = selectedPeriod ? PERIODS[selectedPeriod] : null;

  useEffect(() => {
    if (!selectedPeriod) return;
    activePeriodRef.current?.scrollIntoView({
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
            : "Seleccionar una época histórica"
        }
      >
        {HISTORICAL_PERIODS.map((code) => {
          const period = PERIODS[code];
          const active = code === selectedPeriod;
          const href =
            destination === "home"
              ? active
                ? "/"
                : `/?epoca=${code}`
              : `/epocas?epoca=${code}`;

          return (
            <Link
              key={code}
              href={href}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={active ? "is-active" : ""}
              ref={active ? activePeriodRef : undefined}
              style={{ "--period-color": getPeriodColor(code) } as React.CSSProperties}
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
