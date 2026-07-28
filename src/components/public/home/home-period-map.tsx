"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { PeriodCode } from "@/lib/design-tokens";
import type { MapPoint } from "@/lib/public-data";
import { EditorialArrow, EditorialImage } from "./primitives";

const MapCanvas = dynamic(() => import("../map-canvas").then((module) => module.MapCanvas), {
  ssr: false,
  loading: () => <div className="hc-map-loading">Cargando el mapa del archivo…</div>,
});

export function HomePeriodMap({
  periodCode,
  editionLabel,
}: {
  periodCode: PeriodCode | null;
  editionLabel: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [points, setPoints] = useState<MapPoint[] | null>(null);
  const [active, setActive] = useState<MapPoint | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || loadAttempt > 0) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setLoadAttempt(1);
        observer.disconnect();
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [loadAttempt]);

  useEffect(() => {
    if (loadAttempt === 0) return;
    const controller = new AbortController();
    const query = periodCode ? `?epoca=${encodeURIComponent(periodCode)}` : "";

    fetch(`/api/public-map-points${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Mapa HTTP ${response.status}`);
        return response.json() as Promise<{ points: MapPoint[] }>;
      })
      .then((payload) => {
        setPoints(payload.points);
        setActive(payload.points[0] ?? null);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(true);
      });

    return () => controller.abort();
  }, [loadAttempt, periodCode]);

  if (loadAttempt === 0) {
    return (
      <div ref={rootRef} className="hc-map-deferred">
        <span>Mapa de {editionLabel}</span>
        <strong>Explore los lugares donde ocurre esta historia</strong>
        <p>Abra el mapa interactivo para recorrer las piezas publicadas sobre el territorio.</p>
        <button type="button" onClick={() => setLoadAttempt(1)}>
          Cargar mapa interactivo <EditorialArrow />
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div ref={rootRef} className="hc-map-empty" role="alert">
        <strong>No fue posible abrir el mapa</strong>
        <p>Puede volver a intentarlo o continuar en el mapa completo del archivo.</p>
        <button
          type="button"
          onClick={() => {
            setPoints(null);
            setActive(null);
            setError(false);
            setLoadAttempt((attempt) => attempt + 1);
          }}
        >
          Volver a intentar
        </button>
        <Link href="/mapa">Abrir el mapa completo <EditorialArrow /></Link>
      </div>
    );
  }

  if (points === null) {
    return (
      <div ref={rootRef} className="hc-map-loading hc-map-deferred" aria-busy="true">
        Cargando el mapa del archivo…
      </div>
    );
  }

  if (!points.length) {
    return (
      <div ref={rootRef} className="hc-map-empty">
        <strong>Sin anclajes geográficos publicados</strong>
        <p>Esta edición todavía no tiene piezas con una ubicación verificable.</p>
        <Link href="/mapa">Abrir el mapa general <EditorialArrow /></Link>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="hc-map-shell">
      <div className="hc-map-canvas">
        <MapCanvas points={points} active={active} onSelect={setActive} fitInitial />
        <span className="hc-map-count">{points.length} puntos · {editionLabel}</span>
      </div>
      {active ? (
        <article className="hc-map-card">
          {active.imageUrl ? (
            <EditorialImage
              src={active.imageUrl}
              alt=""
              className="hc-map-card-image"
              width={480}
              sizes="(max-width: 760px) 118px, 180px"
            />
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
