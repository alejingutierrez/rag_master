/**
 * Capa de imagen: imagen de archivo B/N (generada por el sistema gpt-image de la
 * casa) fundida con la línea gráfica. Dos primitivas:
 *   - ArchivalImage: a sangre completa, duotono (B/N + tinte de época), Ken Burns
 *     (movimiento lento) y scrim para que el texto encima sea legible.
 *   - ImageText: la imagen SE VE DENTRO de las letras (image-in-type).
 * Las imágenes viven en remotion/public/img/.
 */
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, Easing } from "remotion";

/** Rutas remotas (http/s) van directas; las locales pasan por staticFile (public/). */
const srcUrl = (src: string) => (/^https?:\/\//.test(src) ? src : staticFile(src));

export type Pan = "in" | "left" | "right" | "up" | "down";
export type Scrim = "bottom" | "top" | "full" | "none";

const scrimCss = (scrim: Scrim): string => {
  switch (scrim) {
    case "full": return "linear-gradient(180deg, rgba(8,8,8,.42), rgba(8,8,8,.62))";
    case "top": return "linear-gradient(180deg, rgba(8,8,8,.72) 0%, rgba(8,8,8,.05) 45%)";
    case "bottom": return "linear-gradient(180deg, rgba(8,8,8,.04) 34%, rgba(8,8,8,.78) 100%)";
    case "none": return "none";
  }
};

export const ArchivalImage: React.FC<{
  src: string; era: string; dur: number; scrim?: Scrim; pan?: Pan; from?: number;
}> = ({ src, era, dur, scrim = "bottom", pan = "in", from = 0 }) => {
  const frame = useCurrentFrame();
  // Resiliencia: si la imagen de archivo falla al cargar (URL caída, 403 de un
  // CDN), NO tumbamos el render — la escena cae a fondo negro + tipografía.
  // `onError` evita que <Img> lance y cancele todo el video en Lambda.
  const [failed, setFailed] = React.useState(false);
  const t = interpolate(frame, [from, from + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const scale = (pan === "in" ? 1.06 : 1.12) + t * 0.14;
  const tx = pan === "left" ? -t * 46 : pan === "right" ? t * 46 : 0;
  const ty = pan === "up" ? -t * 46 : pan === "down" ? t * 46 : 0;
  const css = scrimCss(scrim);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {!failed && (
        <AbsoluteFill style={{ transform: `scale(${scale}) translate(${tx}px, ${ty}px)`, willChange: "transform" }}>
          <Img src={srcUrl(src)} onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) contrast(1.08) brightness(0.97)" }} />
          <AbsoluteFill style={{ backgroundColor: era, mixBlendMode: "overlay", opacity: 0.14 }} />
        </AbsoluteFill>
      )}
      {css !== "none" && <AbsoluteFill style={{ background: css }} />}
    </AbsoluteFill>
  );
};

/** La imagen se ve dentro del texto (background-clip: text). Las imágenes ya son B/N. */
export const ImageText: React.FC<{ src: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ src, children, style }) => (
  <span
    style={{
      backgroundImage: `url(${srcUrl(src)})`,
      backgroundSize: "cover",
      backgroundPosition: "center 40%",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
      WebkitTextFillColor: "transparent",
      ...style,
    }}
  >
    {children}
  </span>
);
