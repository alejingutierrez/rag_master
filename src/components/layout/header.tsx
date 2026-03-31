"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "@/components/providers/theme-provider";
import { Moon, Sun, Menu } from "lucide-react";

const routeLabels: Record<string, string> = {
  "/": "Inicio",
  "/upload": "Cargar PDFs",
  "/documents": "Documentos",
  "/enrich": "Enriquecer",
  "/chat": "Consultar",
  "/questions": "Investigacion",
  "/questions/generate": "Generar Preguntas",
};

interface HeaderProps {
  onToggleMobileSidebar?: () => void;
}

export function Header({ onToggleMobileSidebar }: HeaderProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const breadcrumbs = buildBreadcrumbs(pathname);

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <nav className="flex items-center gap-1.5 text-sm min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && (
                <span className="text-muted-foreground">/</span>
              )}
              <span
                className={
                  i === breadcrumbs.length - 1
                    ? "text-foreground font-medium truncate"
                    : "text-muted-foreground truncate"
                }
              >
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>
      </div>

      <button
        onClick={toggleTheme}
        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
        title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </header>
  );
}

function buildBreadcrumbs(pathname: string) {
  if (pathname === "/") return [{ path: "/", label: "Inicio" }];

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { path: string; label: string }[] = [];

  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = routeLabels[currentPath];
    if (label) {
      crumbs.push({ path: currentPath, label });
    } else {
      // Dynamic segment (document ID, etc.)
      crumbs.push({ path: currentPath, label: segment.length > 12 ? segment.slice(0, 12) + "..." : segment });
    }
  }

  return crumbs;
}
