"use client";

import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  HISTORICAL_PERIODS,
  PERIODS,
  getPeriodColor,
  type PeriodCode,
} from "@/lib/design-tokens";
import "@/components/public/home/home-redesign.css";

type PeriodDestination =
  | "home"
  | "hechos"
  | "epocas"
  | "ensayos"
  | "personas"
  | "lugares"
  | "ideas"
  | "mapa"
  | "archivo"
  | "linea-de-tiempo";

const DESTINATION_LABELS: Record<PeriodDestination, string> = {
  home: "la portada",
  hechos: "hechos",
  epocas: "épocas",
  ensayos: "ensayos",
  personas: "personas",
  lugares: "lugares",
  ideas: "ideas",
  mapa: "el mapa",
  archivo: "el archivo",
  "linea-de-tiempo": "la línea de tiempo",
};

const PERIOD_VISUALS: Record<
  PeriodCode,
  { image: string; compactLabel?: string; compactYears?: string; compactSize?: number }
> = {
  PRE: {
    image: "/api/public-image/cmr9trje30002ad01qiuzb8qb?v=1783432450985&w=480",
    compactYears: "antes 1499",
  },
  CON: { image: "/api/public-image/cmr9xcs7r0001ad01tjv1c2dj?v=1783432296794&w=480" },
  COL: { image: "/api/public-image/cmra2oj090003ad0139p2tc47?v=1783432142316&w=480" },
  PRE_IND: {
    image: "/api/public-image/cmra2oj030002ad0163kywims?v=1783431309792&w=480",
    compactLabel: "Preindep.",
  },
  IND: {
    image: "/api/public-image/cmra2oj0b0004ad01aoabwcgv?v=1783431606631&w=480",
    compactSize: 10.8,
  },
  NGR: { image: "/api/public-image/cmrargmvn0001ad01iuyzcmf2?v=1783437912675&w=480" },
  EUC: {
    image: "/api/public-image/cmrargmwq0004ad01ngsz00r0?v=1783437835944&w=480",
    compactLabel: "E. U. de Colombia",
  },
  REG: {
    image: "/api/public-image/cmrargmvs0002ad01r0a3nsek?v=1783438379145&w=480",
    compactSize: 9.9,
  },
  REP_LIB: {
    image: "/api/public-image/cmrargmw90003ad01pyuhgtu6?v=1783437822828&w=480",
    compactLabel: "Rep. Liberal",
  },
  VIO: { image: "/api/public-image/cmratfl750005ad01jvn72s07?v=1783441387364&w=480" },
  FN: { image: "/api/public-image/cmratfl7a0006ad01m0pr4w5y?v=1783447356496&w=480" },
  CNA: {
    image: "/api/public-image/cmratflbf0007ad010iim8mpy?v=1783441419952&w=480",
    compactLabel: "Crisis narco.",
  },
  C91: {
    image: "/api/public-image/cmratflbl0008ad01qmqvala4?v=1783448285225&w=480",
    compactLabel: "Constitución",
    compactSize: 10.4,
  },
  SDE: {
    image: "/api/public-image/cmraz53kd0002ad014gh2fhga?v=1783450374091&w=480",
    compactLabel: "Seguridad dem.",
  },
  POS: {
    image: "/api/public-image/cmraz53k50001ad01rcd6d2l9?v=1783450243355&w=480",
    compactYears: "2016–hoy",
    compactSize: 11,
  },
  TRANS: { image: "" },
};

const DEFAULT_PREVIEW_INDEX = HISTORICAL_PERIODS.indexOf("IND");

function lensWeight(index: number, activeIndex: number | null) {
  if (activeIndex === null) return 1;
  const distance = Math.abs(index - activeIndex);
  const influence = Math.exp(-(distance * distance) / (2 * 0.62 * 0.62));
  return 1 + influence * 1.7;
}

