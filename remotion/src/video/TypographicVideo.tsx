/**
 * El Escenario. El montaje lo dirige el ESTILO (stylepack): qué transición usa
 * cada corte (barrido, fundido, persianas, flash), con qué impulso entra el
 * contenido, cómo deriva durante el hold y cómo se va. Los cortes sin overlay
 * son duros, como en el prototipo; el pack decide dónde se ve la costura.
 */
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, Easing } from "remotion";
import type { TypographicScore, Scene, SceneBg } from "../score/schema";
import { paletteFor, bgColorFor, Palette } from "../theme/palette";
import { packFor, PackContext, type StylePack, type ExitKind } from "../theme/stylepack";
import { Layout } from "./layouts";
import { Chrome } from "./Chrome";
import { Wipe, DipToColor, Blinds, Flash, Bleed, type WipeDir } from "./transitions";
import { ArchivalImage, GRAIN, grainShift, type Pan } from "./media";

const bgOf = (s: Scene): SceneBg => s.bg ?? (s.kind === "corte" ? "dark" : "light");

/** Paneo por defecto cuando el Director no lo pide: varía para no repetirse. */
const PANS: Pan[] = ["in", "left", "up", "right", "in", "down"];

const DIRS: WipeDir[] = ["down", "left", "up", "right"];

/** La transición que entra a la escena `scene` (posición i), según el estilo. */
export interface CutSpec {
  kind: "wipe" | "dip" | "blinds" | "flash" | "bleed";
  color: string; dir: WipeDir; len: number; hard?: boolean;
  /** hairline al frente del panel (filo que anuncia el corte) */
  edge?: string;
  /** borde diagonal del panel, en grados */
  skew?: number;
  /** flash doble (prensa) */
  double?: boolean;
}

/** Filo que SIEMPRE contrasta con el panel: claro sobre color/acento, época sobre negro. */
const LIGHT = "#f7f6f4";
const edgeFor = (pack: StylePack, panel: string, palette: Palette): string | undefined =>
  pack.edge ? (panel === palette.bgDark ? palette.era : LIGHT) : undefined;

