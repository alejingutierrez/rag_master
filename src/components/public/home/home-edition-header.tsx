"use client";

import { useState } from "react";
import Link from "next/link";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import type { HomeEditionCounts } from "./types";
import { formatEditorialNumber } from "./primitives";
import { HomePeriodSelector } from "./home-period-selector";

const SECTION_LINKS = [
  { href: "/hechos", label: "Hechos" },
  { href: "/epocas", label: "Épocas" },
  { href: "/ensayos", label: "Ensayos" },
  { href: "/personas", label: "Personas" },
  { href: "/lugares", label: "Lugares" },
  { href: "/ideas", label: "Ideas" },
  { href: "/mapa", label: "Mapa" },
  { href: "/archivo", label: "Archivo" },
] as const;

export function HomeEditionHeader({
  selectedPeriod,
  counts,
  editionDate,
}: {
  selectedPeriod: PeriodCode | null;
  counts: HomeEditionCounts;
  editionDate: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const selected = selectedPeriod ? PERIODS[selectedPeriod] : null;
  const status = selected
    ? `${selected.label} · ${selected.yearRange}`
    : "Edición general · Todas las épocas";

  return (
    <header className="hc-edition-head">
      <div className="hc-dateline">
        <span>Bogotá, Colombia</span>
        <span>{editionDate}</span>
        <span>Archivo abierto y citable</span>
      </div>

      <Link href="/" className="hc-masthead" title="Ir a la portada">
        Historia Colombiana
      </Link>

      <div className="hc-section-menu">
        <nav aria-label="Secciones de Historia Colombiana">
          {SECTION_LINKS.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              data-mobile-secondary={index >= 4 ? "true" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hc-menu-tools">
          <Link href="/buscar">Buscar</Link>
          <Link href="/acerca" className="hc-menu-more-desktop">Acerca del proyecto</Link>
          <button
            type="button"
            className="hc-mobile-menu-trigger"
            aria-expanded={menuOpen}
            aria-controls="hc-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menú
            <svg viewBox="0 0 12 12" aria-hidden>
              <path d="m2.5 4.5 3.5 3 3.5-3" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      </div>

      <nav
        id="hc-mobile-menu"
        className={`hc-mobile-menu${menuOpen ? " is-open" : ""}`}
        aria-label="Más secciones"
        hidden={!menuOpen}
      >
        {SECTION_LINKS.slice(4).map((item) => (
          <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
            {item.label}
          </Link>
        ))}
        <Link href="/acerca" onClick={() => setMenuOpen(false)}>Acerca del proyecto</Link>
      </nav>

      <div className="hc-period-intro">
        <div>
          <span>Edición histórica</span>
          <strong>{selected ? "Cambie de época y la portada entera cambiará con ella" : "Seleccione una época para abrir su propia portada"}</strong>
        </div>
        {selected ? <Link href="/">Restablecer edición</Link> : <Link href="/linea-de-tiempo">Abrir línea completa</Link>}
      </div>

      <HomePeriodSelector selectedPeriod={selectedPeriod} />

      <div
        className="hc-edition-status"
        aria-live="polite"
        data-mobile-label={selected ? "Contenido de la época" : "Contenido del archivo"}
      >
        <strong>{status}</strong>
        <dl>
          <div><dt>{formatEditorialNumber(counts.pieces)}</dt><dd>piezas</dd></div>
          <div><dt>{formatEditorialNumber(counts.facts)}</dt><dd>hechos</dd></div>
          <div><dt>{formatEditorialNumber(counts.essays)}</dt><dd>ensayos</dd></div>
          <div><dt>{formatEditorialNumber(counts.people)}</dt><dd>personas</dd></div>
          <div><dt>{formatEditorialNumber(counts.places)}</dt><dd>lugares</dd></div>
          <div><dt>{formatEditorialNumber(counts.ideas)}</dt><dd>ideas</dd></div>
        </dl>
      </div>
    </header>
  );
}
