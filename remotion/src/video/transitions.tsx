/**
 * Transiciones entre escenas. Un barrido (Wipe) de panel a pantalla completa
 * que tapa el corte a su paso — hace que el cambio de escena SE VEA. El color
 * es el de la época (o negro en los cortes dramáticos).
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";

const eInOut = Easing.bezier(0.7, 0, 0.25, 1);

export type WipeDir = "down" | "up" | "left" | "right";

export const Wipe: React.FC<{ color: string; len: number; dir?: WipeDir }> = ({ color, len, dir = "down" }) => {
  const frame = useCurrentFrame();
  const half = len / 2;
  // panel: entra (−110) → cubre (0) a la mitad → sale (+110)
  const pos =
    frame <= half
      ? interpolate(frame, [0, half], [-110, 0], { easing: eInOut })
      : interpolate(frame, [half, len], [0, 110], { easing: eInOut });
  const axis = dir === "left" || dir === "right" ? "translateX" : "translateY";
  const sign = dir === "up" || dir === "left" ? -1 : 1;
  return <AbsoluteFill style={{ transform: `${axis}(${pos * sign}%)`, backgroundColor: color, zIndex: 30 }} />;
};

export const Flash: React.FC<{ color: string; len: number }> = ({ color, len }) => {
  const frame = useCurrentFrame();
  const mid = len / 2;
  const op = frame <= mid ? interpolate(frame, [0, mid], [0, 1]) : interpolate(frame, [mid, len], [1, 0]);
  return <AbsoluteFill style={{ backgroundColor: color, opacity: op, zIndex: 30 }} />;
};
