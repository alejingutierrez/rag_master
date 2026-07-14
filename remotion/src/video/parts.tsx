/**
 * Primitivas de movimiento. Un vocabulario amplio de entradas para que cada
 * tipo de escena tenga la suya y el video nunca se sienta monótono. Todas son
 * deterministas (función pura del frame) — nada de Math.random ni Date.
 */
import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate, Easing } from "remotion";
import type { Line } from "../score/schema";
import { prog } from "../theme/motion";

/** back-out: se pasa un pelo y asienta — para subrayados y barras. */
const eBack = Easing.bezier(0.34, 1.56, 0.64, 1);

/** Sube el contenido detrás de una máscara (overflow hidden), con leve tilt que asienta. */
export const MaskRise: React.FC<{
  delay?: number; dur?: number; tilt?: number; style?: React.CSSProperties; children: React.ReactNode;
}> = ({ delay = 0, dur = 30, tilt = 0, style, children }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, delay, dur);
  const rot = tilt ? ` rotate(${(1 - p) * tilt}deg)` : "";
  return (
    <span style={{ display: "block", overflow: "hidden", ...style }}>
      <span style={{ display: "block", transform: `translateY(${(1 - p) * 118}%)${rot}`, transformOrigin: "left bottom", willChange: "transform", paddingBottom: "0.16em" }}>
        {children}
      </span>
    </span>
  );
};

/** Aparición suave con leve empuje vertical (y opcional horizontal). */
export const Fade: React.FC<{
  delay?: number; dur?: number; y?: number; x?: number; style?: React.CSSProperties; children: React.ReactNode;
}> = ({ delay = 0, dur = 22, y = 14, x = 0, style, children }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, delay, dur);
  return <div style={{ opacity: p, transform: `translate(${(1 - p) * x}px, ${(1 - p) * y}px)`, ...style }}>{children}</div>;
};

/** Hairline / subrayado que se dibuja con un leve overshoot (asienta con carácter). */
export const DrawBar: React.FC<{
  delay?: number; color: string; width?: number | string; height?: number; dur?: number;
}> = ({ delay = 0, color, width = 280, height = 2, dur = 24 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: eBack,
  });
  return <div style={{ width, height, background: color, transform: `scaleX(${Math.max(0, p)})`, transformOrigin: "left center" }} />;
};

/** Etiqueta mono que entra APRETANDO el tracking (de abierto a su sitio) — título documental. */
export const TrackIn: React.FC<{
  delay?: number; dur?: number; from?: number; track?: number; style?: React.CSSProperties; children: React.ReactNode;
}> = ({ delay = 0, dur = 26, from = 0.3, track = 0.24, style, children }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, delay, dur);
  // sin nowrap: las etiquetas largas envuelven como siempre
  return (
    <span style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 8}px)`, ...style, letterSpacing: `${track + (1 - p) * from}em` }}>
      {children}
    </span>
  );
};

/**
 * Palabra por palabra, cada una subiendo tras su propia máscara — la entrada
 * más kinetic. Las palabras con acento pueden llevar subrayado que barre al
 * aterrizar (`underline`).
 */
export const WordReveal: React.FC<{
  line: Line; ink: string; accent: string; delay?: number; per?: number; underline?: boolean;
}> = ({ line, ink, accent, delay = 0, per = 3, underline = false }) => {
  const frame = useCurrentFrame();
  let idx = 0;
  return (
    <span style={{ display: "inline" }}>
      {line.flatMap((sp, si) =>
        sp.text.split(/(\s+)/).map((w, wi) => {
          if (w === "") return null;
          if (/^\s+$/.test(w)) return <span key={`${si}-${wi}`}>{w}</span>;
          const d = delay + idx++ * per;
          const p = prog(frame, d, 16);
          const u = sp.accent && underline
            ? interpolate(frame, [d + 10, d + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: eBack })
            : 0;
          return (
            <span key={`${si}-${wi}`} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", paddingBottom: "0.14em", marginBottom: "-0.14em" }}>
              <span
                style={{
                  display: "inline-block", position: "relative",
                  transform: `translateY(${(1 - p) * 112}%)`,
                  color: sp.accent ? accent : ink, fontStyle: sp.italic ? "italic" : "normal",
                }}
              >
                {w}
                {sp.accent && underline && (
                  <span style={{ position: "absolute", left: 0, right: 0, bottom: "0.02em", height: "0.045em", background: accent, transform: `scaleX(${Math.max(0, u)})`, transformOrigin: "left center" }} />
                )}
              </span>
            </span>
          );
        })
      )}
    </span>
  );
};

/** Letra por letra tras máscara — para el nombre enorme o el año protagonista. */
export const LetterRise: React.FC<{
  text: string; delay?: number; per?: number; dur?: number; style?: React.CSSProperties;
}> = ({ text, delay = 0, per = 2, dur = 26, style }) => {
  const frame = useCurrentFrame();
  const chars = Array.from(text);
  return (
    <span style={{ display: "inline-block", whiteSpace: "pre", ...style }}>
      {chars.map((ch, i) => {
        const p = prog(frame, delay + i * per, dur);
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", paddingBottom: "0.12em", marginBottom: "-0.12em" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 112}%)`, willChange: "transform" }}>
              {ch === " " ? " " : ch}
            </span>
          </span>
        );
      })}
    </span>
  );
};

/**
 * Un bloque de color barre sobre el texto y lo deja revelado: cubre (scaleX
 * desde la izquierda) y se retira (hacia la derecha). El golpe editorial clásico.
 */
export const BlockReveal: React.FC<{
  delay?: number; dur?: number; color: string; children: React.ReactNode;
}> = ({ delay = 0, dur = 30, color, children }) => {
  const frame = useCurrentFrame();
  const cover = interpolate(frame, [delay, delay + dur * 0.45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.7, 0, 0.3, 1) });
  const uncover = interpolate(frame, [delay + dur * 0.55, delay + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.7, 0, 0.3, 1) });
  const visible = frame >= delay + dur * 0.5;
  return (
    <span style={{ display: "inline-block", position: "relative" }}>
      <span style={{ opacity: visible ? 1 : 0 }}>{children}</span>
      <span
        style={{
          position: "absolute", top: "-0.04em", bottom: "0.06em", left: 0, right: 0, background: color,
          transform: uncover > 0 ? `scaleX(${1 - uncover})` : `scaleX(${cover})`,
          transformOrigin: uncover > 0 ? "right center" : "left center",
        }}
      />
    </span>
  );
};

/** Enfoque que llega: desenfocado y abajo → nítido en su sitio. Para citas y subs. */
export const BlurRise: React.FC<{
  delay?: number; dur?: number; y?: number; style?: React.CSSProperties; children: React.ReactNode;
}> = ({ delay = 0, dur = 26, y = 24, style, children }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, delay, dur);
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)`, filter: `blur(${(1 - p) * 9}px)`, willChange: "filter, transform", ...style }}>
      {children}
    </div>
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
