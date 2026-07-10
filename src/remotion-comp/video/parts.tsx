/**
 * Primitivas de movimiento. Varias entradas distintas (no una sola) para que
 * cada tipo de escena se sienta diferente y el video no se vuelva monótono.
 */
import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import type { Line } from "../score/schema";
import { prog } from "../theme/motion";

/** Sube el contenido detras de una mascara (overflow hidden). */
export const MaskRise: React.FC<{
  delay?: number; dur?: number; style?: React.CSSProperties; children: React.ReactNode;
}> = ({ delay = 0, dur = 30, style, children }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, delay, dur);
  return (
    <span style={{ display: "block", overflow: "hidden", ...style }}>
      <span style={{ display: "block", transform: `translateY(${(1 - p) * 118}%)`, willChange: "transform", paddingBottom: "0.16em" }}>
        {children}
      </span>
    </span>
  );
};

/** Aparicion suave con leve empuje vertical. */
export const Fade: React.FC<{
  delay?: number; dur?: number; y?: number; style?: React.CSSProperties; children: React.ReactNode;
}> = ({ delay = 0, dur = 22, y = 14, style, children }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, delay, dur);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)`, ...style }}>{children}</div>;
};

/** Hairline / subrayado que se dibuja de izquierda a derecha. */
export const DrawBar: React.FC<{
  delay?: number; color: string; width?: number | string; height?: number; dur?: number;
}> = ({ delay = 0, color, width = 280, height = 2, dur = 24 }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, delay, dur);
  return <div style={{ width, height, background: color, transform: `scaleX(${p})`, transformOrigin: "left center" }} />;
};

/** Palabra por palabra: cada palabra entra en su beat. La entrada mas kinetica. */
export const WordReveal: React.FC<{
  line: Line; ink: string; accent: string; delay?: number; per?: number;
}> = ({ line, ink, accent, delay = 0, per = 3 }) => {
  const frame = useCurrentFrame();
  let idx = 0;
  return (
    <span style={{ display: "inline" }}>
      {line.flatMap((sp, si) =>
        sp.text.split(/(\s+)/).map((w, wi) => {
          if (w === "" ) return null;
          if (/^\s+$/.test(w)) return <span key={`${si}-${wi}`}>{w}</span>;
          const d = delay + idx++ * per;
          const p = prog(frame, d, 15);
          return (
            <span key={`${si}-${wi}`} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 0.55}em)`, color: sp.accent ? accent : ink, fontStyle: sp.italic ? "italic" : "normal" }}>
              {w}
            </span>
          );
        })
      )}
    </span>
  );
};

/** Escala con rebote (spring): entra grande y asienta con un pop. */
export const ScalePunch: React.FC<{
  delay?: number; from?: number; origin?: string; children: React.ReactNode;
}> = ({ delay = 0, from = 1.12, origin = "left center", children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 13, mass: 0.8, stiffness: 120 } });
  const scale = from + (1 - from) * s;
  const op = interpolate(frame, [delay, delay + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <span style={{ display: "inline-block", transform: `scale(${scale})`, transformOrigin: origin, opacity: op }}>{children}</span>;
};

/** Barrido de recorte: se revela de izquierda a derecha. */
export const ClipWipe: React.FC<{
  delay?: number; dur?: number; children: React.ReactNode;
}> = ({ delay = 0, dur = 22, children }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, delay, dur);
  return <span style={{ display: "inline-block", clipPath: `inset(0 ${(1 - p) * 100}% -0.2em 0)` }}>{children}</span>;
};

/** Entrada lateral con spring. */
export const SlideIn: React.FC<{
  delay?: number; dir?: "left" | "right"; children: React.ReactNode;
}> = ({ delay = 0, dir = "left", children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 18, mass: 0.9, stiffness: 110 } });
  const off = (1 - s) * (dir === "left" ? -140 : 140);
  const op = interpolate(frame, [delay, delay + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <span style={{ display: "inline-block", transform: `translateX(${off}px)`, opacity: op }}>{children}</span>;
};
