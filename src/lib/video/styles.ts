/**
 * Catálogo de TIPOS/estilos de video. Cada uno es una receta (composición, uso de
 * imagen, movimiento, voz) que el Director aplica a cualquier tema. La línea
 * gráfica es la misma; el tipo cambia el carácter. `imageUsage` guía cuántas
 * consultas de archivo resolver (y con qué agresividad caer a puro tipo).
 */
export type ImageUsage = "none" | "minimal" | "mixed" | "heavy";

export interface VideoStyle {
  id: string;
  label: string;
  imageUsage: ImageUsage;
  /** Instrucción de carácter que se inyecta en el prompt del compositor. */
  brief: string;
}

export const VIDEO_STYLES: VideoStyle[] = [
  {
    id: "hueso-y-ceniza", label: "Hueso y Ceniza", imageUsage: "heavy",
    brief: "HUESO Y CENIZA (documental forense): imagen de archivo B/N FUNDIDA con el texto — a sangre completa detrás con scrim, o dentro de las letras (image-in-type). Silencio visual antes del golpe. El acento del texto y el de la foto son el mismo color. Copys de tráiler documental. La mayoría de escenas llevan imagen.",
  },
  {
    id: "manifiesto", label: "Manifiesto", imageUsage: "none",
    brief: "MANIFIESTO (arenga puro tipo): enunciados enormes y sentenciosos, SIN imágenes. Alterna blanco editorial y campo de acento pleno (bg:color), ritmo de proclama. Cada escena es un golpe que se sostiene en la palabra.",
  },
  {
    id: "brutalista", label: "Brutalista / Plomo", imageUsage: "none",
    brief: "BRUTALISTA/PLOMO: tipografía colosal y números como bloques (cifra), SIN imágenes, solo campos de color (bg:color) y negro (corte), contraste de escala extremo. Mecánico, voz de lápida. Mucho cifra, contraste y corte.",
  },
  {
    id: "cifra-monumento", label: "Cifra-monumento", imageUsage: "minimal",
    brief: "DATO DRAMÁTICO: guiado por cifras. cifra-monumento + contraste + lista, comparaciones que aplastan (una cifra diminuta al lado de una brutal). Casi todo tipo; a lo sumo 1 imagen al cierre. Voz de dato seco.",
  },
  {
    id: "voces", label: "Voces / Testimonio", imageUsage: "mixed",
    brief: "VOCES/TESTIMONIO: guiado por citas (cita) de la época —testimonios, historiadores, documentos— con imágenes de archivo de fondo (retratos, documentos). La imagen testifica, no ilustra. Avanza voz por voz.",
  },
  {
    id: "cronologia", label: "Cronología", imageUsage: "mixed",
    brief: "CRONOLOGÍA/LÍNEA DE FUEGO: escenas anio como jalones temporales, con imagen de archivo del lugar/hecho de fondo. Marcha estrictamente cronológica en el tiempo.",
  },
  {
    id: "retrato", label: "Retrato", imageUsage: "mixed",
    brief: "RETRATO: una persona. Abre con nombre + image-in-type (su retrato DENTRO de las letras de su nombre, imageFill con una consulta del retrato), encadena hitos (enunciado/anio/cifra), una cita suya, cierra con su legado.",
  },
  {
    id: "archivo", label: "Archivo / Contemplativo", imageUsage: "heavy",
    brief: "ARCHIVO/CONTEMPLATIVO: pausado, imágenes de archivo a sangre completa (kind imagen) con poco texto y pie de foto, respira, tono de documento. Menos cortes, más aire.",
  },
  {
    id: "editorial", label: "Editorial / Revista", imageUsage: "mixed",
    brief: "EDITORIAL/REVISTA: reportaje premium animado. Jerarquía rica: enunciado + cita (pull-quote) + lista + alguna imagen con pie. Mezcla imagen y tipo, elegante.",
  },
  {
    id: "collage", label: "Prensa / Collage", imageUsage: "heavy",
    brief: "PRENSA/COLLAGE: energía de recorte de periódico, cortes rápidos entre varias imágenes de archivo (escenas imagen cortas, weight bajo) intercaladas con enunciado y corte. Ritmo veloz.",
  },
];

const BY_ID = new Map(VIDEO_STYLES.map((s) => [s.id, s]));
export function getStyle(id: string): VideoStyle {
  return BY_ID.get(id) ?? VIDEO_STYLES[0];
}
/** Cota de imágenes a resolver por video, según el tipo. */
export function imageCapFor(usage: ImageUsage): number {
  return usage === "none" ? 0 : usage === "minimal" ? 1 : usage === "mixed" ? 4 : 6;
}
