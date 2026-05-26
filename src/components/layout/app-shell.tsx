"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { CommandPalette } from "./command-palette";
import { KeyboardHelp } from "./keyboard-help";

const SIDEBAR_WIDTH = 220;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Bypass para páginas de desarrollo del nuevo design system (si se conservan).
  const isDevPath = pathname.startsWith("/dev");

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
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

  // Atajos g+letra (Linear-style).
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
  }, [router]);

  if (isDevPath) {
    return <>{children}</>;
  }

  // En mobile escondemos el sidebar; el shell del diseño está pensado para desktop.
  const showSidebar = !mobile;
  const mainOffset = showSidebar ? SIDEBAR_WIDTH : 0;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {showSidebar && <Sidebar />}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          marginLeft: mainOffset,
        }}
      >
        <TopBar onSearchClick={() => setPaletteOpen(true)} />
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