export function cutFor(pack: StylePack, scene: Scene, palette: Palette, i: number): CutSpec | null {
  const dir = DIRS[i % 4];
  const hasImg = !!scene.image || scene.kind === "imagen";
  const kind = scene.kind;
  const L = pack.cutLen;
  const skew = pack.skew ? pack.skew * (i % 2 === 0 ? 1 : -1) : 0;
  switch (pack.id) {
    case "hueso-y-ceniza": {
      // la tinta INUNDA al entrar a escenas claras (la apertura revela la escena);
      // sobre fondo oscuro no se vería, ahí van el barrido y el fundido
      const light = !scene.image && bgOf(scene) === "light";
      if (light) return { kind: "bleed", color: palette.bgDark, dir, len: 20 };
      if (hasImg) return { kind: "dip", color: palette.bgDark, dir, len: L };
      if (kind === "corte") return { kind: "wipe", color: palette.bgDark, dir, len: 15 };
      if (["nombre", "anio", "cierre"].includes(kind)) return { kind: "wipe", color: palette.accent, dir, len: 15 };
      return null;
    }
    case "manifiesto": {
      // proclama: cada golpe se anuncia con un barrido pleno con filo
      const panel = bgOf(scene) === "color" ? palette.bgDark : palette.era;
      return { kind: "wipe", color: panel, dir, len: L, edge: edgeFor(pack, panel, palette) };
    }
    case "brutalista": {
      // cortes secos DIAGONALES que alternan inclinación y color — siempre
      // en contraste con el fondo entrante (rojo sobre rojo = corte invisible)
      const panel = bgOf(scene) === "color" ? palette.bgDark : i % 2 === 0 ? palette.era : palette.bgDark;
      return { kind: "wipe", color: panel, dir, len: L, hard: true, skew };
    }
    case "cifra-monumento": {
      if (["cifra", "contraste", "anio"].includes(kind)) return { kind: "wipe", color: palette.accent, dir, len: L, edge: edgeFor(pack, palette.accent, palette) };
      if (hasImg) return { kind: "dip", color: palette.bgDark, dir, len: 16 };
      return null;
    }
    case "voces":
      if (kind === "cita" || hasImg) return { kind: "dip", color: palette.bgDark, dir, len: L };
      if (kind === "cifra" || kind === "cierre") return { kind: "wipe", color: palette.accent, dir, len: 14 };
      return null;
    case "cronologia": {
      // el tiempo marcha en un solo sentido: todos los barridos a la derecha, con filo
      if (kind === "anio") return { kind: "wipe", color: palette.era, dir: "right", len: L, edge: edgeFor(pack, palette.era, palette) };
      if (hasImg) return { kind: "dip", color: palette.bgDark, dir: "right", len: 16 };
      if (kind === "cierre") return { kind: "wipe", color: palette.accent, dir: "right", len: L, edge: edgeFor(pack, palette.accent, palette) };
      return null;
    }
    case "retrato":
      if (kind === "nombre" || kind === "cierre") return { kind: "wipe", color: palette.accent, dir, len: L };
      if (hasImg || kind === "cita") return { kind: "dip", color: palette.bgDark, dir, len: 17 };
      return null;
    case "archivo":
      // contemplativo: TODOS los cortes respiran a negro
      return { kind: "dip", color: palette.bgDark, dir, len: L };
    case "collage": {
      if (hasImg) return { kind: "blinds", color: palette.bgDark, dir, len: L, edge: edgeFor(pack, palette.bgDark, palette) };
      if (kind === "corte" || kind === "cierre") return { kind: "wipe", color: palette.bgDark, dir, len: 12, skew };
      return i % 2 === 0 ? { kind: "flash", color: LIGHT, dir, len: 10, double: true } : null;
    }
    default: {
      // editorial y afines: wipes refinados con filo
      if (hasImg) return { kind: "dip", color: palette.bgDark, dir, len: 16 };
      if (kind === "corte") return { kind: "wipe", color: palette.bgDark, dir, len: L, edge: edgeFor(pack, palette.bgDark, palette) };
      if (["cifra", "cita", "contraste", "cierre", "nombre", "anio"].includes(kind)) return { kind: "wipe", color: palette.accent, dir, len: L, edge: edgeFor(pack, palette.accent, palette) };
      return null;
    }
  }
}

/** Impulso de entrada del contenido, siguiendo la dirección del barrido. */
function enterOffset(cut: CutSpec | null): { x: number; y: number } {
  if (!cut || (cut.kind !== "wipe" && cut.kind !== "blinds")) return { x: 0, y: 0 };
  const m = cut.kind === "blinds" ? 12 : 26;
  switch (cut.dir) {
    case "down": return { x: 0, y: -m };
    case "up": return { x: 0, y: m };
    case "left": return { x: m, y: 0 };
    case "right": return { x: -m, y: 0 };
  }
}

/** Salidas por estilo: cómo se va el contenido antes del corte. */
const EXIT_TF: Record<ExitKind, Array<(p: number) => string>> = {
  varied: [
    (p) => `translateY(${-p * 72}px)`,
    (p) => `translateY(${p * 72}px)`,
    (p) => `scale(${1 - p * 0.14})`,
    (p) => `translateX(${-p * 96}px)`,
  ],
  fade: [() => ""],
  up: [(p) => `translateY(${-p * 84}px)`],
  crush: [(p) => `scale(${1 - p * 0.16}) translateY(${p * 26}px)`],
  slide: [(p) => `translateX(${-p * 110}px)`, (p) => `translateX(${p * 110}px)`],
};

