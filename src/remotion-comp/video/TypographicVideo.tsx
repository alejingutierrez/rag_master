/**
 * El Escenario. Cortes DUROS entre escenas (cada una entra de golpe) + un
 * barrido (Wipe) en los cambios importantes para que se vean. Cada escena
 * deriva sutilmente durante su hold (escala/translación) para no congelarse.
 */
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, Easing } from "remotion";
import type { TypographicScore, Scene, SceneBg } from "../score/schema";
import { paletteFor, bgColorFor, Palette } from "../theme/palette";
import { Layout } from "./layouts";
import { Chrome } from "./Chrome";
import { Wipe, type WipeDir } from "./transitions";
import { ArchivalImage } from "./media";

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

const bgOf = (s: Scene): SceneBg => s.bg ?? (s.kind === "corte" ? "dark" : "light");

// Salidas variadas: no todas las escenas se van igual (sube / cae / se encoge / de lado).
const EXIT_TF: Array<(p: number) => string> = [
  (p) => `translateY(${-p * 72}px)`,
  (p) => `translateY(${p * 72}px)`,
  (p) => `scale(${1 - p * 0.14})`,
  (p) => `translateX(${-p * 96}px)`,
];

const SceneBody: React.FC<{ scene: Scene; palette: Palette; dur: number; index: number }> = ({ scene, palette, dur, index }) => {
  const frame = useCurrentFrame();
  const onImage = !!scene.image;
  const bg = onImage ? "dark" : bgOf(scene);
  const driftScale = interpolate(frame, [0, dur], [1.0, 1.04], { extrapolateRight: "clamp" });
  const driftY = interpolate(frame, [0, dur], [0, -14], { extrapolateRight: "clamp" });
  // SALIDA: en los últimos frames el texto se va antes del corte, con estilo según la escena.
  const EXIT = Math.min(16, Math.round(dur * 0.22));
  const exitP = interpolate(frame, [dur - EXIT, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const exTf = EXIT_TF[index % EXIT_TF.length](exitP);
  // Sobre imagen, el texto va claro (bg="dark"); la ArchivalImage es el fondo real.
  const layoutScene = onImage ? ({ ...scene, bg: "dark" } as Scene) : scene;
  return (
    <AbsoluteFill style={{ backgroundColor: bgColorFor(palette, bg) }}>
      {onImage && (
        <ArchivalImage src={scene.image!} era={palette.era} dur={dur} pan={scene.pan ?? "in"} scrim={scene.scrim ?? (scene.kind === "imagen" ? "full" : "bottom")} />
      )}
      <AbsoluteFill style={{ transform: `scale(${driftScale}) translateY(${driftY}px) ${exTf}`, transformOrigin: "50% 46%", opacity: 1 - exitP }}>
        <Layout scene={layoutScene} palette={palette} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const WIPE_LEN = 15;

const WIPE_DIRS: WipeDir[] = ["down", "up", "left", "right"];

/** Qué cambios de escena llevan barrido (color + dirección que rota). El resto, corte seco. */
function wipeFor(next: Scene, palette: Palette, i: number): { color: string; dir: WipeDir } | null {
  const dir = WIPE_DIRS[i % WIPE_DIRS.length];
  const bg = bgOf(next);
  if (next.image) return { color: palette.bgDark, dir }; // negro revela la foto
  if (next.kind === "corte") return { color: palette.bgDark, dir };
  if (bg === "color") return { color: palette.era, dir };
  if (["cifra", "contraste", "nombre", "anio", "cierre", "cita"].includes(next.kind))
    return { color: palette.accent, dir };
  return null;
}

export const TypographicVideo: React.FC<TypographicScore> = (score) => {
  const palette = paletteFor(score.meta.periodCode, score.meta.personality);
  return (
    <AbsoluteFill style={{ backgroundColor: palette.bg }}>
      {score.scenes.map((scene, i) => (
        <Sequence key={i} from={scene.from} durationInFrames={scene.durationInFrames} layout="none">
          <SceneBody scene={scene} palette={palette} dur={scene.durationInFrames} index={i} />
        </Sequence>
      ))}

      <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.045, mixBlendMode: "multiply", pointerEvents: "none", zIndex: 20 }} />

      {score.scenes.slice(1).map((scene, i) => {
        const w = wipeFor(scene, palette, i);
        if (!w) return null;
        const from = Math.max(0, scene.from - Math.round(WIPE_LEN / 2));
        return (
          <Sequence key={`w${i}`} from={from} durationInFrames={WIPE_LEN} layout="none">
            <Wipe color={w.color} len={WIPE_LEN} dir={w.dir} />
          </Sequence>
        );
      })}

      <AbsoluteFill style={{ zIndex: 50, pointerEvents: "none" }}>
        <Chrome score={score} palette={palette} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
