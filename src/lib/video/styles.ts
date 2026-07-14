/**
 * Catálogo de TIPOS/estilos de video. Cada uno es una receta (composición, uso de
 * imagen, movimiento, voz) que el Director aplica a cualquier tema. La línea
 * gráfica es la misma; el tipo cambia el carácter. `imageUsage` guía cuántas
 * consultas de archivo resolver (y con qué agresividad caer a puro tipo).
 *
 * El Escenario además lee el id del tipo (meta.personality) y le pone su FIRMA
 * visual (stylepack): transición, tratamiento de foto, tempo. El brief le dice
 * al compositor cómo escribir PARA esa firma.
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
    brief: "HUESO Y CENIZA (documental forense): imagen de archivo B/N FUNDIDA con el texto — a sangre completa detrás con scrim, o dentro de las letras (image-in-type). Silencio visual antes del golpe. El acento del texto y el de la foto son el mismo color. Copys de tráiler documental. La mayoría de escenas llevan imagen: VARÍA el \"pan\" entre ellas (in/left/up/right) y usa \"scrim\":\"full\" cuando el texto cae al centro de la foto.",
  },
  {
    id: "manifiesto", label: "Manifiesto", imageUsage: "none",
    brief: "MANIFIESTO (arenga puro tipo): enunciados enormes y sentenciosos, SIN imágenes, texto centrado. Alterna blanco editorial y campo de acento pleno (bg:color), ritmo de proclama: cada corte llega con un barrido de color, así que cada escena es una consigna que aguanta sola el golpe.",
  },
  {
    id: "brutalista", label: "Brutalista / Plomo", imageUsage: "none",
    brief: "BRUTALISTA/PLOMO: tipografía colosal y números como bloques (cifra), SIN imágenes, solo campos de color (bg:color) y negro (corte), contraste de escala extremo. Mecánico, voz de lápida. Mucho cifra, contraste y corte; los cortes son secos y rápidos — frases cortas que soporten ese martilleo.",
  },
  {
    id: "cifra-monumento", label: "Cifra-monumento", imageUsage: "minimal",
    brief: "DATO DRAMÁTICO: guiado por cifras. cifra-monumento + contraste + lista, comparaciones que aplastan (una cifra diminuta al lado de una brutal). Casi todo tipo; a lo sumo 1 imagen al cierre (\"pan\":\"in\"). Voz de dato seco: cada número aterriza con su subrayado, dale a cada cifra un \"pre\" y un \"sub\" que la expliquen sola.",
  },
  {
    id: "voces", label: "Voces / Testimonio", imageUsage: "mixed",
    brief: "VOCES/TESTIMONIO: guiado por citas (cita) de la época —testimonios, historiadores, documentos— con imágenes de archivo de fondo (retratos, documentos). La imagen testifica, no ilustra: retratos con \"pan\":\"in\" lento y \"scrim\":\"full\". Cada cita llega tras un fundido a negro que respira; avanza voz por voz.",
  },
  {
    id: "cronologia", label: "Cronología", imageUsage: "mixed",
    brief: "CRONOLOGÍA/LÍNEA DE FUEGO: escenas anio como jalones temporales, con imagen de archivo del lugar/hecho de fondo. Marcha estrictamente cronológica: el montaje barre SIEMPRE hacia la derecha (el tiempo avanza), así que en las imágenes prefiere \"pan\":\"right\" o \"in\". Cada año es un jalón con su \"sub\" que dice qué pasó.",
  },
  {
    id: "retrato", label: "Retrato", imageUsage: "mixed",
    brief: "RETRATO: una persona. Abre con nombre + image-in-type (su retrato DENTRO de las letras de su nombre, imageFill con una consulta del retrato), encadena hitos (enunciado/anio/cifra), una cita suya, cierra con su legado. Los retratos de fondo panean lento (\"pan\":\"in\" o \"up\"); varía el encuadre entre escenas.",
  },
  {
    id: "archivo", label: "Archivo / Contemplativo", imageUsage: "heavy",
    brief: "ARCHIVO/CONTEMPLATIVO: pausado, imágenes de archivo a sangre completa (kind imagen) con poco texto y pie de foto, respira, tono de documento. Menos cortes, más aire: cada corte funde a negro despacio. Deja que la foto hable — \"pan\" lento y VARIADO entre escenas, \"scrim\" según dónde va el texto, pies de foto con fuente y año.",
  },
  {
    id: "editorial", label: "Editorial / Revista", imageUsage: "mixed",
    brief: "EDITORIAL/REVISTA: reportaje premium animado. Jerarquía rica: enunciado + cita (pull-quote) + lista + alguna imagen con pie. Mezcla imagen y tipo, elegante; varía el \"pan\" de las fotos y dales pie de foto (\"pie\") con fuente. El acento subraya la palabra clave de cada enunciado.",
  },
  {
    id: "collage", label: "Prensa / Collage", imageUsage: "heavy",
    brief: "PRENSA/COLLAGE: energía de recorte de periódico. Las fotos entran como COPIAS IMPRESAS (borde blanco, rotadas) con persianas: usa varias escenas \"imagen\" CORTAS (weight 0.6–0.8) con \"pan\" agresivo y variado, intercaladas con enunciado y corte. Ritmo veloz, titulares de primera plana, pies de foto tipo leyenda de prensa.",
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
