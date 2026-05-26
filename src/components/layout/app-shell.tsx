"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { CommandPalette } from "./command-palette";
import { KeyboardHelp } from "./keyboard-help";
import { safeGet, safeSet } from "@/lib/safe-storage";
import { cn } from "@/lib/cn";

const SIDEBAR_COLLAPSED_KEY = "rag-master-sider-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    safeGet<boolean>(SIDEBAR_COLLAPSED_KEY, false),
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Bypass para páginas de desarrollo del nuevo design system.
  const isDevPath = pathname.startsWith("/dev");

  // Detectar mobile y colapsar automáticamente
  useEffect(() => {
    const check = () => {
      const isMobile = window.innerWidth < 768;
      setMobile(isMobile);
      if (isMobile) setCollapsed(true);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Cmd/Ctrl+K → command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Atajos tipo Linear: g+letra, f para focus mode
  useEffect(() => {
    let lastKey = "";
    let lastTime = 0;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const now = Date.now();
      const k = e.key.toLowerCase();

      // Modo lectura / focus
      if (k === "f") {
        e.preventDefault();
        setFocusMode((v) => !v);
        return;
      }
      if (e.key === "Escape" && focusMode) {
        setFocusMode(false);
      }

      if (lastKey === "g" && now - lastTime < 800) {
        const map: Record<string, string> = {
          h: "/",
          d: "/documents",
          c: "/chat",
          q: "/questions",
          p: "/producciones",
          t: "/timeline",
          u: "/upload",
        };
        if (map[k]) {
          e.preventDefault();
          router.push(map[k]);
          lastKey = "";
          return;
        }
      }
      if (k === "g") {
        lastKey = "g";
        lastTime = now;
      } else {
        lastKey = "";
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router, focusMode]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    safeSet(SIDEBAR_COLLAPSED_KEY, next);
  };

  // Páginas dev: renderizar sin shell.
  if (isDevPath) {
    return <>{children}</>;
  }

  const sidebarWidth = focusMode ? 0 : mobile ? 0 : collapsed ? 64 : 244;
  const hideShell = focusMode;

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {!hideShell && !mobile && (
        <Sidebar
          collapsed={collapsed}
          onCollapseToggle={toggleCollapsed}
          onSearchClick={() => setPaletteOpen(true)}
        />
      )}

      {!hideShell && (
        <TopBar
          sidebarWidth={sidebarWidth}
          onSearchClick={() => setPaletteOpen(true)}
        />
      )}

      <main
        className={cn(
          "transition-[margin-left,padding-top] duration-200 ease-out",
          !hideShell && "pt-16",
        )}
        style={{ marginLeft: sidebarWidth }}
      >
        {children}
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(href) => {
          setPaletteOpen(false);
          router.push(href);
        }}
      />
      <KeyboardHelp />
    </div>
  );
}
