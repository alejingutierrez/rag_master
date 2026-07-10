/**
 * El vocabulario cerrado de composiciones. Cada tipo tiene su PROPIA entrada
 * (no todas suben igual): palabra por palabra, escala con rebote, barrido de
 * recorte, entradas laterales. Los tamaños están en px sobre el lienzo 1080×1920.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { fitText } from "@remotion/layout-utils";
import type {
  Scene, Line, Scale,
  PortadaScene, EnunciadoScene, NombreScene, CifraScene, CorteScene, CierreScene,
  PreguntaScene, CitaScene, AnioScene, ListaScene, ContrasteScene, ImagenScene,
} from "../score/schema";
import { FONT } from "../theme/fonts";
import { countTo } from "../theme/motion";
import { Palette, eraColor, inkFor, inkSoftFor, lineFor, accentFor } from "../theme/palette";
import { MaskRise, Fade, DrawBar, WordReveal, ScalePunch, ClipWipe, SlideIn } from "./parts";
import { ImageText } from "./media";

const SIZE: Record<Scale, number> = { s: 110, m: 150, l: 196, xl: 290 };
const USABLE = 1080 - 96 * 2;

const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ padding: "0 96px", justifyContent: "center", alignItems: "flex-start" }}>
    <div style={{ width: "100%" }}>{children}</div>
  </AbsoluteFill>
);

const lineText = (line: Line) => line.map((s) => s.text).join("");

function fitLines(lines: string[], maxSize: number, fontFamily: string, extra?: { fontWeight?: number | string; letterSpacing?: string }) {
  let size = maxSize;
  for (const t of lines) {
    if (!t || !t.trim()) continue;
    const { fontSize } = fitText({ text: t, withinWidth: USABLE, fontFamily, fontWeight: extra?.fontWeight, letterSpacing: extra?.letterSpacing });
    size = Math.min(size, fontSize);
  }
  return Math.round(size);
}

function spans(line: Line, ink: string, accent: string) {
  return line.map((sp, i) => (
    <span key={i} style={{ color: sp.accent ? accent : ink, fontStyle: sp.italic ? "italic" : "normal" }}>{sp.text}</span>
  ));
}

const monoLabel = (text: string, color: string, size = 30): React.CSSProperties => ({
  fontFamily: FONT.mono, fontSize: size, letterSpacing: "0.24em", textTransform: "uppercase", color,
});

type LayoutProps<S> = { scene: S; palette: Palette };

const Portada: React.FC<LayoutProps<PortadaScene>> = ({ scene, palette }) => {
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), accent = accentFor(palette, bg);
  const size = fitLines(scene.titulo.map(lineText), 150, FONT.display, { letterSpacing: "-0.02em" });
  return (
    <Container>
      <MaskRise dur={26}><span style={monoLabel(scene.kicker, soft)}>{scene.kicker}</span></MaskRise>
      <div style={{ height: 26 }} />
      <div style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 0.98, letterSpacing: "-0.02em", color: ink, whiteSpace: "nowrap" }}>
        {scene.titulo.map((line, i) => (<MaskRise key={i} delay={8 + i * 7}>{spans(line, ink, accent)}</MaskRise>))}
      </div>
      {scene.rule && (<><div style={{ height: 54 }} /><DrawBar delay={22} color={ink} width={280} /></>)}
    </Container>
  );
};

const Enunciado: React.FC<LayoutProps<EnunciadoScene>> = ({ scene, palette }) => {
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), accent = accentFor(palette, bg);
  const size = fitLines(scene.titulo.map(lineText), SIZE[scene.scale ?? "l"], FONT.display, { letterSpacing: "-0.02em" });
  return (
    <Container>
      {scene.label && (<Fade dur={20}><span style={monoLabel(scene.label, soft)}>{scene.label}</span><div style={{ height: 26 }} /></Fade>)}
      <div style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 1.0, letterSpacing: "-0.02em", color: ink, whiteSpace: "nowrap" }}>
        {scene.titulo.map((line, i) => (<div key={i}><WordReveal line={line} ink={ink} accent={accent} delay={i * 8} per={3} /></div>))}
      </div>
      {scene.sub && (<Fade delay={14} dur={22}><div style={{ height: 22 }} /><span style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 60, color: soft }}>{scene.sub}</span></Fade>)}
    </Container>
  );
};

const Nombre: React.FC<LayoutProps<NombreScene>> = ({ scene, palette }) => {
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), accent = accentFor(palette, bg);
  return (
    <Container>
      {scene.pre && (<Fade dur={20}><span style={{ fontFamily: FONT.display, fontSize: fitLines([scene.pre], 104, FONT.display), lineHeight: 1, color: soft, whiteSpace: "nowrap" }}>{scene.pre}</span></Fade>)}
      <ScalePunch delay={4} from={1.14}>
        {scene.imageFill ? (
          <ImageText src={scene.imageFill} style={{ display: "inline-block", whiteSpace: "nowrap", fontFamily: FONT.display, fontSize: fitLines([scene.nombre], 320, FONT.display, { letterSpacing: "-0.03em" }), lineHeight: 0.88, letterSpacing: "-0.03em" }}>
            {scene.nombre}
          </ImageText>
        ) : (
          <span style={{ fontFamily: FONT.display, fontSize: fitLines([scene.nombre], 280, FONT.display, { letterSpacing: "-0.02em" }), lineHeight: 0.94, letterSpacing: "-0.02em", color: ink, whiteSpace: "nowrap" }}>{scene.nombre}</span>
        )}
      </ScalePunch>
      {scene.underline && (<><div style={{ height: 14 }} /><DrawBar delay={18} color={accent} width={640} height={10} dur={22} /></>)}
    </Container>
  );
};

const CifraNumber: React.FC<{ scene: CifraScene; color: string }> = ({ scene, color }) => {
  const frame = useCurrentFrame();
  const n = countTo(frame, scene.valor);
  const finalText = (scene.prefix ?? "") + scene.valor.toLocaleString("es-CO") + (scene.suffix ?? "");
  const { fontSize } = fitText({ text: finalText, withinWidth: USABLE, fontFamily: FONT.mono, fontWeight: 500, letterSpacing: "-0.02em" });
  const size = Math.min(340, fontSize);
  return (
    <span style={{ display: "inline-block", whiteSpace: "nowrap", fontFamily: FONT.mono, fontWeight: 500, fontSize: size, lineHeight: 1, letterSpacing: "-0.02em", color, fontVariantNumeric: "tabular-nums" }}>
      {(scene.prefix ?? "") + n.toLocaleString("es-CO") + (scene.suffix ?? "")}
    </span>
  );
};

const Cifra: React.FC<LayoutProps<CifraScene>> = ({ scene, palette }) => {
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg);
  return (
    <Container>
      {scene.pre && (<Fade dur={18}><span style={{ ...monoLabel(scene.pre, soft, 34), letterSpacing: "0.22em" }}>{scene.pre}</span><div style={{ height: 30 }} /></Fade>)}
      <ScalePunch delay={2} from={1.1}><CifraNumber scene={scene} color={ink} /></ScalePunch>
      {scene.sub && (<Fade delay={14} dur={22}><div style={{ height: 6 }} /><span style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 60, color: soft }}>{scene.sub}</span></Fade>)}
    </Container>
  );
};

const Corte: React.FC<LayoutProps<CorteScene>> = ({ scene, palette }) => {
  const bg = scene.bg ?? "dark";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), accent = accentFor(palette, bg);
  return (
    <Container>
      <div style={{ fontFamily: FONT.display, fontSize: fitLines([scene.linea1, scene.linea2.text], 190, FONT.display, { letterSpacing: "-0.02em" }), lineHeight: 0.96, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
        <MaskRise><span style={{ color: ink }}>{scene.linea1}</span></MaskRise>
        <MaskRise delay={4}><span style={{ color: scene.linea2.accent === false ? ink : accent, fontStyle: scene.linea2.italic ? "italic" : "normal" }}>{scene.linea2.text}</span></MaskRise>
      </div>
      {scene.tags && scene.tags.length > 0 && (<Fade delay={16} dur={22}><div style={{ height: 44 }} /><span style={monoLabel(scene.tags.join("  ·  "), soft)}>{scene.tags.join("  ·  ")}</span></Fade>)}
    </Container>
  );
};

const Cierre: React.FC<LayoutProps<CierreScene>> = ({ scene, palette }) => {
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg);
  const faint = bg === "light" ? palette.inkFaint : "rgba(255,255,255,0.5)";
  return (
    <Container>
      <Fade dur={18}><span style={{ ...monoLabel(scene.mark, soft, 32), letterSpacing: "0.3em" }}>{scene.mark}</span></Fade>
      <div style={{ height: 20 }} />
      <MaskRise delay={6}><span style={{ display: "inline-block", fontFamily: FONT.display, fontSize: fitLines([scene.titulo], 230, FONT.display, { letterSpacing: "-0.02em" }), lineHeight: 0.96, letterSpacing: "-0.02em", color: ink, whiteSpace: "nowrap" }}>{scene.titulo}</span></MaskRise>
      <Fade delay={14} dur={20}><div style={{ height: 40 }} /><span style={{ ...monoLabel(scene.meta, faint, 30), letterSpacing: "0.2em" }}>{scene.meta}</span></Fade>
      {scene.ribbon && scene.ribbon.length > 0 && (
        <Fade delay={20} dur={22}><div style={{ height: 60, display: "flex", alignItems: "flex-end" }}><div style={{ display: "flex", gap: 14 }}>{scene.ribbon.map((code, i) => (<div key={i} style={{ width: 44, height: 10, background: eraColor(code) }} />))}</div></div></Fade>
      )}
    </Container>
  );
};

const Pregunta: React.FC<LayoutProps<PreguntaScene>> = ({ scene, palette }) => {
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), accent = accentFor(palette, bg);
  const size = fitLines(scene.pregunta.map(lineText), 184, FONT.display, { letterSpacing: "-0.02em" });
  return (
    <Container>
      {scene.kicker && (<Fade dur={18}><span style={monoLabel(scene.kicker, soft)}>{scene.kicker}</span><div style={{ height: 26 }} /></Fade>)}
      <div style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 1.0, letterSpacing: "-0.02em", color: ink, whiteSpace: "nowrap" }}>
        {scene.pregunta.map((line, i) => (<div key={i}><WordReveal line={line} ink={ink} accent={accent} delay={i * 8} per={3} /></div>))}
      </div>
    </Container>
  );
};

const Cita: React.FC<LayoutProps<CitaScene>> = ({ scene, palette }) => {
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), accent = accentFor(palette, bg);
  const len = scene.cita.map((s) => s.text).join("").length;
  const size = len > 120 ? 62 : len > 74 ? 76 : 92;
  return (
    <Container>
      <div style={{ position: "relative" }}>
        <Fade dur={12}><span style={{ position: "absolute", left: -8, top: -0.9 * size, fontFamily: FONT.display, fontSize: size * 2.4, lineHeight: 1, color: accent }}>“</span></Fade>
        <ClipWipe delay={6} dur={28}>
          <p style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: size, lineHeight: 1.18, letterSpacing: "-0.01em", color: ink, maxWidth: 880, margin: 0 }}>{spans(scene.cita, ink, accent)}</p>
        </ClipWipe>
      </div>
      {scene.autor && (<Fade delay={18} dur={20}><div style={{ height: 44 }} /><span style={{ ...monoLabel(scene.autor, soft), letterSpacing: "0.18em" }}>— {scene.autor}{scene.fuente ? `  ·  ${scene.fuente}` : ""}</span></Fade>)}
    </Container>
  );
};

const Anio: React.FC<LayoutProps<AnioScene>> = ({ scene, palette }) => {
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg);
  const size = fitLines([scene.anio], 460, FONT.display, { letterSpacing: "-0.03em" });
  return (
    <Container>
      {scene.label && (<Fade dur={18}><span style={{ ...monoLabel(scene.label, soft, 34), letterSpacing: "0.22em" }}>{scene.label}</span><div style={{ height: 26 }} /></Fade>)}
      <ScalePunch delay={2} from={1.16}>
        <span style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 0.9, letterSpacing: "-0.03em", color: ink, whiteSpace: "nowrap" }}>{scene.anio}</span>
      </ScalePunch>
      {scene.sub && (<Fade delay={14} dur={22}><div style={{ height: 14 }} /><span style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 60, color: soft }}>{scene.sub}</span></Fade>)}
    </Container>
  );
};

const Lista: React.FC<LayoutProps<ListaScene>> = ({ scene, palette }) => {
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), accent = accentFor(palette, bg);
  const itemSize = scene.items.length >= 5 ? 60 : scene.items.length === 4 ? 72 : 88;
  return (
    <Container>
      {scene.titulo && (<Fade dur={16}><span style={{ ...monoLabel(scene.titulo, soft), letterSpacing: "0.22em" }}>{scene.titulo}</span><div style={{ height: 34 }} /></Fade>)}
      <div>
        {scene.items.map((it, i) => (
          <Fade key={i} delay={10 + i * 10} dur={20} y={20}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 26, marginBottom: 16 }}>
              <span style={{ fontFamily: FONT.mono, fontSize: 30, color: accent, flex: "0 0 auto" }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontFamily: FONT.display, fontSize: itemSize, lineHeight: 1.04, color: ink }}>{it}</span>
            </div>
          </Fade>
        ))}
      </div>
    </Container>
  );
};

const Contraste: React.FC<LayoutProps<ContrasteScene>> = ({ scene, palette }) => {
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), line = lineFor(palette, bg), accent = accentFor(palette, bg);
  const size = fitLines([scene.a, scene.b], 200, FONT.display, { letterSpacing: "-0.02em" });
  return (
    <Container>
      {scene.eje && (<Fade dur={16}><span style={monoLabel(scene.eje, soft)}>{scene.eje}</span><div style={{ height: 30 }} /></Fade>)}
      <SlideIn delay={4} dir="left"><span style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 0.98, letterSpacing: "-0.02em", color: ink, whiteSpace: "nowrap" }}>{scene.a}</span></SlideIn>
      <Fade delay={12} dur={16}><div style={{ display: "flex", alignItems: "center", gap: 20, margin: "12px 0" }}><span style={{ fontFamily: FONT.mono, fontSize: 28, letterSpacing: "0.2em", color: accent }}>VS</span><span style={{ flex: 1, height: 2, background: line }} /></div></Fade>
      <SlideIn delay={16} dir="right"><span style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 0.98, letterSpacing: "-0.02em", color: accent, whiteSpace: "nowrap" }}>{scene.b}</span></SlideIn>
    </Container>
  );
};

const Imagen: React.FC<LayoutProps<ImagenScene>> = ({ scene, palette }) => {
  const ink = "#ffffff", soft = "rgba(255,255,255,0.82)", accent = palette.accent;
  const size = scene.titulo ? fitLines(scene.titulo.map(lineText), 150, FONT.display, { letterSpacing: "-0.02em" }) : 0;
  return (
    <AbsoluteFill style={{ padding: "0 96px 250px", justifyContent: "flex-end", alignItems: "flex-start" }}>
      <div style={{ width: "100%" }}>
        {scene.kicker && (<MaskRise dur={22}><span style={monoLabel(scene.kicker, soft)}>{scene.kicker}</span></MaskRise>)}
        {scene.titulo && (<><div style={{ height: 18 }} /><div style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 0.98, letterSpacing: "-0.02em", color: ink, whiteSpace: "nowrap" }}>{scene.titulo.map((line, i) => (<MaskRise key={i} delay={6 + i * 7}>{spans(line, ink, accent)}</MaskRise>))}</div></>)}
        {scene.pie && (<Fade delay={14} dur={20}><div style={{ height: 24 }} /><span style={{ ...monoLabel(scene.pie, soft, 24), letterSpacing: "0.12em" }}>{scene.pie}</span></Fade>)}
      </div>
    </AbsoluteFill>
  );
};

/** Despacha una escena a su layout. Fondo + drift + transiciones los pone el llamador. */
export const Layout: React.FC<{ scene: Scene; palette: Palette }> = ({ scene, palette }) => {
  switch (scene.kind) {
    case "portada": return <Portada scene={scene} palette={palette} />;
    case "enunciado": return <Enunciado scene={scene} palette={palette} />;
    case "nombre": return <Nombre scene={scene} palette={palette} />;
    case "cifra": return <Cifra scene={scene} palette={palette} />;
    case "corte": return <Corte scene={scene} palette={palette} />;
    case "cierre": return <Cierre scene={scene} palette={palette} />;
    case "pregunta": return <Pregunta scene={scene} palette={palette} />;
    case "cita": return <Cita scene={scene} palette={palette} />;
    case "anio": return <Anio scene={scene} palette={palette} />;
    case "lista": return <Lista scene={scene} palette={palette} />;
    case "contraste": return <Contraste scene={scene} palette={palette} />;
    case "imagen": return <Imagen scene={scene} palette={palette} />;
  }
};
