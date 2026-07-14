/**
 * El vocabulario cerrado de composiciones. Cada tipo tiene su PROPIA entrada
 * (etiquetas que aprietan el tracking, titulares tras máscara, nombres letra a
 * letra, bloques que barren, citas que enfocan) y respeta el TEMPO y la
 * alineación del estilo (stylepack). Tamaños en px sobre el lienzo 1080×1920.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { fitText } from "@remotion/layout-utils";
import type {
  Scene, Line, Scale,
  PortadaScene, EnunciadoScene, NombreScene, CifraScene, CorteScene, CierreScene,
  PreguntaScene, CitaScene, AnioScene, ListaScene, ContrasteScene, ImagenScene,
} from "../score/schema";
import { FONT } from "../theme/fonts";
import { countTo, prog } from "../theme/motion";
import { Palette, eraColor, inkFor, inkSoftFor, lineFor, accentFor } from "../theme/palette";
import { usePack, tempo, type StylePack } from "../theme/stylepack";
import { MaskRise, Fade, DrawBar, WordReveal, ScalePunch, SlideIn, TrackIn, LetterRise, BlockReveal, BlurRise } from "./parts";
import { ImageText } from "./media";

const SIZE: Record<Scale, number> = { s: 110, m: 150, l: 196, xl: 290 };
const USABLE = 1080 - 96 * 2;

const Container: React.FC<{ align?: "left" | "center"; children: React.ReactNode }> = ({ align = "left", children }) => (
  <AbsoluteFill style={{ padding: "0 96px", justifyContent: "center", alignItems: "flex-start" }}>
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start", textAlign: align }}>
      {children}
    </div>
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

/** Delays al tempo del pack: T(8) en un estilo pausado llega más tarde. */
const useTempo = (pack: StylePack) => (d: number) => tempo(pack, d);

const Portada: React.FC<LayoutProps<PortadaScene>> = ({ scene, palette }) => {
  const pack = usePack();
  const T = useTempo(pack);
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), accent = accentFor(palette, bg);
  const size = fitLines(scene.titulo.map(lineText), 150, FONT.display, { letterSpacing: "-0.02em" });
  return (
    <Container align={pack.align}>
      <DrawBar delay={T(2)} color={accent} width={64} height={10} dur={18} />
      <div style={{ height: 30 }} />
      <TrackIn delay={T(8)} style={monoLabel(scene.kicker, soft)}>{scene.kicker}</TrackIn>
      <div style={{ height: 26 }} />
      <div style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 0.98, letterSpacing: "-0.02em", color: ink, whiteSpace: "nowrap" }}>
        {scene.titulo.map((line, i) => (<MaskRise key={i} delay={T(14 + i * 8)} tilt={1.4}>{spans(line, ink, accent)}</MaskRise>))}
      </div>
      {scene.rule && (<><div style={{ height: 54 }} /><DrawBar delay={T(30)} color={ink} width={280} /></>)}
    </Container>
  );
};

const Enunciado: React.FC<LayoutProps<EnunciadoScene>> = ({ scene, palette }) => {
  const pack = usePack();
  const T = useTempo(pack);
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), accent = accentFor(palette, bg);
  const size = fitLines(scene.titulo.map(lineText), SIZE[scene.scale ?? "l"], FONT.display, { letterSpacing: "-0.02em" });
  return (
    <Container align={pack.align}>
      {scene.label && (<><TrackIn delay={T(2)} style={monoLabel(scene.label, soft)}>{scene.label}</TrackIn><div style={{ height: 26 }} /></>)}
      <div style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 1.0, letterSpacing: "-0.02em", color: ink, whiteSpace: "nowrap" }}>
        {scene.titulo.map((line, i) => (<div key={i}><WordReveal line={line} ink={ink} accent={accent} delay={T(6 + i * 8)} per={Math.max(2, T(3))} underline /></div>))}
      </div>
      {scene.sub && (<BlurRise delay={T(18)} dur={24}><div style={{ height: 22 }} /><span style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 60, color: soft }}>{scene.sub}</span></BlurRise>)}
    </Container>
  );
};

