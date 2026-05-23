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
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("auto");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? "auto";
    setModeState(stored);
    setResolved(resolveTheme(stored));
    setMounted(true);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const current = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? "auto";
      if (current === "auto") setResolved(mql.matches ? "dark" : "light");
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.style.colorScheme = resolved;
  }, [resolved, mounted]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    setResolved(resolveTheme(next));
  }, []);

  const activeTheme = resolved === "dark" ? darkTheme : lightTheme;
  const algorithm =
    resolved === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;

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
