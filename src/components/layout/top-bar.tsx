"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  IconButton,
  Tooltip,
  Kbd,
} from "@/components/ui";
import { ThemeToggle } from "./theme-toggle";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Inicio",
  "/upload": "Cargar PDFs",
  "/documents": "Documentos",
  "/enrich": "Enriquecer",
  "/chat": "Consultar",
  "/deep-research": "Deep Research",
  "/hypothesis": "Hipótesis",
  "/questions": "Preguntas",
  "/questions/generate": "Generar preguntas",
  "/questions/matriz": "Matriz",
  "/threads": "Hilos",
  "/workspaces": "Workspaces",
  "/producciones": "Producciones",
  "/compare": "Comparador",
  "/bibliography": "Bibliografía",
  "/timeline": "Línea de tiempo",
  "/graph": "Grafo",
  "/coverage": "Cobertura",
  "/entities": "Entidades",
};

const DYNAMIC_PARENTS = new Set([
  "/documents",
  "/threads",
  "/workspaces",
  "/producciones",
]);

export interface TopBarProps {
  sidebarWidth: number;
  onSearchClick: () => void;
}

export function TopBar({ sidebarWidth, onSearchClick }: TopBarProps) {
  const pathname = usePathname();

  const breadcrumb = useMemo(() => {
    if (pathname === "/") return [{ label: "Inicio" }];
    const segs = pathname.split("/").filter(Boolean);
    const parts: { label: string; href?: string }[] = [
      { label: "Inicio", href: "/" },
    ];
    let cur = "";
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const prev = cur;
      cur += "/" + s;
      const known = ROUTE_LABELS[cur];
      if (known) {
        parts.push({ label: known, href: cur });
      } else if (DYNAMIC_PARENTS.has(prev)) {
        parts.push({ label: "Detalle" });
      } else {
        parts.push({ label: s.length > 16 ? s.slice(0, 14) + "…" : s });
      }
    }
    return parts;
  }, [pathname]);

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-20 h-16",
        "flex items-center justify-between gap-3 px-5",
        "bg-[var(--bg-page)]/80 backdrop-blur-md",
        "border-b border-[var(--border-default)]",
        "transition-[left] duration-200 ease-out",
      )}
      style={{ left: sidebarWidth }}
    >
      {/* Breadcrumb */}
      <nav
        aria-label="Migas de pan"
        className="flex items-center gap-1.5 text-[13px] min-w-0"
      >
        {breadcrumb.map((c, i) => {
          const isLast = i === breadcrumb.length - 1;
          return (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && (
                <ChevronRight
                  className="size-3 text-[var(--fg-subtle)] shrink-0"
                  aria-hidden
                />
              )}
              {c.href && !isLast ? (
                <Link
                  href={c.href}
                  className="text-[var(--fg-muted)] hover:text-[var(--fg-default)] truncate transition-colors duration-[var(--duration-instant)]"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  className="text-[var(--fg-default)] font-medium truncate"
                  aria-current={isLast ? "page" : undefined}
                >
                  {c.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Tooltip content="Búsqueda global">
          <button
            type="button"
            onClick={onSearchClick}
            className={cn(
              "hidden md:flex items-center gap-2 px-3 h-8",
              "text-[12px] text-[var(--fg-subtle)]",
              "bg-[var(--bg-muted)] border border-[var(--border-default)] rounded-md",
              "hover:border-[var(--border-strong)] hover:text-[var(--fg-muted)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]",
              "transition-colors duration-[var(--duration-instant)]",
            )}
            aria-label="Búsqueda global"
          >
            <Search className="size-3.5" />
            <span>Buscar</span>
            <Kbd keys={["cmd", "k"]} />
          </button>
        </Tooltip>
        <Tooltip content="Búsqueda (⌘K)">
          <IconButton
            aria-label="Buscar"
            className="md:hidden"
            onClick={onSearchClick}
          >
            <Search />
          </IconButton>
        </Tooltip>
        <ThemeToggle />
      </div>
    </header>
  );
}