const Nombre: React.FC<LayoutProps<NombreScene>> = ({ scene, palette }) => {
  const pack = usePack();
  const T = useTempo(pack);
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), accent = accentFor(palette, bg);
  const per = scene.nombre.length > 12 ? 1 : 2;
  return (
    <Container align={pack.align}>
      {scene.pre && (<Fade delay={T(2)} dur={20}><span style={{ fontFamily: FONT.display, fontSize: fitLines([scene.pre], 104, FONT.display), lineHeight: 1, color: soft, whiteSpace: "nowrap" }}>{scene.pre}</span></Fade>)}
      {scene.imageFill ? (
        <ScalePunch delay={T(4)} from={1.14}>
          <ImageText src={scene.imageFill} style={{ display: "inline-block", whiteSpace: "nowrap", fontFamily: FONT.display, fontSize: fitLines([scene.nombre], 320, FONT.display, { letterSpacing: "-0.03em" }), lineHeight: 0.88, letterSpacing: "-0.03em" }}>
            {scene.nombre}
          </ImageText>
        </ScalePunch>
      ) : (
        <LetterRise
          text={scene.nombre}
          delay={T(6)}
          per={per}
          style={{ fontFamily: FONT.display, fontSize: fitLines([scene.nombre], 280, FONT.display, { letterSpacing: "-0.02em" }), lineHeight: 0.94, letterSpacing: "-0.02em", color: ink }}
        />
      )}
      {scene.underline && (<><div style={{ height: 14 }} /><DrawBar delay={T(20)} color={accent} width={640} height={10} dur={24} /></>)}
    </Container>
  );
};

const CifraNumber: React.FC<{ scene: CifraScene; color: string; delay: number }> = ({ scene, color, delay }) => {
  const frame = useCurrentFrame();
  const n = countTo(frame, scene.valor, delay);
  const land = delay + 34;
  const settle = interpolate(frame, [land, land + 10], [1.035, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const finalText = (scene.prefix ?? "") + scene.valor.toLocaleString("es-CO") + (scene.suffix ?? "");
  const { fontSize } = fitText({ text: finalText, withinWidth: USABLE, fontFamily: FONT.mono, fontWeight: 500, letterSpacing: "-0.02em" });
  const size = Math.min(340, fontSize);
  return (
    <span style={{ display: "inline-block", whiteSpace: "nowrap", fontFamily: FONT.mono, fontWeight: 500, fontSize: size, lineHeight: 1, letterSpacing: "-0.02em", color, fontVariantNumeric: "tabular-nums", transform: `scale(${settle})`, transformOrigin: "left center" }}>
      {(scene.prefix ?? "") + n.toLocaleString("es-CO") + (scene.suffix ?? "")}
    </span>
  );
};

const Cifra: React.FC<LayoutProps<CifraScene>> = ({ scene, palette }) => {
  const pack = usePack();
  const T = useTempo(pack);
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), accent = accentFor(palette, bg);
  const numberColor = pack.numberAccent && bg !== "color" ? accent : ink;
  const land = T(8) + 34; // el contador dura 34 frames fijos tras su delay
  return (
    <Container align={pack.align}>
      {scene.pre && (<><TrackIn delay={T(2)} track={0.22} style={{ ...monoLabel(scene.pre, soft, 34) }}>{scene.pre}</TrackIn><div style={{ height: 30 }} /></>)}
      <Fade delay={T(4)} dur={14} y={0}><CifraNumber scene={scene} color={numberColor} delay={T(8)} /></Fade>
      <div style={{ height: 18 }} />
      <DrawBar delay={land + 2} color={accent} width={220} height={8} dur={20} />
      {scene.sub && (<BlurRise delay={land + 8} dur={22}><div style={{ height: 16 }} /><span style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 60, color: soft }}>{scene.sub}</span></BlurRise>)}
    </Container>
  );
};

const Corte: React.FC<LayoutProps<CorteScene>> = ({ scene, palette }) => {
  const pack = usePack();
  const T = useTempo(pack);
  const bg = scene.bg ?? "dark";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), accent = accentFor(palette, bg);
  return (
    <Container align={pack.align}>
      <div style={{ fontFamily: FONT.display, fontSize: fitLines([scene.linea1, scene.linea2.text], 190, FONT.display, { letterSpacing: "-0.02em" }), lineHeight: 0.96, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
        <MaskRise delay={T(2)} tilt={1.2}><span style={{ color: ink }}>{scene.linea1}</span></MaskRise>
        <div style={{ height: "0.08em" }} />
        <BlockReveal delay={T(10)} dur={30} color={accent}>
          <span style={{ color: scene.linea2.accent === false ? ink : accent, fontStyle: scene.linea2.italic ? "italic" : "normal" }}>{scene.linea2.text}</span>
        </BlockReveal>
      </div>
      {scene.tags && scene.tags.length > 0 && (<><div style={{ height: 44 }} /><TrackIn delay={T(26)} style={monoLabel(scene.tags.join("  ·  "), soft)}>{scene.tags.join("  ·  ")}</TrackIn></>)}
    </Container>
  );
};

const Cierre: React.FC<LayoutProps<CierreScene>> = ({ scene, palette }) => {
  const pack = usePack();
  const T = useTempo(pack);
  const frame = useCurrentFrame();
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg);
  const faint = bg === "light" ? palette.inkFaint : "rgba(255,255,255,0.5)";
  return (
    <Container align={pack.align}>
      <TrackIn delay={T(2)} track={0.3} style={{ ...monoLabel(scene.mark, soft, 32) }}>{scene.mark}</TrackIn>
      <div style={{ height: 20 }} />
      <MaskRise delay={T(8)} tilt={1.2}><span style={{ display: "inline-block", fontFamily: FONT.display, fontSize: fitLines([scene.titulo], 230, FONT.display, { letterSpacing: "-0.02em" }), lineHeight: 0.96, letterSpacing: "-0.02em", color: ink, whiteSpace: "nowrap" }}>{scene.titulo}</span></MaskRise>
      <Fade delay={T(18)} dur={20}><div style={{ height: 40 }} /><span style={{ ...monoLabel(scene.meta, faint, 30), letterSpacing: "0.2em" }}>{scene.meta}</span></Fade>
      {scene.ribbon && scene.ribbon.length > 0 && (
        <div style={{ height: 60, display: "flex", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 14 }}>
            {scene.ribbon.map((code, i) => {
              const p = prog(frame, T(26 + i * 4), 18);
              return <div key={i} style={{ width: 44, height: 10, background: eraColor(code), transform: `scaleY(${p})`, transformOrigin: "bottom" }} />;
            })}
          </div>
        </div>
      )}
    </Container>
  );
};

