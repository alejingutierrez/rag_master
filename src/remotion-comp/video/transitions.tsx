/**
 * Transiciones entre escenas — overlays que tapan el corte a su paso, todas
 * deterministas. El montaje (TypographicVideo) elige cuál según el ESTILO del
 * video y la semántica de la escena que entra:
 *   - Wipe: panel que barre con sombreado de profundidad en los bordes.
 *   - DipToColor: fundido a color (negro casi siempre) — el corte respirado.
 *   - Blinds: persianas escalonadas — energía de prensa/collage.
 *   - Flash: destello — el flashazo de cámara.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";

const eInOut = Easing.bezier(0.7, 0, 0.25, 1);

export type WipeDir = "down" | "up" | "left" | "right";

/** Progreso −110 → 0 (cubre a mitad) → +110 de un panel que barre. */
function sweep(frame: number, len: number, hard = false): number {
  const half = len / 2;
  const ease = hard ? Easing.bezier(0.9, 0, 0.1, 1) : eInOut;
  return frame <= half
    ? interpolate(frame, [0, half], [-110, 0], { easing: ease })
    : interpolate(frame, [half, len], [0, 110], { easing: ease });
}

const axisOf = (dir: WipeDir) => (dir === "left" || dir === "right" ? "translateX" : "translateY");
const signOf = (dir: WipeDir) => (dir === "up" || dir === "left" ? -1 : 1);

/** Barrido de panel con bandas de sombra en los extremos (profundidad al pasar). */
export const Wipe: React.FC<{ color: string; len: number; dir?: WipeDir; hard?: boolean }> = ({ color, len, dir = "down", hard = false }) => {
  const frame = useCurrentFrame();
  const pos = sweep(frame, len, hard);
  const vertical = dir === "down" || dir === "up";
  const shade = vertical
    ? "linear-gradient(180deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0) 12%, rgba(0,0,0,0) 88%, rgba(0,0,0,0.16) 100%)"
    : "linear-gradient(90deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0) 12%, rgba(0,0,0,0) 88%, rgba(0,0,0,0.16) 100%)";
  return (
    <AbsoluteFill style={{ transform: `${axisOf(dir)}(${pos * signOf(dir)}%)`, backgroundColor: color, zIndex: 30 }}>
      <AbsoluteFill style={{ background: shade }} />
    </AbsoluteFill>
  );
};

/** Fundido a color y de vuelta, con meseta corta al centro — el corte que respira. */
export const DipToColor: React.FC<{ color: string; len: number }> = ({ color, len }) => {
  const frame = useCurrentFrame();
  const op = interpolate(
    frame,
    [0, len * 0.42, len * 0.58, len],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: eInOut }
  );
  return <AbsoluteFill style={{ backgroundColor: color, opacity: op, zIndex: 30 }} />;
};

/** Persianas: lamas verticales que barren escalonadas — corte de prensa. */
export const Blinds: React.FC<{ color: string; len: number; bars?: number; dir?: "down" | "up" }> = ({ color, len, bars = 5, dir = "down" }) => {
  const frame = useCurrentFrame();
  const stagger = 2;
  const per = Math.max(6, len - (bars - 1) * stagger);
  const sign = dir === "up" ? -1 : 1;
  return (
    <AbsoluteFill style={{ zIndex: 30, flexDirection: "row" }}>
      {Array.from({ length: bars }, (_, j) => {
        const pos = sweep(Math.max(0, frame - j * stagger), per);
        return (
          <div key={j} style={{ width: `${100 / bars}%`, height: "100%", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: color, transform: `translateY(${pos * sign}%)` }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Destello (flashazo de cámara): sube y cae rápido. */
export const Flash: React.FC<{ color: string; len: number }> = ({ color, len }) => {
  const frame = useCurrentFrame();
  const mid = len * 0.4;
  const op = frame <= mid
    ? interpolate(frame, [0, mid], [0, 0.92], { easing: Easing.out(Easing.quad) })
    : interpolate(frame, [mid, len], [0.92, 0], { easing: Easing.in(Easing.quad) });
  return <AbsoluteFill style={{ backgroundColor: color, opacity: op, zIndex: 30 }} />;
};
