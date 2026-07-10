/**
 * Contrato de la "partitura" del lado de la app (Director). Es un ESPEJO EXACTO
 * de `remotion/src/score/schema.ts` (el renderizador). Se mantiene duplicado a
 * propósito: el proyecto Remotion es standalone y no comparte node_modules.
 *
 * ⚠️  MANTENER EN SYNC con remotion/src/score/schema.ts. Son tipos puros; cambian
 * rara vez. El script de generación valida el score antes de renderizar, así que
 * cualquier desincronización se detecta al construir el video.
 */

export type PeriodCode =
  | "PRE" | "CON" | "COL" | "PRE_IND" | "IND" | "NGR" | "EUC" | "REG"
  | "REP_LIB" | "VIO" | "FN" | "CNA" | "C91" | "SDE" | "POS" | "TRANS";

export type Personality =
  | "ruptura" | "archivo" | "cifra" | "retrato"
  | "cronologia" | "voces" | "enigma" | "causa-consecuencia" | "contraste" | "manifiesto";

export type SceneBg = "light" | "dark" | "color";

export interface Span { text: string; accent?: boolean; italic?: boolean; }
export type Line = Span[];
export type Scale = "s" | "m" | "l" | "xl";

export type LayoutKind =
  | "portada" | "enunciado" | "nombre" | "cifra" | "corte" | "cierre"
  | "pregunta" | "cita" | "anio" | "lista" | "contraste" | "imagen";

export type Pan = "in" | "left" | "right" | "up" | "down";
export type Scrim = "bottom" | "top" | "full" | "none";

interface SceneBase {
  kind: LayoutKind;
  from: number;
  durationInFrames: number;
  bg?: SceneBg;
  image?: string;
  imageFill?: string;
  pan?: Pan;
  scrim?: Scrim;
}

export interface PortadaScene extends SceneBase {
  kind: "portada";
  kicker: string;
  titulo: Line[];
  rule?: boolean;
}
export interface EnunciadoScene extends SceneBase {
  kind: "enunciado";
  label?: string;
  titulo: Line[];
  sub?: string;
  scale?: Scale;
}
export interface NombreScene extends SceneBase {
  kind: "nombre";
  pre?: string;
  nombre: string;
  underline?: boolean;
}
export interface CifraScene extends SceneBase {
  kind: "cifra";
  pre?: string;
  prefix?: string;
  valor: number;
  suffix?: string;
  sub?: string;
}
export interface CorteScene extends SceneBase {
  kind: "corte";
  linea1: string;
  linea2: Span;
  tags?: string[];
  bg?: SceneBg;
}
export interface CierreScene extends SceneBase {
  kind: "cierre";
  mark: string;
  titulo: string;
  meta: string;
  ribbon?: PeriodCode[];
}
export interface PreguntaScene extends SceneBase {
  kind: "pregunta";
  kicker?: string;
  pregunta: Line[];
}
export interface CitaScene extends SceneBase {
  kind: "cita";
  cita: Line;
  autor?: string;
  fuente?: string;
}
export interface AnioScene extends SceneBase {
  kind: "anio";
  label?: string;
  anio: string;
  sub?: string;
}
export interface ListaScene extends SceneBase {
  kind: "lista";
  titulo?: string;
  items: string[];
}
export interface ContrasteScene extends SceneBase {
  kind: "contraste";
  eje?: string;
  a: string;
  b: string;
}
export interface ImagenScene extends SceneBase {
  kind: "imagen";
  image: string;
  kicker?: string;
  titulo?: Line[];
  pie?: string;
}

export type Scene =
  | PortadaScene | EnunciadoScene | NombreScene
  | CifraScene | CorteScene | CierreScene
  | PreguntaScene | CitaScene | AnioScene | ListaScene | ContrasteScene | ImagenScene;

export interface ScoreMeta {
  topic: string;
  title: string;
  periodCode: PeriodCode;
  periodLabel: string;
  personality: Personality;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
}

export interface TypographicScore {
  meta: ScoreMeta;
  scenes: Scene[];
}

/** Quita las llaves K de cada miembro de una unión discriminada preservándola. */
export type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
