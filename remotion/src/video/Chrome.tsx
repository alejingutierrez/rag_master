/**
 * Chrome persistente: etiqueta de época (con punto de color que late) + "9:16"
 * arriba, marca abajo, y la barra de ritmo con marcas en cada corte — las ya
 * recorridas quedan en acento. Todo entra animado en el primer segundo.
 * La tinta se voltea según el fondo de la escena activa (las escenas con foto
 * cuentan como fondo oscuro; el cruce cae a mitad del corte para no parpadear).
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { TypographicScore, SceneBg } from "../score/schema";
import { Palette, inkSoftFor, lineFor, PERIOD_LABEL } from "../theme/palette";
import { FONT } from "../theme/fonts";
import { prog } from "../theme/motion";

const FADE = 12;

export const Chrome: React.FC<{ score: TypographicScore; palette: Palette }> = ({ score, palette }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // fondo de la escena activa; las escenas con imagen se tratan como oscuras
  let bg: SceneBg = "light";
  let active = 0, activeFrom = 0;
  for (let i = 0; i < score.scenes.length; i++) {
    const s = score.scenes[i];
    if (frame >= s.from + FADE / 2) {
      bg = s.image ? "dark" : s.bg ?? "light";
      active = i; activeFrom = s.from;
    }
  }

  const soft = inkSoftFor(palette, bg);
  const line = lineFor(palette, bg);
  const faint = bg === "dark" ? "#6f6f6f" : palette.inkFaint;
  const p = Math.min(1, frame / durationInFrames);

  // entrada del chrome en el primer segundo
  const inTop = prog(frame, 6, 20);
  const inBar = prog(frame, 10, 20);
  const inBottom = prog(frame, 14, 20);
  // pulso sutil del punto de época (determinista)
  const pulse = 1 + 0.07 * Math.sin(frame / 7);

  return (
    <>
      <div style={{ position: "absolute", top: 70, left: 84, right: 84, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: inTop, transform: `translateY(${(1 - inTop) * -10}px)` }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 23, letterSpacing: "0.24em", textTransform: "uppercase", color: soft, display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: palette.era, boxShadow: `0 0 0 6px ${palette.era}22`, transform: `scale(${pulse})` }} />
          {PERIOD_LABEL[score.meta.periodCode]}
        </span>
        <span style={{ fontFamily: FONT.mono, fontSize: 21, letterSpacing: "0.14em", color: faint }}>9:16</span>
      </div>

      {/* contador de escena: sube tras máscara en cada corte (pulso de producción) */}
      <div style={{ position: "absolute", bottom: 168, right: 84, overflow: "hidden", opacity: inBar }}>
        {(() => {
          const cp = active === 0 ? 1 : prog(frame, Math.max(0, activeFrom + FADE / 2), 12);
          return (
            <span style={{ display: "block", fontFamily: FONT.mono, fontSize: 20, letterSpacing: "0.18em", color: faint, transform: `translateY(${(1 - cp) * 110}%)` }}>
              {String(active + 1).padStart(2, "0")} · {String(score.scenes.length).padStart(2, "0")}
            </span>
          );
        })()}
      </div>

      <div style={{ position: "absolute", bottom: 150, left: 84, right: 84, height: 2, background: line, transform: `scaleX(${inBar})`, transformOrigin: "left center" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${p * 100}%`, background: palette.accent }} />
        {score.scenes.slice(1).map((s, i) => {
          const passed = frame >= s.from;
          return (
            <span
              key={i}
              style={{
                position: "absolute", top: passed ? -4 : -3, left: `${(s.from / durationInFrames) * 100}%`,
                width: 2, height: passed ? 10 : 8, background: passed ? palette.accent : line,
              }}
            />
          );
        })}
      </div>

      <div style={{ position: "absolute", bottom: 74, left: 84, right: 84, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: inBottom, transform: `translateY(${(1 - inBottom) * 10}px)` }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 21, letterSpacing: "0.22em", textTransform: "uppercase", color: faint }}>Historia Colombiana</span>
        <span style={{ fontFamily: FONT.mono, fontSize: 21, letterSpacing: "0.14em", color: faint }}>historiacolombiana.com</span>
      </div>
    </>
  );
};
