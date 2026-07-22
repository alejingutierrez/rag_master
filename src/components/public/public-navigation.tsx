"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface PublicNavigationStats {
  hechos: number;
  epocas: number;
  biografias: number;
  preguntas: number;
  piezas: number;
  timelineEvents: number;
  personas: number;
  lugares: number;
  ideas: number;
}

const PRIMARY = [
  { href: "/hechos", label: "Hechos" },
  { href: "/epocas", label: "Épocas" },
  { href: "/personas", label: "Personas" },
  { href: "/linea-de-tiempo", label: "Línea de tiempo" },
  { href: "/archivo", label: "Archivo" },
];

function Arrow() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="ps-arrow">
      <path d="M3 9h11M10 4l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  );
}

export function PublicNavigation({ stats }: { stats: PublicNavigationStats }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setExploreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const mobileLinks = [
    { href: "/hechos", label: "Hechos", meta: String(stats.hechos) },
    { href: "/epocas", label: "Épocas", meta: String(stats.epocas) },
    { href: "/linea-de-tiempo", label: "Línea de tiempo", meta: `${stats.timelineEvents} eventos` },
    // Los directorios solo listan entidades con su propio artículo publicado: el
    // conteo del menú tiene que ser ese mismo, no el de piezas por tipología.
    { href: "/personas", label: "Personas", meta: `${stats.personas} con historia propia` },
    { href: "/lugares", label: "Lugares", meta: `${stats.lugares} con historia propia` },
    { href: "/ideas", label: "Ideas", meta: `${stats.ideas} con historia propia` },
    { href: "/ensayos", label: "Lecturas", meta: `${stats.preguntas} ${stats.preguntas === 1 ? "pregunta" : "preguntas"}` },
    { href: "/archivo", label: "Archivo", meta: `${stats.piezas} piezas` },
  ];

  return (
    <>
      <div className="ps-nav-shell">
        <Link href="/" className="ps-wordmark" aria-label="Historia Colombiana, portada">
          <span>Historia</span>
          <span>Colombiana</span>
        </Link>

        <nav className="ps-primary" aria-label="Navegación principal">
          {PRIMARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="ps-primary-link"
              aria-current={active(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ps-utilities">
          <Link href="/buscar" className="ps-utility-link" aria-current={active("/buscar") ? "page" : undefined}>
            Buscar
          </Link>
          <button
            type="button"
            className="ps-utility-button"
            aria-expanded={exploreOpen}
            aria-controls="public-explore-panel"
            onClick={() => setExploreOpen((value) => !value)}
          >
            Explorar
          </button>
          <Link href="/acerca" className="ps-utility-link" aria-current={active("/acerca") ? "page" : undefined}>
            Acerca
          </Link>
        </div>

        <button
          type="button"
          className="ps-mobile-trigger"
          aria-expanded={mobileOpen}
          aria-controls="public-mobile-menu"
          onClick={() => setMobileOpen(true)}
        >
          Menú
        </button>
      </div>

      <div id="public-explore-panel" className={`ps-explore ${exploreOpen ? "is-open" : ""}`} hidden={!exploreOpen}>
        <div className="ps-explore-inner">
          <div className="ps-explore-lead">
            <span className="ps-explore-index">Índice</span>
            <p>El archivo se puede recorrer por acontecimientos, períodos y conexiones.</p>
          </div>
          <Link href="/lugares" className="ps-explore-link">
            <span>Lugares</span><small>{stats.lugares} con historia propia</small><Arrow />
          </Link>
          <Link href="/ideas" className="ps-explore-link">
            <span>Ideas</span><small>{stats.ideas} con historia propia</small><Arrow />
          </Link>
          <Link href="/ensayos" className="ps-explore-link">
            <span>Lecturas</span><small>{stats.preguntas} {stats.preguntas === 1 ? "pregunta publicada" : "preguntas publicadas"}</small><Arrow />
          </Link>
          <Link href="/acerca#metodo" className="ps-explore-link">
            <span>Método y fuentes</span><small>Cómo se construye el archivo</small><Arrow />
          </Link>
        </div>
      </div>

      <div id="public-mobile-menu" className={`ps-mobile-menu ${mobileOpen ? "is-open" : ""}`} aria-hidden={!mobileOpen}>
        <div className="ps-mobile-head">
          <Link href="/" className="ps-mobile-brand">Historia Colombiana</Link>
          <button type="button" className="ps-mobile-close" onClick={() => setMobileOpen(false)}>
            Cerrar
          </button>
        </div>
        <nav className="ps-mobile-list" aria-label="Navegación móvil">
          {mobileLinks.map((item, index) => (
            <Link key={item.href} href={item.href} className="ps-mobile-item">
              <span className="ps-mobile-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="ps-mobile-label">{item.label}</span>
              <span className="ps-mobile-meta">{item.meta}</span>
            </Link>
          ))}
        </nav>
        <div className="ps-mobile-foot">
          <Link href="/buscar">Buscar <Arrow /></Link>
          <Link href="/acerca">Acerca <Arrow /></Link>
          <Link href="/acerca#metodo">Método y fuentes <Arrow /></Link>
        </div>
      </div>
    </>
  );
}
