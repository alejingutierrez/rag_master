"use client";

import { useEffect, useState } from "react";
import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
} from "next-themes";
import { ConfigProvider, theme as antdTheme, App as AntdApp } from "antd";
import { Toaster } from "sonner";
import { lightTheme, darkTheme } from "@/lib/theme";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * AntBridge — durante la migración, los componentes Ant todavía existen.
 * Este componente lee el tema resuelto de next-themes y lo aplica al
 * ConfigProvider de Ant. Se elimina cuando completemos F6 (cleanup Ant).
 */
function AntBridge({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Antes del mount, asumir light para evitar mismatch SSR.
  const isDark = mounted && resolvedTheme === "dark";
  const activeTheme = isDark ? darkTheme : lightTheme;
  const algorithm = isDark
    ? antdTheme.darkAlgorithm
    : antdTheme.defaultAlgorithm;

  return (
    <ConfigProvider theme={{ ...activeTheme, algorithm }}>
      <AntdApp notification={{ placement: "bottomRight" }}>
        <TooltipProvider>
          {children}
          <Toaster
            position="bottom-right"
            theme={isDark ? "dark" : "light"}
            toastOptions={{
              style: {
                background: "var(--bg-page)",
                color: "var(--fg-default)",
                border: "1px solid var(--border-default)",
                fontFamily: "var(--font-sans)",
              },
            }}
          />
        </TooltipProvider>
      </AntdApp>
    </ConfigProvider>
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute={["class", "data-theme"]}
      defaultTheme="system"
      enableSystem
      storageKey="rag-master-theme-mode"
      disableTransitionOnChange={false}
    >
      <AntBridge>{children}</AntBridge>
    </NextThemesProvider>
  );
}

/**
 * Hook de tema con la API histórica del proyecto: { mode, resolved, setMode }.
 * Internamente delega a next-themes. Mantenemos el alias "auto" → "system"
 * para no romper callers existentes.
 */
type ThemeMode = "light" | "dark" | "auto";
type ResolvedTheme = "light" | "dark";

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();

  const mode: ThemeMode =
    theme === "system" || theme === undefined
      ? "auto"
      : (theme as "light" | "dark");

  const resolved: ResolvedTheme =
    resolvedTheme === "dark" ? "dark" : "light";

  const setMode = (next: ThemeMode) => {
    setTheme(next === "auto" ? "system" : next);
  };

  return { mode, resolved, setMode };
}
