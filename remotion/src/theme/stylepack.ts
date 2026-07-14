/**
 * La FIRMA VISUAL de cada tipo de video. El Director elige el estilo y escribe
 * el guion; aquí el Escenario decide cómo SE VE Y SE MUEVE ese estilo: qué
 * transición usa, cómo trata la foto de archivo, con cuánta energía panea,
 * cómo salen las escenas. `meta.personality` trae el id del tipo (styles.ts)
 * o una personalidad legacy — ambos resuelven a un pack. La línea gráfica
 * (fuentes, paleta, chrome) es la misma para todos; el pack cambia el carácter.
 */
import React from "react";

/** Corte preferido del estilo entre escenas. */
export type CutKind = "wipe" | "dip" | "blinds" | "flash" | "none";
/** Cómo se va el contenido de una escena antes del corte. */
export type ExitKind = "varied" | "fade" | "up" | "crush" | "slide";
export type Align = "left" | "center";

/** Tratamiento de la imagen de archivo (todas parten de B/N). */
export interface ImageTreat {
  /** opacidad del tinte de época sobre la foto (duotono) */
  duotone: number;
  contrast: number;
  brightness: number;
  /** opacidad de la viñeta (oscurece bordes, foco al centro) */
  vignette: number;
  /** grano de película sobre la foto (animado) */
  grain: number;
  /** true = copia impresa: borde blanco, leve rotación, sombra (prensa/collage) */
  frame: boolean;
}

export interface StylePack {
  id: string;
  /** multiplica los delays de entrada (1 neutro; >1 legato, <1 staccato) */
  tempo: number;
  /** energía del Ken Burns (1 neutro; <1 contemplativo, >1 punchy) */
  kenburns: number;
  /** energía de la deriva de la escena durante el hold */
  drift: number;
  align: Align;
  image: ImageTreat;
  /** duración base de la transición del estilo, en frames */
  cutLen: number;
  exit: ExitKind;
  /** opacidad del grano global sobre todo el video */
  grain: number;
  /** la cifra grande toma el color de acento (estilos de dato) */
  numberAccent: boolean;
}

const BASE_IMAGE: ImageTreat = {
  duotone: 0.14, contrast: 1.08, brightness: 0.97, vignette: 0.26, grain: 0.05, frame: false,
};

const PACKS: Record<string, StylePack> = {
  // Documental forense: negros profundos, duotono marcado, cortes que respiran a negro.
  "hueso-y-ceniza": {
    id: "hueso-y-ceniza", tempo: 1.05, kenburns: 1.1, drift: 1, align: "left",
    image: { duotone: 0.2, contrast: 1.18, brightness: 0.9, vignette: 0.38, grain: 0.08, frame: false },
    cutLen: 18, exit: "varied", grain: 0.05, numberAccent: false,
  },
  // Arenga puro tipo: centrado, campos de color, barridos plenos en cada golpe.
  manifiesto: {
    id: "manifiesto", tempo: 0.95, kenburns: 1, drift: 1.1, align: "center",
    image: BASE_IMAGE,
    cutLen: 14, exit: "up", grain: 0.04, numberAccent: false,
  },
  // Bloques y lápida: cortes secos y rápidos, salidas que aplastan, cifra en acento.
  brutalista: {
    id: "brutalista", tempo: 0.85, kenburns: 1, drift: 1.15, align: "left",
    image: { ...BASE_IMAGE, contrast: 1.2, vignette: 0.2 },
    cutLen: 9, exit: "crush", grain: 0.055, numberAccent: true,
  },
  // Dato seco: el número manda; acentos solo donde hay cifra.
  "cifra-monumento": {
    id: "cifra-monumento", tempo: 1, kenburns: 0.95, drift: 0.9, align: "left",
    image: BASE_IMAGE,
    cutLen: 12, exit: "varied", grain: 0.045, numberAccent: true,
  },
  // Testimonios: legato, fundidos suaves, retratos con viñeta honda.
  voces: {
    id: "voces", tempo: 1.12, kenburns: 0.85, drift: 0.85, align: "left",
    image: { duotone: 0.12, contrast: 1.06, brightness: 0.88, vignette: 0.42, grain: 0.07, frame: false },
    cutLen: 20, exit: "fade", grain: 0.05, numberAccent: false,
  },
  // Marcha temporal: el tiempo avanza en un solo sentido (barridos a la derecha).
  cronologia: {
    id: "cronologia", tempo: 0.95, kenburns: 1.15, drift: 1, align: "left",
    image: BASE_IMAGE,
    cutLen: 13, exit: "slide", grain: 0.045, numberAccent: false,
  },
  // Biográfico: paneos lentos sobre el retrato, cortes con el acento del personaje.
  retrato: {
    id: "retrato", tempo: 1.05, kenburns: 0.8, drift: 0.9, align: "left",
    image: { duotone: 0.16, contrast: 1.1, brightness: 0.94, vignette: 0.34, grain: 0.06, frame: false },
    cutLen: 15, exit: "varied", grain: 0.05, numberAccent: false,
  },
  // Contemplativo: todo legato — fundidos largos, Ken Burns mínimo, más grano de archivo.
  archivo: {
    id: "archivo", tempo: 1.3, kenburns: 0.55, drift: 0.7, align: "left",
    image: { duotone: 0.1, contrast: 1.04, brightness: 0.95, vignette: 0.3, grain: 0.1, frame: false },
    cutLen: 26, exit: "fade", grain: 0.065, numberAccent: false,
  },
  // Revista premium: neutro refinado, mezcla wipe/fundido según la escena.
  editorial: {
    id: "editorial", tempo: 1, kenburns: 0.95, drift: 0.95, align: "left",
    image: BASE_IMAGE,
    cutLen: 14, exit: "varied", grain: 0.045, numberAccent: false,
  },
  // Prensa: staccato, persianas y flashes, fotos como copias impresas rotadas.
  collage: {
    id: "collage", tempo: 0.8, kenburns: 1.6, drift: 1.2, align: "left",
    image: { duotone: 0.1, contrast: 1.15, brightness: 1, vignette: 0.18, grain: 0.09, frame: true },
    cutLen: 11, exit: "slide", grain: 0.05, numberAccent: false,
  },
};

/** Personalidades legacy (runDirector sin estilo) → pack más afín. */
const PERSONALITY_PACK: Record<string, string> = {
  ruptura: "hueso-y-ceniza",
  cifra: "cifra-monumento",
  enigma: "hueso-y-ceniza",
  "causa-consecuencia": "editorial",
  contraste: "brutalista",
};

export function packFor(personalityOrStyleId: string): StylePack {
  return PACKS[personalityOrStyleId] ?? PACKS[PERSONALITY_PACK[personalityOrStyleId] ?? "editorial"];
}

/** Escala un delay de entrada al tempo del pack. */
export const tempo = (pack: StylePack, delay: number) => Math.round(delay * pack.tempo);

export const PackContext = React.createContext<StylePack>(PACKS.editorial);
export const usePack = () => React.useContext(PackContext);
