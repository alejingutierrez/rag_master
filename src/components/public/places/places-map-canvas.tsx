"use client";

import { useEffect, useMemo, useRef } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface PlacesMapPoint {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  mentions: number;
}

function FitToPlaces({ points }: { points: PlacesMapPoint[] }) {
  const map = useMap();
  const first = useRef(true);
  const signature = points.map((point) => point.slug).join(",");

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (points.length === 0) {
      map.flyTo([4.5, -73.5], 5, { duration: 0.5 });
      return;
    }
    if (points.length === 1) {
      map.flyTo([points[0].lat, points[0].lng], 7, { duration: 0.5 });
      return;
    }
    map.flyToBounds(
      points.map((point) => [point.lat, point.lng] as [number, number]),
      { padding: [52, 52], maxZoom: 8, duration: 0.5 },
    );
    // La firma representa el conjunto estable; el array cambia de identidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);

  return null;
}

/** Mapa editorial de lugares: un punto por ficha, sin inventar coordenadas. */
export function PlacesMapCanvas({
  points,
  activeSlug,
  onSelect,
}: {
  points: PlacesMapPoint[];
  activeSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const labelSlugs = useMemo(
    () =>
      new Set(
        [...points]
          .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name, "es"))
          .slice(0, 5)
          .map((point) => point.slug),
      ),
    [points],
  );

  return (
    <MapContainer
      center={[4.5, -73.5]}
      zoom={5.5}
      zoomSnap={0.5}
      scrollWheelZoom={false}
      className="lp-map-canvas"
      worldCopyJump={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={18}
      />
      <FitToPlaces points={points} />
      {points.map((point) => {
        const active = point.slug === activeSlug;
        return (
          <CircleMarker
            key={point.slug}
            center={[point.lat, point.lng]}
            radius={active ? 8.5 : 5.5}
            pathOptions={{
              color: active ? "#101810" : "#123f2b",
              fillColor: active ? "#123f2b" : "#216440",
              fillOpacity: active ? 1 : 0.78,
              weight: active ? 2.5 : 1.25,
            }}
            eventHandlers={{ click: () => onSelect(point.slug) }}
          >
            <Tooltip
              direction="top"
              offset={[0, -7]}
              opacity={1}
              permanent={labelSlugs.has(point.slug)}
              className="lp-map-tip"
            >
              {point.name}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
