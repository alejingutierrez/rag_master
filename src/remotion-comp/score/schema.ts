/**
 * La "partitura" — contrato entre el Director (agentico, en la app Next) y el
 * Escenario (Remotion). Es TypeScript puro y SIN dependencias, para poder
 * moverlo a `src/lib/video/` y compartirlo entre ambos mundos en la Fase C.
 *
 * Unidad de tiempo: frames (a `meta.fps`). 30 fps => 1s = 30 frames.
 */

export type PeriodCode =
  | "PRE" | "CON" | "COL" | "PRE_IND" | "IND" | "NGR" | "EUC" | "REG"
  | "REP_LIB" | "VIO" | "FN" | "CNA" | "C91" | "SDE" | "POS" | "TRANS";

/** Cada personalidad reordena el mismo vocabulario; no cambia la linea grafica. */
export type Personality =
  | "ruptura" | "archivo" | "cifra" | "retrato"
  | "cronologia" | "voces" | "enigma" | "causa-consecuencia" | "contraste" | "manifiesto";

export type SceneBg = "light" | "dark" | "color";

/** Un fragmento de una linea. `accent` lo pinta con el color de epoca. */
export interface Span {
  text: string;
  accent?: boolean;
  italic?: boolean;
}

/** Una linea = varios spans en fila (permite acento en una sola palabra). */
export type Line = Span[];

/** Tamano tipografico como token (el Director elige de un set cerrado). */
export type Scale = "s" | "m" | "l" | "xl";

export type LayoutKind =
  | "portada" | "enunciado" | "nombre" | "cifra" | "corte" | "cierre"
  | "pregunta" | "cita" | "anio" | "lista" | "contraste" | "imagen";

export type Pan = "in" | "left" | "right" | "up" | "down";
export type Scrim = "bottom" | "top" | "full" | "none";

interface SceneBase {
  kind: LayoutKind;
  /** frame donde entra la escena */
  from: number;
  /** cuantos frames dura */
  durationInFrames: number;
  bg?: SceneBg; // default: "light"
  /** ruta en public (img/xxx.png): imagen de archivo a sangre completa detras del texto */
  image?: string;
  /** la imagen se ve DENTRO del texto grande (image-in-type) */
  imageFill?: string;
  pan?: Pan;      // Ken Burns
  scrim?: Scrim;  // veladura para legibilidad
}

export interface PortadaScene extends SceneBase {
  kind: "portada";
  kicker: string;      // etiqueta mono
  titulo: Line[];      // lineas serif (rise escalonado)
  rule?: boolean;      // hairline que se dibuja
}

export interface EnunciadoScene extends SceneBase {
  kind: "enunciado";
  label?: string;      // mono pequeno arriba
  titulo: Line[];      // serif grande, acentos por span
  sub?: string;        // linea italica debajo
  scale?: Scale;       // default "l"
}

export interface NombreScene extends SceneBase {
  kind: "nombre";
  pre?: string;        // serif suave arriba
  nombre: string;      // serif enorme
  underline?: boolean; // subrayado de acento
}

export interface CifraScene extends SceneBase {
  kind: "cifra";
  pre?: string;        // mono arriba
  prefix?: string;     // ej. "≈ "
  valor: number;       // se cuenta de 0 a valor
  suffix?: string;     // ej. " %"
  sub?: string;        // italica debajo
}

export interface CorteScene extends SceneBase {
  kind: "corte";
  linea1: string;
  linea2: Span;        // normalmente acento
  tags?: string[];     // fila mono opcional
  bg?: SceneBg;        // normalmente "dark"
}

export interface CierreScene extends SceneBase {
  kind: "cierre";
  mark: string;        // marca mono superior
  titulo: string;      // titulo serif
  meta: string;        // linea mono
  ribbon?: PeriodCode[]; // cinta de colores de epoca
}

export interface PreguntaScene extends SceneBase {
  kind: "pregunta";
  kicker?: string;     // mono, opcional
  pregunta: Line[];    // lineas serif (gancho)
}
export interface CitaScene extends SceneBase {
  kind: "cita";
  cita: Line;          // parrafo serif italico (con acento inline)
  autor?: string;      // — Autor
  fuente?: string;     // contexto mono opcional
}
export interface AnioScene extends SceneBase {
  kind: "anio";
  label?: string;      // mono arriba
  anio: string;        // "1810" o "1810–1830"
  sub?: string;        // italica debajo
}
export interface ListaScene extends SceneBase {
  kind: "lista";
  titulo?: string;     // encabezado mono/serif
  items: string[];     // suben en secuencia, con indice
}
export interface ContrasteScene extends SceneBase {
  kind: "contraste";
  eje?: string;        // etiqueta mono del eje
  a: string;           // serif, tinta
  b: string;           // serif, acento
}
export interface ImagenScene extends SceneBase {
  kind: "imagen";
  image: string;       // obligatoria: imagen a sangre completa (respiro/cutaway)
  kicker?: string;     // mono opcional
  titulo?: Line[];     // titulo serif opcional sobre la imagen
  pie?: string;        // pie de foto mono opcional
}

export type Scene =
  | PortadaScene | EnunciadoScene | NombreScene
  | CifraScene | CorteScene | CierreScene
  | PreguntaScene | CitaScene | AnioScene | ListaScene | ContrasteScene | ImagenScene;

export interface ScoreMeta {
  topic: string;
  title: string;
  periodCode: PeriodCode;
  periodLabel: string;   // ej. "La Violencia"
  personality: Personality;
  fps: number;           // 30
  width: number;         // 1080
  height: number;        // 1920
  durationInFrames: number;
}

export interface TypographicScore {
  meta: ScoreMeta;
  scenes: Scene[];
}
