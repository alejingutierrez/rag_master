/**
 * Chrome persistente: etiqueta de epoca (con punto de color) + "9:16" arriba,
 * marca abajo, y la barra de ritmo con marcas en cada corte de escena.
 * La tinta se voltea segun el fondo de la escena activa (el cruce cae a mitad
 * del crossfade para que no parpadee).
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { TypographicScore, SceneBg } from "../score/schema";
import { Palette, inkSoftFor, lineFor, PERIOD_LABEL } from "../theme/palette";
import { FONT } from "../theme/fonts";

const FADE = 12;

export const Chrome: React.FC<{ score: TypographicScore; palette: Palette }> = ({ score, palette }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // fondo de la escena activa; el cruce ocurre a mitad del crossfade (+FADE/2)
  let bg: SceneBg = "light";
  for (const s of score.scenes) if (frame >= s.from + FADE / 2) bg = s.bg ?? "light";

  const soft = inkSoftFor(palette, bg);
  const line = lineFor(palette, bg);
  const faint = bg === "dark" ? "#6f6f6f" : palette.inkFaint;
  const p = Math.min(1, frame / durationInFrames);

  return (
    <>
      <div style={{ position: "absolute", top: 70, left: 84, right: 84, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 23, letterSpacing: "0.24em", textTransform: "uppercase", color: soft, display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: palette.era, boxShadow: `0 0 0 6px ${palette.era}22` }} />
          {PERIOD_LABEL[score.meta.periodCode]}
        </span>
        <span style={{ fontFamily: FONT.mono, fontSize: 21, letterSpacing: "0.14em", color: faint }}>9:16</span>
      </div>

      <div style={{ position: "absolute", bottom: 150, left: 84, right: 84, height: 2, background: line }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${p * 100}%`, background: palette.accent }} />
        {score.scenes.slice(1).map((s, i) => (
          <span key={i} style={{ position: "absolute", top: -3, left: `${(s.from / durationInFrames) * 100}%`, width: 2, height: 8, background: line }} />
        ))}
      </div>

      <div style={{ position: "absolute", bottom: 74, left: 84, right: 84, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 21, letterSpacing: "0.22em", textTransform: "uppercase", color: faint }}>Historia Colombiana</span>
        <span style={{ fontFamily: FONT.mono, fontSize: 21, letterSpacing: "0.14em", color: faint }}>historiacolombiana.com</span>
      </div>
    </>
  );
};
