"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Serializable = string | number | boolean | null | undefined;

/**
 * Sincroniza state con URL search params. Solo escribe cuando cambia el valor
 * (debounced), no cuando se monta. Ideal para filtros.
 */
export function useUrlState<T extends Serializable>(opts: {
  key: string;
  default: T;
  parse?: (raw: string) => T;
  format?: (v: T) => string | null;
  debounceMs?: number;
}): [T, (next: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { key, default: def, parse, format, debounceMs = 200 } = opts;

  const readFromUrl = useCallback((): T => {
    const raw = searchParams.get(key);
    if (raw === null) return def;
    if (parse) return parse(raw);
    return raw as T;
  }, [searchParams, key, def, parse]);

  const [value, setValue] = useState<T>(readFromUrl);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reaccionar a cambios externos en la URL (back/forward)
  useEffect(() => {
    const fromUrl = readFromUrl();
    setValue((current) => (current === fromUrl ? current : fromUrl));
  }, [readFromUrl]);

  const setAndPush = useCallback(
    (next: T) => {
      setValue(next);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        const formatted = format ? format(next) : next === null || next === undefined ? null : String(next);
        if (formatted === null || formatted === "" || formatted === String(def)) {
          params.delete(key);
        } else {
          params.set(key, formatted);
        }
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }, debounceMs);
    },
    [router, pathname, searchParams, key, format, def, debounceMs],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return [value, setAndPush];
}

/**
 * Filtros sincronizados con la URL. Acepta defaults como un objeto literal
 * normal sin necesidad de memo previo — internamente se snapshotea en primer
 * render para evitar loops infinitos.
 */
export function useUrlFilters<T extends Record<string, string>>(
  defaults: T,
  debounceMs = 200,
): [T, (patch: Partial<T>) => void, () => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Snapshot estable de defaults (solo el primer valor cuenta para evitar
  // loops cuando el caller pasa un objeto literal en cada render).
  const defaultsRef = useRef<T>(defaults);

  // Construir state inicial desde URL + defaults snapshot
  const buildFromUrl = useCallback((): T => {
    const out = { ...defaultsRef.current } as T;
    for (const k of Object.keys(defaultsRef.current)) {
      const v = searchParams.get(k);
      if (v !== null) (out as Record<string, string>)[k] = v;
    }
    return out;
  }, [searchParams]);

  const [state, setState] = useState<T>(buildFromUrl);

  // URL → state cuando cambian los searchParams externamente
  // (back/forward). Comparamos por valor para evitar loops.
  const serialized = searchParams.toString();
  const lastSerializedRef = useRef(serialized);
  useEffect(() => {
    if (lastSerializedRef.current === serialized) return;
    lastSerializedRef.current = serialized;
    setState(buildFromUrl());
  }, [serialized, buildFromUrl]);

  const update = useCallback(
    (patch: Partial<T>) => {
      setState((prev) => {
        const next = { ...prev, ...patch } as T;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          const params = new URLSearchParams();
          for (const [k, v] of Object.entries(next)) {
            if (v && v !== defaultsRef.current[k]) {
              params.set(k, String(v));
            }
          }
          const qs = params.toString();
          lastSerializedRef.current = qs;
          router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        }, debounceMs);
        return next;
      });
    },
    [router, pathname, debounceMs],
  );

  const reset = useCallback(() => {
    setState(defaultsRef.current);
    lastSerializedRef.current = "";
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Memoizamos el snapshot por estabilidad en consumidores
  const stableState = useMemo(() => state, [state]);

  return [stableState, update, reset];
}
