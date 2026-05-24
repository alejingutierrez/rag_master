"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ConfigProvider, theme as antdTheme, App as AntdApp } from "antd";
import { lightTheme, darkTheme } from "@/lib/theme";

type ThemeMode = "light" | "dark" | "auto";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "rag-master-theme-mode";

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "auto") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {
    /* ignore */
  }
  return "auto";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Inicializa síncrono desde localStorage para minimizar flash post-hydration.
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(readStoredMode()));

  // Reaccionar a cambios del sistema cuando mode === auto
  useEffect(() => {
    if (mode !== "auto" || typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(mql.matches ? "dark" : "light");
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode]);

  // Mantener el atributo data-theme y color-scheme sincronizados
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    setResolved(resolveTheme(next));
  }, []);

  const activeTheme = resolved === "dark" ? darkTheme : lightTheme;
  const algorithm = resolved === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      <ConfigProvider theme={{ ...activeTheme, algorithm }}>
        <AntdApp notification={{ placement: "bottomRight" }}>{children}</AntdApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