const SceneBody: React.FC<{ scene: Scene; palette: Palette; pack: StylePack; dur: number; index: number; cut: CutSpec | null }> = ({ scene, palette, pack, dur, index, cut }) => {
  const frame = useCurrentFrame();
  const onImage = !!scene.image;
  const bg = onImage ? "dark" : bgOf(scene);

  // deriva durante el hold, con energía del estilo (alterna el sesgo horizontal)
  const driftScale = interpolate(frame, [0, dur], [1.0, 1 + 0.04 * pack.drift], { extrapolateRight: "clamp" });
  const driftY = interpolate(frame, [0, dur], [0, -14 * pack.drift], { extrapolateRight: "clamp" });
  const driftX = interpolate(frame, [0, dur], [0, (index % 2 === 0 ? -6 : 6) * pack.drift], { extrapolateRight: "clamp" });

  // impulso de entrada en la dirección del corte que nos reveló
  const off = enterOffset(cut);
  const ep = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const ex = off.x * (1 - ep), ey = off.y * (1 - ep);

  // SALIDA: en los últimos frames el contenido se va antes del corte, al estilo del pack.
  const EXIT = Math.min(16, Math.round(dur * 0.22));
  const exitP = interpolate(frame, [dur - EXIT, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const exits = EXIT_TF[pack.exit];
  const exTf = exits[index % exits.length](exitP);

  // Sobre imagen, el texto va claro (bg="dark"); la ArchivalImage es el fondo real.
  const layoutScene = onImage ? ({ ...scene, bg: "dark" } as Scene) : scene;
  return (
    <AbsoluteFill style={{ backgroundColor: bgColorFor(palette, bg) }}>
      {onImage && (
        <ArchivalImage
          src={scene.image!}
          era={palette.era}
          dur={dur}
          pan={scene.pan ?? PANS[index % PANS.length]}
          scrim={scene.scrim ?? (scene.kind === "imagen" ? "full" : "bottom")}
          energy={pack.kenburns}
          treat={pack.image}
          printFrame={pack.image.frame && scene.kind === "imagen"}
          seed={index}
        />
      )}
      <AbsoluteFill style={{ transform: `translate(${ex}px, ${ey}px) scale(${driftScale}) translate(${driftX}px, ${driftY}px) ${exTf}`, transformOrigin: "50% 46%", opacity: 1 - exitP }}>
        <Layout scene={layoutScene} palette={palette} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Grano global animado (shimmer de película, determinista). */
const GlobalGrain: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundImage: GRAIN, backgroundPosition: grainShift(frame), opacity, mixBlendMode: "multiply", pointerEvents: "none", zIndex: 20 }} />
  );
};

export const TypographicVideo: React.FC<TypographicScore> = (score) => {
  const palette = paletteFor(score.meta.periodCode, score.meta.personality);
  const pack = packFor(score.meta.personality);
  const cuts = score.scenes.map((s, i) => (i === 0 ? null : cutFor(pack, s, palette, i)));
  return (
    <PackContext.Provider value={pack}>
      <AbsoluteFill style={{ backgroundColor: palette.bg }}>
        {score.scenes.map((scene, i) => (
          <Sequence key={i} from={scene.from} durationInFrames={scene.durationInFrames} layout="none">
            <SceneBody scene={scene} palette={palette} pack={pack} dur={scene.durationInFrames} index={i} cut={cuts[i]} />
          </Sequence>
        ))}

        <GlobalGrain opacity={pack.grain} />

        {score.scenes.map((scene, i) => {
          const w = cuts[i];
          if (!w) return null;
          const from = Math.max(0, scene.from - Math.round(w.len / 2));
          return (
            <Sequence key={`w${i}`} from={from} durationInFrames={w.len} layout="none">
              {w.kind === "wipe" && <Wipe color={w.color} len={w.len} dir={w.dir} hard={w.hard} edge={w.edge} skew={w.skew} />}
              {w.kind === "dip" && <DipToColor color={w.color} len={w.len} />}
              {w.kind === "blinds" && <Blinds color={w.color} len={w.len} dir={w.dir === "up" ? "up" : "down"} edge={w.edge} />}
              {w.kind === "flash" && <Flash color={w.color} len={w.len} double={w.double} />}
              {w.kind === "bleed" && <Bleed color={w.color} len={w.len} seed={i} />}
            </Sequence>
          );
        })}

        <AbsoluteFill style={{ zIndex: 50, pointerEvents: "none" }}>
          <Chrome score={score} palette={palette} />
        </AbsoluteFill>
      </AbsoluteFill>
    </PackContext.Provider>
  );
};
