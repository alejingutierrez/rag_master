"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { HomePeriodSelector } from "@/components/public/home/home-period-selector";
import { SectionMasthead } from "@/components/public/section-masthead";
import { imageAt } from "@/lib/image-url";
import { useUrlFilters } from "@/lib/use-url-state";
import type { PlaceKind, PublicPlace } from "@/lib/public-data";
import { HISTORICAL_PERIODS, type PeriodCode } from "@/lib/design-tokens";
import type { PlacesMapPoint } from "@/components/public/places/places-map-canvas";
import "@/components/public/places/places-explorer.css";

const PlacesMapCanvas = dynamic(
  () =>
    import("@/components/public/places/places-map-canvas").then(
      (module) => module.PlacesMapCanvas,
    ),
  {
    ssr: false,
    loading: () => <div className="lp-map-loading">Cargando mapa…</div>,
  },
);

type PlaceFilter = "todos" | PlaceKind;
type PlacesView = "mapa" | "az";

const PLACE_FILTERS: { id: PlaceFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "ciudad", label: "Ciudades" },
  { id: "region", label: "Regiones" },
  { id: "rio-paisaje", label: "Ríos y paisajes" },
  { id: "frontera", label: "Fronteras" },
];

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function initialOf(value: string): string {
  const initial = normalize(value.trim()).charAt(0).toUpperCase();
  return initial >= "A" && initial <= "Z" ? initial : "#";
}

function appearancesLabel(count: number): string {
  return count === 1 ? "1 aparición" : `${count} apariciones`;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M14 7l5 5-5 5" />
    </svg>
  );
}

