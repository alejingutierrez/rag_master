"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

const ROUTE_TRAIL: Record<string, string[]> = {
  "/": ["Archivo", "Inicio"],
  "/chat": ["Archivo", "Investigación", "Consultar"],
  "/timeline": ["Archivo", "Exploración", "Línea de tiempo"],
  "/documents": ["Archivo", "Repositorio", "Documentos"],
  "/upload": ["Archivo", "Repositorio", "Cargar"],
  "/enrich": ["Archivo", "Repositorio", "Enriquecer"],
  "/questions": ["Archivo", "Investigación", "Preguntas"],
  "/questions/matriz": ["Archivo", "Investigación", "Preguntas", "Matriz"],
  "/questions/generate": ["Archivo", "Investigación", "Preguntas", "Generar"],
  "/hypothesis": ["Archivo", "Investigación", "Hipótesis"],
  "/deep-research": ["Archivo", "Investigación", "Deep Research"],
  "/compare": ["Archivo", "Producción", "Comparador"],
  "/producciones": ["Archivo", "Producción", "Producciones"],
  "/bibliography": ["Archivo", "Producción", "Bibliografía"],
  "/threads": ["Archivo", "Investigación", "Hilos"],
  "/workspaces": ["Archivo", "Investigación", "Workspaces"],
  "/entities": ["Archivo", "Exploración", "Entidades"],
  "/graph": ["Archivo", "Exploración", "Grafo"],
};

const DYNAMIC_PARENTS: Record<string, string[]> = {
  "/documents": ["Archivo", "Repositorio", "Documentos", "Detalle"],
  "/producciones": ["Archivo", "Producción", "Producciones", "Detalle"],
  "/threads": ["Archivo", "Investigación", "Hilos", "Detalle"],
  "/workspaces": ["Archivo", "Investigación", "Workspaces", "Detalle"],
};

export interface TopBarProps {
  onSearchClick?: () => void;
}

export function TopBar({ onSearchClick }: TopBarProps) {
  const pathname = usePathname();

  const trail = useMemo(() => {
    if (ROUTE_TRAIL[pathname]) return ROUTE_TRAIL[pathname];
    // dynamic [id]
    for (const [parent, t] of Object.entries(DYNAMIC_PARENTS)) {
      if (pathname.startsWith(parent + "/")) return t;
    }
    return ["Archivo", pathname.replace(/^\//, "")];
  }, [pathname]);

  return (
    <header
      style={{
        padding: "20px 56px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 18,
        borderBottom: "1px solid var(--line)",
        background: "var(--bg)",
        position: "sticky",
        top: 0,
        zIndex: 4,
      }}
    >
      <nav
        className="mono"
        style={{
          fontSize: 11.5,
          color: "var(--fg-subtle)",
          letterSpacing: "0.02em",
        }}
        aria-label="Migas de pan"
      >
        {trail.map((t, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <span style={{ margin: "0 9px", opacity: 0.5 }} aria-hidden>
                ›
              </span>
            )}
            {i === 0 ? (
              <Link
                href="/"
                style={{ color: "var(--fg-subtle)", textDecoration: "none" }}
              >
                {t}
              </Link>
            ) : (
              <span
                style={{
                  color: i === trail.length - 1 ? "var(--fg)" : "var(--fg-subtle)",
                }}
                aria-current={i === trail.length - 1 ? "page" : undefined}
              >
                {t}
              </span>
            )}
          </Fragment>
        ))}
      </nav>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {onSearchClick && (
          <button
            type="button"
            onClick={onSearchClick}
            style={{
              appearance: "none",
              background: "transparent",
              border: "1px solid var(--line-strong)",
              padding: "5px 11px",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--fg-muted)",
              cursor: "pointer",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
            aria-label="Búsqueda global (Cmd+K)"
          >
            Buscar · ⌘K
          </button>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
