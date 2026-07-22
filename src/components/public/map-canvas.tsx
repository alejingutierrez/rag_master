"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import { getPeriodColor } from "@/lib/design-tokens";
import type { MapPoint } from "@/lib/public-data";
import "leaflet/dist/leaflet.css";

/** Encuadre inicial: Colombia continental + insular, con aire. */
const COLOMBIA_BOUNDS: LatLngBoundsExpression = [
  [-4.4, -79.2],
  [13.6, -66.8],
];

/**
 * Reencuadra el mapa cuando cambian los puntos filtrados: al elegir una época el
 * mapa "viaja" hasta ella en vez de dejar al lector buscando dónde quedó todo.
 */
function FitToPoints({ points }: { points: MapPoint[] }) {
  const map = useMap();
  // Firma estable: solo reencuadra cuando cambia el CONJUNTO, no en cada render.
  const signature = points.map((p) => p.id).join(",");
  const first = useRef(true);

  useEffect(() => {
    if (points.length === 0) return;
    if (first.current) {
      first.current = false;
      return; // El encuadre inicial ya es Colombia entera.
    }
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    map.flyToBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { padding: [60, 60], maxZoom: 9, duration: 0.6 },
    );
    // `signature` describe el conjunto de puntos; `points` cambia de identidad en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, map]);

  return null;
}

/**
 * Lienzo del mapa. Se dibuja con CircleMarker en vez de los marcadores por defecto
 * de Leaflet: son mucho más baratos con 300+ puntos, se colorean por época y evitan
 * el clásico problema de las rutas de iconos con el bundler.
 */
export function MapCanvas({
  points,
  active,
  onSelect,
}: {
  points: MapPoint[];
  active: MapPoint | null;
  onSelect: (p: MapPoint) => void;
}) {
  // Varias piezas comparten lugar (Bogotá se lleva decenas). Se separan en una
  // espiral mínima alrededor del punto para que todas sean clicables.
  const spread = useMemo(() => {
    const seen = new Map<string, number>();
    return points.map((p) => {
      const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      if (n === 0) return { p, lat: p.lat, lng: p.lng };
      const angle = n * 2.399963; // ángulo áureo: reparte sin alinear
      const radius = 0.035 * Math.sqrt(n);
      return { p, lat: p.lat + radius * Math.cos(angle), lng: p.lng + radius * Math.sin(angle) };
    });
  }, [points]);

  return (
    <MapContainer
      bounds={COLOMBIA_BOUNDS}
      scrollWheelZoom={false}
      className="mx-map"
      worldCopyJump={false}
    >
      {/* Teselas claras y desaturadas: es el fondo que mejor convive con el blanco
          editorial del sitio y deja que el color de época sea lo único que resalta. */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={18}
      />
      <FitToPoints points={points} />
      {spread.map(({ p, lat, lng }) => {
        const color = getPeriodColor(p.periodCode ?? "TRANS");
        const isActive = active?.id === p.id;
        return (
          <CircleMarker
            key={p.id}
            center={[lat, lng]}
            radius={isActive ? 9 : 5.5}
            pathOptions={{
              color: isActive ? "var(--fg)" : color,
              fillColor: color,
              fillOpacity: isActive ? 1 : 0.72,
              weight: isActive ? 2.5 : 1.25,
            }}
            eventHandlers={{ click: () => onSelect(p) }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1} className="mx-tip">
              <b>{p.titulo}</b>
              {p.yearLabel ? <span> · {p.yearLabel}</span> : null}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