const Pregunta: React.FC<LayoutProps<PreguntaScene>> = ({ scene, palette }) => {
  const pack = usePack();
  const T = useTempo(pack);
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), accent = accentFor(palette, bg);
  const size = fitLines(scene.pregunta.map(lineText), 184, FONT.display, { letterSpacing: "-0.02em" });
  return (
    <Container align={pack.align}>
      {scene.kicker && (<><TrackIn delay={T(2)} style={monoLabel(scene.kicker, soft)}>{scene.kicker}</TrackIn><div style={{ height: 26 }} /></>)}
      <div style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 1.0, letterSpacing: "-0.02em", color: ink, whiteSpace: "nowrap" }}>
        {scene.pregunta.map((line, i) => (<div key={i}><WordReveal line={line} ink={ink} accent={accent} delay={T(6 + i * 9)} per={Math.max(2, T(4))} underline /></div>))}
      </div>
    </Container>
  );
};

const Cita: React.FC<LayoutProps<CitaScene>> = ({ scene, palette }) => {
  const pack = usePack();
  const T = useTempo(pack);
  const frame = useCurrentFrame();
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), accent = accentFor(palette, bg);
  const len = scene.cita.map((s) => s.text).join("").length;
  const size = len > 120 ? 62 : len > 74 ? 76 : 92;
  const qp = prog(frame, T(2), 20);
  return (
    <Container align={pack.align}>
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute", left: -8, top: -0.9 * size, fontFamily: FONT.display, fontSize: size * 2.4, lineHeight: 1, color: accent,
            opacity: qp, transform: `scale(${0.6 + qp * 0.4}) rotate(${(1 - qp) * -8}deg)`, transformOrigin: "left bottom",
          }}
        >
          “
        </span>
        <BlurRise delay={T(8)} dur={30}>
          <p style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: size, lineHeight: 1.18, letterSpacing: "-0.01em", color: ink, maxWidth: 880, margin: 0 }}>{spans(scene.cita, ink, accent)}</p>
        </BlurRise>
      </div>
      {scene.autor && (
        <Fade delay={T(26)} dur={20}>
          <div style={{ height: 44 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <DrawBar delay={T(26)} color={accent} width={56} height={3} dur={16} />
            <span style={{ ...monoLabel(scene.autor, soft), letterSpacing: "0.18em" }}>{scene.autor}{scene.fuente ? `  ·  ${scene.fuente}` : ""}</span>
          </div>
        </Fade>
      )}
    </Container>
  );
};

const Anio: React.FC<LayoutProps<AnioScene>> = ({ scene, palette }) => {
  const pack = usePack();
  const T = useTempo(pack);
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), accent = accentFor(palette, bg);
  const size = fitLines([scene.anio], 460, FONT.display, { letterSpacing: "-0.03em" });
  return (
    <Container align={pack.align}>
      {scene.label && (<><TrackIn delay={T(2)} track={0.22} style={{ ...monoLabel(scene.label, soft, 34) }}>{scene.label}</TrackIn><div style={{ height: 26 }} /></>)}
      <LetterRise text={scene.anio} delay={T(4)} per={3} dur={24} style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 0.9, letterSpacing: "-0.03em", color: ink }} />
      <div style={{ height: 20 }} />
      <DrawBar delay={T(22)} color={accent} width={340} height={10} dur={22} />
      {scene.sub && (<BlurRise delay={T(30)} dur={22}><div style={{ height: 16 }} /><span style={{ fontFamily: FONT.display, fontStyle: "italic", fontSize: 60, color: soft }}>{scene.sub}</span></BlurRise>)}
    </Container>
  );
};

