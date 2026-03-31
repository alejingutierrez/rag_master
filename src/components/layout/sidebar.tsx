"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Upload,
  FileText,
  Sparkles,
  MessageSquare,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/upload", label: "Cargar PDFs", icon: Upload },
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/enrich", label: "Enriquecer", icon: Sparkles },
  { href: "/chat", label: "Consultar", icon: MessageSquare },
  { href: "/questions", label: "Investigacion", icon: BookOpen },
];

const COLLAPSED_KEY = "rag-master-sidebar-collapsed";

function SidebarContent({ collapsed, onToggle }: { collapsed: boolean; onToggle?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div className={cn("p-4 border-b border-sidebar-border", collapsed ? "px-3" : "p-5")}>
        {collapsed ? (
          <div className="flex justify-center">
            <span className="text-lg font-bold text-primary">R</span>
          </div>
        ) : (
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">RAG Master</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5 tracking-wider uppercase">Archivo Historico Digital</p>
          </div>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                isActive
                  ? "bg-sidebar-active text-sidebar-active-foreground"
                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-sidebar-border">
        {onToggle && (
          <button
            onClick={onToggle}
            className="flex items-center justify-center w-full gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-hover transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Colapsar</span>
              </>
            )}
          </button>
        )}
        {!collapsed && (
          <div className="text-[10px] text-muted-foreground px-3 pt-2">
            <p>AWS Bedrock + pgvector</p>
            <p>Claude Opus 4.6</p>
          </div>
        )}
      </div>
    </>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  // Cerrar mobile sheet al navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, String(next));
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-sidebar min-h-screen border-r border-sidebar-border transition-all duration-200",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <SidebarContent collapsed={collapsed} onToggle={toggleCollapsed} />
      </aside>

      {/* Mobile toggle (rendered in Header via prop) */}
      {/* Mobile Sheet */}
      <Sheet open={mobileOpen} onClose={() => setMobileOpen(false)} side="left">
        <SidebarContent collapsed={false} />
      </Sheet>
    </>
  );
}

export function MobileSidebarTrigger({ onToggle }: { onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
