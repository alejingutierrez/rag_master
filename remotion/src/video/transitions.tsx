/**
 * Transiciones entre escenas — overlays que tapan el corte a su paso, todas
 * deterministas. El montaje (TypographicVideo) elige cuál según el ESTILO del
 * video y la semántica de la escena que entra:
 *   - Wipe: panel que barre; opcional filo (hairline que lidera) y diagonal.
 *   - DipToColor: fundido a color (negro casi siempre) — el corte respirado.
 *   - Blinds: persianas escalonadas con filo — energía de prensa/collage.
 *   - Flash: destello de cámara; `double` = dos fogonazos (prensa).
 *   - Bleed: la tinta inunda desde una esquina y abre por la opuesta (forense).
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

/** Lado del panel que va al frente durante todo el recorrido. */
function leadingSide(dir: WipeDir): "top" | "bottom" | "left" | "right" {
  switch (dir) {
    case "down": return "bottom";
    case "up": return "top";
    case "left": return "left";
    case "right": return "right";
  }
}

/**
 * Barrido de panel con bandas de sombra en los extremos (profundidad al pasar).
 * `edge` dibuja una hairline de color al frente del panel — el filo que anuncia
 * el corte. `skew` inclina el panel (borde diagonal), escalándolo para no dejar
 * esquinas al aire.
 */
export const Wipe: React.FC<{
  color: string; len: number; dir?: WipeDir; hard?: boolean; edge?: string; skew?: number;
}> = ({ color, len, dir = "down", hard = false, edge, skew = 0 }) => {
  const frame = useCurrentFrame();
  const pos = sweep(frame, len, hard);
  const vertical = dir === "down" || dir === "up";
  const shade = vertical
    ? "linear-gradient(180deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0) 12%, rgba(0,0,0,0) 88%, rgba(0,0,0,0.16) 100%)"
    : "linear-gradient(90deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0) 12%, rgba(0,0,0,0) 88%, rgba(0,0,0,0.16) 100%)";
  const lead = leadingSide(dir);
  const edgeStyle: React.CSSProperties | null = edge
    ? {
        position: "absolute",
        ...(lead === "top" ? { top: 0, left: 0, right: 0, height: 10 } : {}),
        ...(lead === "bottom" ? { bottom: 0, left: 0, right: 0, height: 10 } : {}),
        ...(lead === "left" ? { left: 0, top: 0, bottom: 0, width: 10 } : {}),
        ...(lead === "right" ? { right: 0, top: 0, bottom: 0, width: 10 } : {}),
        background: edge,
      }
    : null;
  const diag = skew ? ` rotate(${skew}deg) scale(${1 + Math.abs(skew) * 0.045})` : "";
  return (
    <AbsoluteFill style={{ transform: `${axisOf(dir)}(${pos * signOf(dir)}%)${diag}`, backgroundColor: color, zIndex: 30 }}>
      <AbsoluteFill style={{ background: shade }} />
      {edgeStyle && <div style={edgeStyle} />}
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

/** Persianas: lamas verticales que barren escalonadas, con filo opcional — corte de prensa. */
export const Blinds: React.FC<{
  color: string; len: number; bars?: number; dir?: "down" | "up"; edge?: string;
}> = ({ color, len, bars = 5, dir = "down", edge }) => {
  const frame = useCurrentFrame();
  const stagger = 2;
  const per = Math.max(6, len - (bars - 1) * stagger);
  const sign = dir === "up" ? -1 : 1;
  const lead = dir === "up" ? { top: 0 } : { bottom: 0 };
  return (
    <AbsoluteFill style={{ zIndex: 30, flexDirection: "row" }}>
      {Array.from({ length: bars }, (_, j) => {
        const pos = sweep(Math.max(0, frame - j * stagger), per);
        return (
          <div key={j} style={{ width: `${100 / bars}%`, height: "100%", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: color, transform: `translateY(${pos * sign}%)` }}>
              {edge && <div style={{ position: "absolute", left: 0, right: 0, height: 8, background: edge, ...lead }} />}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Destello (flashazo de cámara): sube y cae rápido. `double` dispara DOS
 * fogonazos decrecientes — la rueda de prensa.
 */
export const Flash: React.FC<{ color: string; len: number; double?: boolean }> = ({ color, len, double = false }) => {
  const frame = useCurrentFrame();
  let op: number;
  if (double) {
    // dos picos: 0→0.95 (cae a 0.18) → 0.7 → 0
    const a = len * 0.28, b = len * 0.46, c = len * 0.62;
    op = interpolate(
      frame,
      [0, a, b, c, len],
      [0, 0.95, 0.18, 0.7, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
    );
  } else {
    const mid = len * 0.4;
    op = frame <= mid
      ? interpolate(frame, [0, mid], [0, 0.92], { easing: Easing.out(Easing.quad) })
      : interpolate(frame, [mid, len], [0.92, 0], { easing: Easing.in(Easing.quad) });
  }
  return <AbsoluteFill style={{ backgroundColor: color, opacity: op, zIndex: 30 }} />;
};

/**
 * Sangrado de tinta: un charco de color inunda el cuadro desde una esquina
 * (borde suave, orgánico) y luego ABRE desde la esquina opuesta. El corte
 * forense de hueso-y-ceniza. `seed` alterna las esquinas.
 */
export const Bleed: React.FC<{ color: string; len: number; seed?: number }> = ({ color, len, seed = 0 }) => {
  const frame = useCurrentFrame();
  const half = len / 2;
  const corners = [
    ["26% 18%", "74% 84%"],
    ["78% 16%", "24% 82%"],
  ][seed % 2];
  // r crece 0→150 (inunda), luego un agujero crece 0→150 desde la otra esquina (abre)
  const flood = interpolate(frame, [0, half], [0, 150], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.6, 0, 0.3, 1) });
  const open = interpolate(frame, [half, len], [0, 150], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.55, 0, 0.35, 1) });
  const bg = frame <= half
    ? `radial-gradient(circle at ${corners[0]}, ${color} ${flood}%, transparent ${flood + 22}%)`
    : `radial-gradient(circle at ${corners[1]}, transparent ${open}%, ${color} ${open + 22}%)`;
  return <AbsoluteFill style={{ background: bg, zIndex: 30 }} />;
};