const Lista: React.FC<LayoutProps<ListaScene>> = ({ scene, palette }) => {
  const pack = usePack();
  const T = useTempo(pack);
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), line = lineFor(palette, bg), accent = accentFor(palette, bg);
  const itemSize = scene.items.length >= 5 ? 60 : scene.items.length === 4 ? 72 : 88;
  return (
    <Container align={pack.align}>
      {scene.titulo && (<><TrackIn delay={T(2)} track={0.22} style={{ ...monoLabel(scene.titulo, soft) }}>{scene.titulo}</TrackIn><div style={{ height: 34 }} /></>)}
      <div style={{ width: "100%" }}>
        {scene.items.map((it, i) => (
          <div key={i} style={{ marginBottom: 18 }}>
            {i > 0 && (<><DrawBar delay={T(10 + i * 12)} color={line} width="100%" height={2} dur={18} /><div style={{ height: 18 }} /></>)}
            <div style={{ display: "flex", alignItems: "baseline", gap: 26 }}>
              <Fade delay={T(12 + i * 12)} dur={16} y={10}><span style={{ fontFamily: FONT.mono, fontSize: 30, color: accent, flex: "0 0 auto" }}>{String(i + 1).padStart(2, "0")}</span></Fade>
              <MaskRise delay={T(14 + i * 12)} style={{ flex: 1 }}><span style={{ fontFamily: FONT.display, fontSize: itemSize, lineHeight: 1.04, color: ink }}>{it}</span></MaskRise>
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
};

const Contraste: React.FC<LayoutProps<ContrasteScene>> = ({ scene, palette }) => {
  const pack = usePack();
  const T = useTempo(pack);
  const bg = scene.bg ?? "light";
  const ink = inkFor(palette, bg), soft = inkSoftFor(palette, bg), line = lineFor(palette, bg), accent = accentFor(palette, bg);
  const size = fitLines([scene.a, scene.b], 200, FONT.display, { letterSpacing: "-0.02em" });
  return (
    <Container align={pack.align}>
      {scene.eje && (<><TrackIn delay={T(2)} style={monoLabel(scene.eje, soft)}>{scene.eje}</TrackIn><div style={{ height: 30 }} /></>)}
      <SlideIn delay={T(6)} dir="left"><span style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 0.98, letterSpacing: "-0.02em", color: ink, whiteSpace: "nowrap" }}>{scene.a}</span></SlideIn>
      <div style={{ display: "flex", alignItems: "center", gap: 20, margin: "12px 0", width: "100%" }}>
        <ScalePunch delay={T(16)} from={1.5}><span style={{ fontFamily: FONT.mono, fontSize: 28, letterSpacing: "0.2em", color: accent }}>VS</span></ScalePunch>
        <div style={{ flex: 1 }}><DrawBar delay={T(18)} color={line} width="100%" height={2} dur={20} /></div>
      </div>
      <SlideIn delay={T(22)} dir="right"><span style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 0.98, letterSpacing: "-0.02em", color: accent, whiteSpace: "nowrap" }}>{scene.b}</span></SlideIn>
    </Container>
  );
};

const Imagen: React.FC<LayoutProps<ImagenScene>> = ({ scene, palette }) => {
  const pack = usePack();
  const T = useTempo(pack);
  const ink = "#ffffff", soft = "rgba(255,255,255,0.82)", accent = palette.accent;
  const size = scene.titulo ? fitLines(scene.titulo.map(lineText), 150, FONT.display, { letterSpacing: "-0.02em" }) : 0;
  return (
    <AbsoluteFill style={{ padding: "0 96px 250px", justifyContent: "flex-end", alignItems: "flex-start" }}>
      <div style={{ width: "100%" }}>
        {scene.kicker && (<TrackIn delay={T(4)} style={monoLabel(scene.kicker, soft)}>{scene.kicker}</TrackIn>)}
        {scene.titulo && (<><div style={{ height: 18 }} /><div style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 0.98, letterSpacing: "-0.02em", color: ink, whiteSpace: "nowrap" }}>{scene.titulo.map((line, i) => (<MaskRise key={i} delay={T(10 + i * 8)} tilt={1.2}>{spans(line, ink, accent)}</MaskRise>))}</div></>)}
        {scene.pie && (<Fade delay={T(20)} dur={20}><div style={{ height: 24 }} /><span style={{ ...monoLabel(scene.pie, soft, 24), letterSpacing: "0.12em" }}>{scene.pie}</span></Fade>)}
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
