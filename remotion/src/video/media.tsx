/**
 * Capa de imagen: archivo B/N fundido con la línea gráfica. El TRATAMIENTO es
 * del estilo (stylepack): duotono de época, contraste, viñeta, grano animado,
 * energía del Ken Burns, y el modo "copia impresa" (borde blanco + rotación)
 * para los estilos de prensa. Dos primitivas:
 *   - ArchivalImage: a sangre completa (o impresa), con paneo lento y scrim.
 *   - ImageText: la imagen SE VE DENTRO de las letras, y panea despacio dentro.
 */
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, Easing } from "remotion";
import type { ImageTreat } from "../theme/stylepack";

/** Rutas remotas (http/s) van directas; las locales pasan por staticFile (public/). */
const srcUrl = (src: string) => (/^https?:\/\//.test(src) ? src : staticFile(src));

export type Pan = "in" | "left" | "right" | "up" | "down";
export type Scrim = "bottom" | "top" | "full" | "none";

/** Grano de película (SVG fractal) — se anima moviendo el background por frame. */
export const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

/** Posición de grano determinista que cambia cada frame (shimmer de película). */
export const grainShift = (frame: number) => `${(frame * 17) % 120}px ${(frame * 31) % 120}px`;

const scrimCss = (scrim: Scrim): string => {
  switch (scrim) {
    case "full": return "linear-gradient(180deg, rgba(8,8,8,.42), rgba(8,8,8,.62))";
    case "top": return "linear-gradient(180deg, rgba(8,8,8,.72) 0%, rgba(8,8,8,.05) 45%)";
    case "bottom": return "linear-gradient(180deg, rgba(8,8,8,.04) 34%, rgba(8,8,8,.78) 100%)";
    case "none": return "none";
  }
};

const DEFAULT_TREAT: ImageTreat = {
  duotone: 0.14, contrast: 1.08, brightness: 0.97, vignette: 0.26, grain: 0.05, frame: false,
};

export const ArchivalImage: React.FC<{
  src: string; era: string; dur: number; scrim?: Scrim; pan?: Pan; from?: number;
  /** energía del Ken Burns (pack.kenburns) */
  energy?: number;
  /** tratamiento del estilo (pack.image) */
  treat?: ImageTreat;
  /** true = copia impresa (borde blanco, rotación leve) — solo escenas "imagen" */
  printFrame?: boolean;
  /** índice de escena: alterna la rotación de la copia impresa */
  seed?: number;
}> = ({ src, era, dur, scrim = "bottom", pan = "in", from = 0, energy = 1, treat = DEFAULT_TREAT, printFrame = false, seed = 0 }) => {
  const frame = useCurrentFrame();
  // Resiliencia: si la imagen falla al cargar (URL caída, 403), NO tumbamos el
  // render — la escena cae a fondo negro + tipografía. `onError` evita que
  // <Img> lance y cancele todo el video en Lambda.
  const [failed, setFailed] = React.useState(false);
  const t = interpolate(frame, [from, from + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  // Asentamiento de entrada: la foto llega un pelo más grande y asienta (sin
  // fade — los cortes en seco no deben parpadear).
  const settle = interpolate(frame, [from, from + 12], [1.045, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const scale = ((pan === "in" ? 1.06 : 1.12) + t * 0.14 * energy) * settle;
  const drift = 46 * energy;
  const tx = pan === "left" ? -t * drift : pan === "right" ? t * drift : 0;
  const ty = pan === "up" ? -t * drift : pan === "down" ? t * drift : 0;
  const css = scrimCss(scrim);
  const filter = `grayscale(1) contrast(${treat.contrast}) brightness(${treat.brightness})`;

  const picture = (
    <AbsoluteFill style={{ transform: `scale(${scale}) translate(${tx}px, ${ty}px)`, willChange: "transform" }}>
      <Img src={srcUrl(src)} onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover", filter }} />
      <AbsoluteFill style={{ backgroundColor: era, mixBlendMode: "overlay", opacity: treat.duotone }} />
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {!failed && (printFrame ? (
        // Copia impresa: papel con borde, rotación alterna y sombra honda sobre negro.
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div
            style={{
              position: "absolute", top: "11%", bottom: "27%", left: "7%", right: "7%",
              background: "#f4f1ea", padding: 18, transform: `rotate(${seed % 2 === 0 ? 1.2 : -1.2}deg) scale(${settle})`,
              boxShadow: "0 42px 110px rgba(0,0,0,0.55)",
            }}
          >
            <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, transform: `scale(${1.04 + t * 0.1 * energy}) translate(${tx * 0.6}px, ${ty * 0.6}px)` }}>
                <Img src={srcUrl(src)} onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover", filter }} />
                <div style={{ position: "absolute", inset: 0, backgroundColor: era, mixBlendMode: "overlay", opacity: treat.duotone }} />
              </div>
            </div>
          </div>
        </AbsoluteFill>
      ) : (
        picture
      ))}
      {/* viñeta: oscurece bordes, foco al centro */}
      {!failed && !printFrame && treat.vignette > 0 && (
        <AbsoluteFill style={{ background: "radial-gradient(120% 100% at 50% 44%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.72) 100%)", opacity: treat.vignette }} />
      )}
      {/* grano de película animado sobre la foto */}
      {!failed && treat.grain > 0 && (
        <AbsoluteFill style={{ backgroundImage: GRAIN, backgroundPosition: grainShift(frame), opacity: treat.grain, mixBlendMode: "overlay" }} />
      )}
      {css !== "none" && !printFrame && <AbsoluteFill style={{ background: css }} />}
    </AbsoluteFill>
  );
};

/**
 * La imagen se ve dentro del texto (background-clip: text) y panea despacio
 * dentro. El filtro B/N se aplica al span (afecta lo que se ve por las letras),
 * así el archivo a color no rompe la línea gráfica.
 */
export const ImageText: React.FC<{ src: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ src, children, style }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  return (
    <span
      style={{
        backgroundImage: `url(${srcUrl(src)})`,
        backgroundSize: "cover",
        backgroundPosition: `center ${46 - p * 10}%`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        WebkitTextFillColor: "transparent",
        filter: "grayscale(1) contrast(1.12)",
        ...style,
      }}
    >
      {children}
    </span>
  );
};
