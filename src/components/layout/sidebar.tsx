"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Upload,
  FileText,
  FlaskConical,
  BookOpen,
  MessageCircle,
  Lightbulb,
  Rocket,
  Workflow,
  BookMarked,
  LayoutGrid,
  GitCompare,
  Library,
  Activity,
  GitBranch,
  Map as MapIcon,
  Users,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton, Tooltip, Kbd } from "@/components/ui";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    label: "Repositorio",
    items: [
      { href: "/", label: "Inicio", icon: Home },
      { href: "/upload", label: "Cargar PDFs", icon: Upload },
      { href: "/documents", label: "Documentos", icon: FileText },
      { href: "/enrich", label: "Enriquecer", icon: FlaskConical },
    ],
  },
  {
    label: "Investigación",
    items: [
      { href: "/questions", label: "Preguntas", icon: BookOpen },
      { href: "/chat", label: "Consultar", icon: MessageCircle },
      { href: "/hypothesis", label: "Hipótesis", icon: Lightbulb },
      { href: "/deep-research", label: "Deep Research", icon: Rocket },
      { href: "/threads", label: "Hilos", icon: Workflow },
      { href: "/workspaces", label: "Workspaces", icon: BookMarked },
    ],
  },
  {
    label: "Producción",
    items: [
      { href: "/producciones", label: "Producciones", icon: LayoutGrid },
      { href: "/compare", label: "Comparador", icon: GitCompare },
      { href: "/bibliography", label: "Bibliografía", icon: Library },
    ],
  },
  {
    label: "Exploración",
    items: [
      { href: "/timeline", label: "Línea de tiempo", icon: Activity },
      { href: "/graph", label: "Grafo", icon: GitBranch },
      { href: "/coverage", label: "Cobertura", icon: MapIcon },
      { href: "/entities", label: "Entidades", icon: Users },
    ],
  },
];

const ALL_ROUTES = NAV.flatMap((g) => g.items.map((i) => i.href)).sort(
  (a, b) => b.length - a.length,
);

const SUB_ROUTE_PARENT: Record<string, string> = {
  "/questions/matriz": "/questions",
  "/questions/generate": "/questions",
};

export interface SidebarProps {
  collapsed: boolean;
  onCollapseToggle: () => void;
  onSearchClick: () => void;
}

export function Sidebar({
  collapsed,
  onCollapseToggle,
  onSearchClick,
}: SidebarProps) {
  const pathname = usePathname();

  const selectedHref = useMemo(() => {
    if (SUB_ROUTE_PARENT[pathname]) return SUB_ROUTE_PARENT[pathname];
    return (
      ALL_ROUTES.find(
        (r) => pathname === r || pathname.startsWith(r + "/"),
      ) ?? "/"
    );
  }, [pathname]);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30",
        "flex flex-col",
        "bg-[var(--bg-subtle)] border-r border-[var(--border-default)]",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-[64px]" : "w-[244px]",
      )}
      aria-label="Navegación principal"
    >
      {/* Brand */}
      <div
        className={cn(
          "h-16 flex items-center gap-2.5 border-b border-[var(--border-default)] shrink-0",
          collapsed ? "px-4 justify-center" : "px-5",
        )}
      >
        <Link
          href="/"
          aria-label="Inicio"
          className={cn(
            "inline-flex items-center justify-center shrink-0",
            "size-8 rounded-md bg-[var(--accent)] text-[var(--fg-inverted)]",
            "font-serif font-semibold text-[15px]",
            "transition-transform hover:scale-105",
          )}
        >
          A
        </Link>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="font-serif font-semibold text-sm text-[var(--fg-default)] truncate">
              Archivo Digital
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
              Historia · Colombia
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={onSearchClick}
            className={cn(
              "w-full flex items-center gap-2 px-3 h-9",
              "text-[13px] text-[var(--fg-subtle)]",
              "bg-[var(--bg-page)] border border-[var(--border-default)] rounded-md",
              "hover:border-[var(--border-strong)] hover:text-[var(--fg-muted)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]",
              "transition-colors duration-[var(--duration-instant)]",
            )}
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">Buscar…</span>
            <Kbd keys={["cmd", "k"]} />
          </button>
        </div>
      )}
      {collapsed && (
        <div className="px-3 pt-3 flex justify-center">
          <Tooltip content="Búsqueda (⌘K)" side="right">
            <IconButton aria-label="Buscar" onClick={onSearchClick}>
              <Search />
            </IconButton>
          </Tooltip>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
        {NAV.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="px-2 mb-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === selectedHref;
                const Icon = item.icon;
                const linkClass = cn(
                  "flex items-center gap-2.5 rounded-md",
                  "text-[13px] font-medium leading-none",
                  "transition-colors duration-[var(--duration-instant)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]",
                  collapsed ? "justify-center size-9" : "px-2.5 h-9",
                  active
                    ? "bg-[var(--accent-bg-subtle)] text-[var(--accent)]"
                    : "text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-default)]",
                );
                const linkEl = (
                  <Link
                    href={item.href}
                    className={linkClass}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip content={item.label} side="right">
                        {linkEl}
                      </Tooltip>
                    ) : (
                      linkEl
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "border-t border-[var(--border-default)] p-2",
          collapsed ? "flex justify-center" : "",
        )}
      >
        <Tooltip
          content={collapsed ? "Expandir menú" : "Colapsar menú"}
          side="right"
        >
          <IconButton
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            onClick={onCollapseToggle}
            variant="ghost"
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </IconButton>
        </Tooltip>
      </div>
    </aside>
  );
}
