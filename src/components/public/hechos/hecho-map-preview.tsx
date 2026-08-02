"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MapPoint } from "@/lib/public-data";

const MapCanvas = dynamic(() => import("@/components/public/map-canvas").then((module) => module.MapCanvas), {
  ssr: false,
  loading: () => <div className="hd-map-loading">Cargando ubicación…</div>,
});

export function HechoMapPreview({ point }: { point: MapPoint }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || ready) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setReady(true);
        observer.disconnect();
      },
      { rootMargin: "500px 0px" },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [ready]);

  return (
    <div className="hd-map-preview" ref={rootRef}>
      <div className="hd-map-copy">
        <p>Geografía del hecho</p>
        <strong>{point.lugar ?? "Ubicación documentada"}</strong>
        <span>{point.lat.toFixed(3)}, {point.lng.toFixed(3)}</span>
        <Link href="/mapa">Abrir en el mapa histórico →</Link>
      </div>
      <div className="hd-map-canvas">
        {ready ? (
          <MapCanvas points={[point]} active={point} onSelect={() => undefined} fitInitial />
        ) : (
          <button type="button" onClick={() => setReady(true)}>Cargar ubicación</button>
        )}
      </div>
    </div>
  );
}
