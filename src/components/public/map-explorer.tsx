"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { PERIODS, getPeriodColor, type PeriodCode } from "@/lib/design-tokens";
import type { MapPoint } from "@/lib/public-data";
import "@/components/public/map-explorer.css";
import { imageAt } from "@/lib/image-url";

/**
 * El mapa se carga SOLO aquí y solo en cliente: Leaflet toca `window` al importarse
 * y además pesa lo suyo. Con `ssr: false` el resto del sitio no paga nada por él, y
 * esta página lo trae bajo demanda.
 */
const MapCanvas = dynamic(() => import("./map-canvas").then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => <div className="mx-canvas-loading">Cargando el mapa…</div>,
});

const KIND_FILTERS = [
  { key: "hecho", label: "Hechos" },
  { key: "entidad", label: "Entidades" },
  { key: "epoca", label: "Épocas" },
] as const;

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Recorrido geográfico del archivo: filtra por época, tipo y texto. */
export function MapExplorer({ points, total }: { points: MapPoint[]; total: number }) {
  const [periodo, setPeriodo] = useState<PeriodCode | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<MapPoint | null>(null);

  // Épocas presentes entre los puntos, en orden cronológico canónico.
  const periods = useMemo(() => {
    const present = new Set(points.map((p) => p.periodCode).filter(Boolean) as string[]);
    return (Object.keys(PERIODS) as PeriodCode[]).filter((c) => present.has(c));
  }, [points]);

  const nq = norm(q.trim());
  const filtered = useMemo(
    () =>
      points.filter((p) => {
        if (periodo && p.periodCode !== periodo) return false;
        if (kind && p.kind !== kind) return false;
        if (nq && !norm(`${p.titulo} ${p.lugar ?? ""} ${p.resumen}`).includes(nq)) return false;
        return true;
      }),
    [points, periodo, kind, nq],
  );

  const filtering = periodo != null || kind != null || nq.length > 0;
  const clear = () => {
    setPeriodo(null);
    setKind(null);
    setQ("");
  };

  return (
    <div className="mx-wrap">
      <header className="mx-head">
        <div className="mx-kick">Recorrido geográfico</div>
        <h1 className="mx-title">El archivo sobre el territorio</h1>
        <p className="mx-intro">
          Cada punto es una pieza publicada, anclada donde ocurre. Filtre por época o por
          tipo y recorra Colombia a través de su historia.
        </p>
      </header>

      <div className="mx-controls">
        <div className="mx-kinds">
          <button type="button" className={kind === null ? "is-on" : ""} onClick={() => setKind(null)}>
            Todo
          </button>
          {KIND_FILTERS.map((k) => (
            <button
              key={k.key}
              type="button"
              className={kind === k.key ? "is-on" : ""}
              onClick={() => setKind(kind === k.key ? null : k.key)}
            >
              {k.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="mx-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar un lugar o una pieza…"
          aria-label="Buscar en el mapa"
        />
      </div>

      <div className="mx-periods" role="group" aria-label="Filtrar por época">
        {periods.map((code) => (
          <button
            key={code}
            type="button"
            aria-pressed={periodo === code}
            className={periodo === code ? "is-on" : ""}
            style={{ "--pc": getPeriodColor(code) } as React.CSSProperties}
            onClick={() => setPeriodo(periodo === code ? null : code)}
          >
            <i />
            {PERIODS[code].label}
          </button>
        ))}
      </div>

      <div className="mx-count">
        {filtered.length === points.length
          ? `${points.length} piezas sobre el mapa · ${total} publicadas en total`
          : `${filtered.length} de ${points.length} piezas`}
        {filtering && (
          <button type="button" className="mx-clear" onClick={clear}>
            Limpiar
          </button>
        )}
      </div>

      <div className="mx-stage">
        <MapCanvas points={filtered} active={active} onSelect={setActive} />
        {active && (
          <aside className="mx-card">
            <button type="button" className="mx-card-close" onClick={() => setActive(null)} aria-label="Cerrar">
              ×
            </button>
            {active.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageAt(active.imageUrl, 640)!} alt="" aria-hidden className="mx-card-img" />
            )}
            <div className="mx-card-body">
              <div
                className="mx-card-kick"
                style={{ "--pc": getPeriodColor(active.periodCode ?? "TRANS") } as React.CSSProperties}
              >
                <i />
                {active.label}
                {active.yearLabel ? ` · ${active.yearLabel}` : ""}
              </div>
              <h2>{active.titulo}</h2>
              {active.lugar && <div className="mx-card-place">{active.lugar}</div>}
              {active.resumen && <p>{active.resumen}</p>}
              <Link href={active.href} className="mx-card-cta">
                Leer la pieza completa →
              </Link>
            </div>
          </aside>
        )}
      </div>

      <p className="mx-note">
        Las piezas sin un anclaje geográfico defendible —procesos de alcance nacional, ideas sin
        sede— no aparecen en el mapa: el archivo prefiere no ubicar antes que ubicar mal.
      </p>
    </div>
  );
}