export function HomePeriodSelector({
  selectedPeriod,
  destination = "home",
  onSelect,
  availablePeriods,
}: {
  selectedPeriod: PeriodCode | null;
  destination?: PeriodDestination;
  onSelect?: (period: PeriodCode | null) => void;
  availablePeriods?: readonly PeriodCode[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const [periodsOpen, setPeriodsOpen] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const selectedIndex = selectedPeriod ? HISTORICAL_PERIODS.indexOf(selectedPeriod) : -1;
  const [mobileState, setMobileState] = useState(() => ({
    selection: selectedIndex,
    index: selectedIndex >= 0 ? selectedIndex : DEFAULT_PREVIEW_INDEX,
  }));
  const mobileIndex =
    mobileState.selection === selectedIndex
      ? mobileState.index
      : selectedIndex >= 0
        ? selectedIndex
        : DEFAULT_PREVIEW_INDEX;
  const [mobileMotion, setMobileMotion] = useState<{
    direction: "forward" | "back";
    key: number;
  } | null>(null);
  const selected = selectedPeriod ? PERIODS[selectedPeriod] : null;
  const isFilter = typeof onSelect === "function";
  const desktopActiveIndex = hoverIndex ?? focusIndex ?? (selectedIndex >= 0 ? selectedIndex : null);
  const mobilePeriod = PERIODS[HISTORICAL_PERIODS[mobileIndex]];
  const mobileVisual = PERIOD_VISUALS[mobilePeriod.code];

  const availableSet = useMemo(
    () => new Set(availablePeriods ?? HISTORICAL_PERIODS),
    [availablePeriods],
  );

  const hrefFor = (code: PeriodCode | null) => {
    const path = destination === "home" ? "/" : `/${destination}`;
    const key = destination === "home" || destination === "epocas" ? "epoca" : "periodo";
    const params = new URLSearchParams(searchParams.toString());
    params.delete("pagina");
    if (code) params.set(key, code);
    else params.delete(key);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  };

  const isAvailable = (index: number) =>
    !isFilter || availableSet.has(HISTORICAL_PERIODS[index]);

  const availableNeighbor = (fromIndex: number, direction: -1 | 1) => {
    let candidate = fromIndex + direction;
    while (candidate >= 0 && candidate < HISTORICAL_PERIODS.length) {
      if (isAvailable(candidate)) return candidate;
      candidate += direction;
    }
    return null;
  };

  const goToMobilePeriod = (index: number) => {
    if (!isAvailable(index)) return;
    const code = HISTORICAL_PERIODS[index];
    if (index !== mobileIndex) {
      setMobileMotion((motion) => ({
        direction: index > mobileIndex ? "forward" : "back",
        key: (motion?.key ?? 0) + 1,
      }));
    }
    setMobileState({ selection: selectedIndex, index });
    if (isFilter) onSelect?.(code);
    else router.push(hrefFor(code), { scroll: false });
  };

  const onDesktopPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const position = Math.max(0, Math.min(rect.width - 1, event.clientX - rect.left));
    const index = Math.floor((position / rect.width) * HISTORICAL_PERIODS.length);
    setHoverIndex((current) => (current === index ? current : index));
    desktopRef.current?.style.setProperty(
      "--period-photo-x",
      `${42 + (position / rect.width) * 16}%`,
    );
  };

  const onMobilePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    pointerStartRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onMobilePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    const nextIndex = availableNeighbor(mobileIndex, dx < 0 ? 1 : -1);
    if (nextIndex !== null) goToMobilePeriod(nextIndex);
  };

  const previousIndex = availableNeighbor(mobileIndex, -1);
  const nextIndex = availableNeighbor(mobileIndex, 1);
  const navigationLabel =
    destination === "home"
      ? "Personalizar la portada por época"
      : `Filtrar ${DESTINATION_LABELS[destination]} por época`;

  return (
    <>
      <button
        type="button"
        className={`hc-period-mobile-toggle${selected ? " has-selection" : ""}`}
        aria-expanded={periodsOpen}
        aria-controls="hc-period-selector"
        onClick={() => setPeriodsOpen((open) => !open)}
        style={
          {
            "--period-selected-color": selected ? getPeriodColor(selected.code) : "var(--accent)",
            "--period-selected-image": selected
              ? `url('${PERIOD_VISUALS[selected.code].image}')`
              : "none",
          } as CSSProperties
        }
      >
        <span className="hc-period-mobile-photo" aria-hidden="true" />
        <span className="hc-period-mobile-copy">
          <small>Explorar por época</small>
          <strong>{selected?.label ?? "Todas las épocas"}</strong>
          <span>{selected?.yearRange ?? "15 periodos históricos"}</span>
        </span>
        <span className="hc-period-mobile-action">
          {periodsOpen ? "Cerrar" : "Cambiar"}
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="m2.5 4.5 3.5 3 3.5-3" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </span>
      </button>

      <nav
        id="hc-period-selector"
        className={`hc-period-selector${periodsOpen ? " is-mobile-open" : ""}`}
        aria-label={navigationLabel}
      >
        <div
          ref={desktopRef}
          className="hc-period-desktop"
          onPointerMove={onDesktopPointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <div className="hc-period-lens-track" aria-hidden="true">
            {HISTORICAL_PERIODS.map((code, index) => {
              const period = PERIODS[code];
              const visual = PERIOD_VISUALS[code];
              const active = index === desktopActiveIndex;
              const selectedItem = index === selectedIndex;
              const available = isAvailable(index);
              return (
                <span
                  key={code}
                  className={`hc-period-lens-item${active ? " is-active" : ""}${
                    selectedItem ? " is-selected" : ""
                  }${available ? "" : " is-unavailable"}`}
                  style={
                    {
                      "--period-color": getPeriodColor(code),
                      "--period-image": `url('${visual.image}')`,
                      "--period-label-length": period.label.length,
                      "--period-compact-size": visual.compactSize
                        ? `${visual.compactSize}px`
                        : undefined,
                      flexGrow: lensWeight(index, desktopActiveIndex),
                    } as CSSProperties
                  }
                >
                  <span className="hc-period-lens-photo" />
                  <span className="hc-period-lens-copy">
                    <span className="hc-period-lens-name">
                      <span className="hc-period-lens-name-compact">
                        {visual.compactLabel ?? period.label}
                      </span>
                      <span className="hc-period-lens-name-full">{period.label}</span>
                    </span>
                    <span className="hc-period-lens-meta">
                      <span className="hc-period-lens-code">{period.short}</span>
                      <span className="hc-period-lens-years hc-period-lens-years-compact">
                        {visual.compactYears ?? period.yearRange}
                      </span>
                      <span className="hc-period-lens-years hc-period-lens-years-full">
                        {period.yearRange}
                      </span>
                    </span>
                  </span>
                  <span className="hc-period-lens-state" />
                </span>
              );
            })}
          </div>

          <div className="hc-period-hit-zones">
            {HISTORICAL_PERIODS.map((code, index) => {
              const period = PERIODS[code];
              const active = index === selectedIndex;
              const available = isAvailable(index);
              const label = `${period.label}, ${period.yearRange}`;
              const sharedProps = {
                className: "hc-period-hit-zone",
                style: { "--period-color": getPeriodColor(code) } as CSSProperties,
                onFocus: () => setFocusIndex(index),
                onBlur: () => setFocusIndex(null),
              };

              if (isFilter) {
                return (
                  <button
                    key={code}
                    type="button"
                    aria-label={label}
                    aria-pressed={active}
                    disabled={!available}
                    title={available ? undefined : "Sin contenido publicado en esta época"}
                    {...sharedProps}
                    onClick={() => onSelect?.(active ? null : code)}
                  />
                );
              }

              return (
                <Link
                  key={code}
                  href={hrefFor(active && destination !== "epocas" ? null : code)}
                  scroll={false}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  {...sharedProps}
                />
              );
            })}
          </div>
        </div>

        <div className="hc-period-mobile-clip">
          <div
            className={`hc-period-mobile-deck${
              mobileMotion ? ` is-${mobileMotion.direction}` : ""
            }`}
            style={
              {
                "--period-preview-color": getPeriodColor(mobilePeriod.code),
                "--period-preview-image": `url('${mobileVisual.image}')`,
              } as CSSProperties
            }
          >
            <div
              className="hc-period-mobile-stage"
              onPointerDown={onMobilePointerDown}
              onPointerUp={onMobilePointerUp}
              onPointerCancel={() => {
                pointerStartRef.current = null;
              }}
            >
              <span
                key={`photo-${mobileIndex}-${mobileMotion?.key ?? 0}`}
                className="hc-period-mobile-stage-photo"
                aria-hidden="true"
              />
              <span
                key={`copy-${mobileIndex}-${mobileMotion?.key ?? 0}`}
                className="hc-period-mobile-stage-copy"
                aria-live="polite"
              >
                <small>{selectedIndex === mobileIndex ? "Época seleccionada" : "Vista previa"}</small>
                <strong>{mobilePeriod.label}</strong>
                <span>{mobilePeriod.yearRange}</span>
                <span className="hc-period-mobile-stepper">
                  <button
                    type="button"
                    aria-label="Época anterior"
                    disabled={previousIndex === null}
                    onClick={() => {
                      if (previousIndex !== null) goToMobilePeriod(previousIndex);
                    }}
                  >
                    ←
                  </button>
                  <span>{mobileIndex + 1} de {HISTORICAL_PERIODS.length}</span>
                  <button
                    type="button"
                    aria-label="Época siguiente"
                    disabled={nextIndex === null}
                    onClick={() => {
                      if (nextIndex !== null) goToMobilePeriod(nextIndex);
                    }}
                  >
                    →
                  </button>
                </span>
              </span>
            </div>

            <div className="hc-period-mobile-timeline" aria-label="Elegir una época">
              {HISTORICAL_PERIODS.map((code, index) => {
                const period = PERIODS[code];
                const available = isAvailable(index);
                return (
                  <button
                    key={code}
                    type="button"
                    className={`hc-period-mobile-tick${index === mobileIndex ? " is-current" : ""}`}
                    aria-label={`${period.label}, ${period.yearRange}`}
                    aria-pressed={index === selectedIndex}
                    disabled={!available}
                    data-code={period.short}
                    style={{ "--period-color": getPeriodColor(code) } as CSSProperties}
                    onClick={() => goToMobilePeriod(index)}
                  />
                );
              })}
            </div>
            <p className="hc-period-mobile-hint">Deslice la imagen o toque una marca</p>
          </div>
        </div>
      </nav>
    </>
  );
}
