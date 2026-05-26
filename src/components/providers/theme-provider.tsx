"use client";

import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
} from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute={["class", "data-theme"]}
      defaultTheme="system"
      enableSystem
      storageKey="rag-master-theme-mode"
      disableTransitionOnChange={false}
    >
      <TooltipProvider>
        {children}
        <ThemedToaster />
      </TooltipProvider>
    </NextThemesProvider>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useNextTheme();
  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      toastOptions={{
        style: {
          background: "var(--bg-page)",
          color: "var(--fg-default)",
          border: "1px solid var(--border-default)",
          fontFamily: "var(--font-sans)",
        },
      }}
    />
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

  const resolved: ResolvedTheme = resolvedTheme === "dark" ? "dark" : "light";

  const setMode = (next: ThemeMode) => {
    setTheme(next === "auto" ? "system" : next);
  };

  return { mode, resolved, setMode };
}
