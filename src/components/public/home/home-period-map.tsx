"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { MapPoint } from "@/lib/public-data";
import { imageAt } from "@/lib/image-url";
import { EditorialArrow } from "./primitives";

const MapCanvas = dynamic(() => import("../map-canvas").then((module) => module.MapCanvas), {
  ssr: false,
  loading: () => <div className="hc-map-loading">Cargando el mapa del archivo…</div>,
});

export function HomePeriodMap({
  points,
  editionLabel,
}: {
  points: MapPoint[];
  editionLabel: string;
}) {
  const [active, setActive] = useState<MapPoint | null>(points[0] ?? null);

  if (!points.length) {
    return (
      <div className="hc-map-empty">
        <strong>Sin anclajes geográficos publicados</strong>
        <p>Esta edición todavía no tiene piezas con una ubicación verificable.</p>
        <Link href="/mapa">Abrir el mapa general <EditorialArrow /></Link>
      </div>
    );
  }

  return (
    <div className="hc-map-shell">
      <div className="hc-map-canvas">
        <MapCanvas points={points} active={active} onSelect={setActive} fitInitial />
        <span className="hc-map-count">{points.length} puntos · {editionLabel}</span>
      </div>
      {active ? (
        <article className="hc-map-card">
          {active.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageAt(active.imageUrl, 480)!} alt="" aria-hidden />
          ) : null}
          <div>
            <span>{active.lugar ?? active.label}{active.yearLabel ? ` · ${active.yearLabel}` : ""}</span>
            <h3>{active.titulo}</h3>
            {active.resumen ? <p>{active.resumen}</p> : null}
            <Link href={active.href}>Leer la pieza <EditorialArrow /></Link>
          </div>
        </article>
      ) : null}
    </div>
  );
}