function FilterStrip({
  selected,
  onSelect,
}: {
  selected: PlaceFilter;
  onSelect: (kind: PlaceFilter) => void;
}) {
  return (
    <div className="lp-filter-strip" role="group" aria-label="Filtrar por tipo de lugar">
      {PLACE_FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          className={selected === filter.id ? "is-active" : ""}
          aria-pressed={selected === filter.id}
          onClick={() => onSelect(filter.id)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function PlaceImage({ place, width }: { place: PublicPlace; width: 160 | 320 | 640 | 960 }) {
  const src = imageAt(place.imageUrl, width);
  if (src) {
    // El nombre del lugar ya forma parte del enlace; la imagen es atmosférica.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" aria-hidden loading={width <= 320 ? "lazy" : "eager"} />;
  }
  return <span className="lp-image-fallback" aria-hidden>{place.name.charAt(0)}</span>;
}

function FeaturedPlace({ place, primary = false }: { place: PublicPlace; primary?: boolean }) {
  return (
    <Link href={place.href} className={`lp-feature${primary ? " is-primary" : ""}`}>
      <PlaceImage place={place} width={primary ? 960 : 640} />
      <span className="lp-feature-shade" aria-hidden />
      <span className="lp-feature-copy">
        <span className="lp-eyebrow">{place.kindLabel}</span>
        <strong>{place.name}</strong>
        {place.resumen ? <span className="lp-feature-summary">{place.resumen}</span> : null}
        {place.mentions > 0 ? (
          <span className="lp-feature-meta">{appearancesLabel(place.mentions)}</span>
        ) : null}
      </span>
    </Link>
  );
}

function DirectoryRow({
  place,
  active,
  onFocus,
}: {
  place: PublicPlace;
  active: boolean;
  onFocus: (slug: string) => void;
}) {
  return (
    <li
      id={`place-${place.slug}`}
      className={`lp-directory-row${active ? " is-active" : ""}`}
      data-place-slug={place.slug}
      onMouseEnter={() => onFocus(place.slug)}
    >
      <Link href={place.href} onFocus={() => onFocus(place.slug)}>
        <span className="lp-directory-thumb">
          <PlaceImage place={place} width={160} />
        </span>
        <span className="lp-directory-copy">
          <span className="lp-directory-kind">{place.kindLabel}</span>
          <strong>{place.name}</strong>
          {place.resumen ? <span className="lp-directory-summary">{place.resumen}</span> : null}
          {place.mentions > 0 ? (
            <span className="lp-directory-meta">{appearancesLabel(place.mentions)}</span>
          ) : null}
        </span>
        <span className="lp-directory-arrow"><ArrowIcon /></span>
      </Link>
    </li>
  );
}

function pickFeatured(places: PublicPlace[]): PublicPlace[] {
  const selected: PublicPlace[] = [];
  for (const slug of ["bogota", "amazonia", "rio-magdalena"]) {
    const place = places.find((candidate) => candidate.slug === slug);
    if (place && !selected.some((item) => item.slug === place.slug)) selected.push(place);
  }
  const fallback = [...places].sort(
    (a, b) =>
      Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl)) ||
      b.mentions - a.mentions ||
      a.name.localeCompare(b.name, "es"),
  );
  for (const place of fallback) {
    if (selected.length >= 3) break;
    if (!selected.some((item) => item.slug === place.slug)) selected.push(place);
  }
  return selected;
}

export function PlacesExplorer({ places }: { places: PublicPlace[] }) {
  const [filters, setFilters] = useUrlFilters({ q: "", tipo: "todos", vista: "mapa", periodo: "" }, 120);
  const deferredQuery = useDeferredValue(filters.q);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const selectedKind = PLACE_FILTERS.some((filter) => filter.id === filters.tipo)
    ? (filters.tipo as PlaceFilter)
    : "todos";
  const selectedView: PlacesView = filters.vista === "az" ? "az" : "mapa";
  const query = normalize(deferredQuery.trim());
  const periods = useMemo(
    () => HISTORICAL_PERIODS.filter((code) => places.some((place) => place.periods.includes(code))),
    [places],
  );
  const selectedPeriod = periods.includes(filters.periodo as PeriodCode)
    ? (filters.periodo as PeriodCode)
    : null;

  const alphabetical = useMemo(
    () => [...places].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [places],
  );
  const filtered = useMemo(
    () =>
      alphabetical.filter((place) => {
        if (selectedPeriod && !place.periods.includes(selectedPeriod)) return false;
        if (selectedKind !== "todos" && place.kind !== selectedKind) return false;
        if (query && !normalize(`${place.name} ${place.resumen ?? ""} ${place.kindLabel}`).includes(query)) {
          return false;
        }
        return true;
      }),
    [alphabetical, query, selectedKind, selectedPeriod],
  );
  const directoryPlaces = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name, "es"),
      ),
    [filtered],
  );
  const mappedPlaces = useMemo(
    () => filtered.filter((place) => place.lat != null && place.lng != null),
    [filtered],
  );
  const mapPoints: PlacesMapPoint[] = useMemo(
    () =>
      mappedPlaces.map((place) => ({
        slug: place.slug,
        name: place.name,
        lat: place.lat!,
        lng: place.lng!,
        mentions: place.mentions,
      })),
    [mappedPlaces],
  );
  const grouped = useMemo(() => {
    const groups = new Map<string, PublicPlace[]>();
    for (const place of filtered) {
      const initial = initialOf(place.name);
      const group = groups.get(initial) ?? [];
      group.push(place);
      groups.set(initial, group);
    }
    return [...groups.entries()];
  }, [filtered]);
  const featured = useMemo(() => pickFeatured(filtered), [filtered]);
  const coordinateCount = filtered.filter((place) => place.lat != null && place.lng != null).length;

  const selectMarker = (slug: string) => {
    setActiveSlug(slug);
    requestAnimationFrame(() => {
      document.getElementById(`place-${slug}`)?.scrollIntoView({ block: "nearest" });
    });
  };

  return (
    <div className="lp-page">
      <SectionMasthead
        eyebrow="05 · Geografía histórica"
        title="Lugares"
        summary="Ciudades, regiones, ríos y fronteras leídos como escenarios activos de la historia colombiana."
        meta={`${filtered.length} de ${places.length} territorios`}
      >
        <HomePeriodSelector
          selectedPeriod={selectedPeriod}
          destination="lugares"
          onSelect={(periodo) => setFilters({ periodo: periodo ?? "" })}
          availablePeriods={periods}
        />
      </SectionMasthead>

      {featured.length > 0 ? (
        <section className="lp-feature-grid" aria-label="Lugares destacados">
          {featured.map((place, index) => (
            <FeaturedPlace key={place.slug} place={place} primary={index === 0} />
          ))}
        </section>
      ) : null}

      <section className="lp-explore" aria-labelledby="lp-explore-title">
        <div className="lp-explore-head">
          <h2 id="lp-explore-title">Explore el territorio</h2>
          <label className="lp-search">
            <span className="sr-only">Buscar lugares</span>
            <SearchIcon />
            <input
              type="search"
              value={filters.q}
              onChange={(event) => setFilters({ q: event.target.value })}
              placeholder="Buscar lugares…"
            />
          </label>
          <div className="lp-view-toggle" role="group" aria-label="Vista del directorio">
            <button
              type="button"
              className={selectedView === "mapa" ? "is-active" : ""}
              aria-pressed={selectedView === "mapa"}
              onClick={() => setFilters({ vista: "mapa" })}
            >
              Mapa
            </button>
            <button
              type="button"
              className={selectedView === "az" ? "is-active" : ""}
              aria-pressed={selectedView === "az"}
              onClick={() => setFilters({ vista: "az" })}
            >
              A–Z
            </button>
          </div>
          <div className="lp-coverage">
            <span>{coordinateCount} con coordenadas</span>
            <span>{filtered.length - coordinateCount} sin coordenadas</span>
          </div>
          <button
            type="button"
            className="lp-az-link"
            onClick={() => setFilters({ vista: "az" })}
          >
            Ver los {filtered.length} lugares A–Z <ArrowIcon />
          </button>
        </div>

        <p className="sr-only" aria-live="polite">{filtered.length} lugares encontrados.</p>

        {filtered.length === 0 ? (
          <div className="lp-empty">
            <p>No hay lugares que coincidan con esta búsqueda.</p>
            <button type="button" onClick={() => setFilters({ q: "", tipo: "todos" })}>
              Limpiar filtros
            </button>
          </div>
        ) : selectedView === "mapa" ? (
          <div className="lp-map-stage">
            <FilterStrip selected={selectedKind} onSelect={(tipo) => setFilters({ tipo })} />
            <div className="lp-map-panel">
              {mapPoints.length > 0 ? (
                <PlacesMapCanvas
                  points={mapPoints}
                  activeSlug={activeSlug}
                  onSelect={selectMarker}
                />
              ) : (
                <div className="lp-map-empty">Ningún lugar de esta selección tiene coordenadas.</div>
              )}
            </div>
            <div className="lp-directory-panel">
              <ul className="lp-directory-list">
                {directoryPlaces.map((place) => (
                  <DirectoryRow
                    key={place.slug}
                    place={place}
                    active={activeSlug === place.slug}
                    onFocus={setActiveSlug}
                  />
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <>
            <FilterStrip selected={selectedKind} onSelect={(tipo) => setFilters({ tipo })} />
            <div className="lp-az-stage">
              {grouped.map(([initial, group]) => (
                <section key={initial} className="lp-letter-group" aria-labelledby={`letter-${initial}`}>
                  <h3 id={`letter-${initial}`}>{initial}</h3>
                  <ul className="lp-az-list">
                    {group.map((place) => (
                      <DirectoryRow
                        key={place.slug}
                        place={place}
                        active={false}
                        onFocus={setActiveSlug}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
