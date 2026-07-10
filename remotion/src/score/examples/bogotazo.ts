/**
 * Partitura de referencia — "El Bogotazo", personalidad "ruptura".
 * Escrita a mano para probar el Escenario. En la Fase B el Director producira
 * exactamente esta forma desde un tema + RAG. 30 fps, ~25.2 s (756 frames).
 */
import type { TypographicScore } from "../schema";

export const bogotazo: TypographicScore = {
  meta: {
    topic: "El Bogotazo",
    title: "El Bogotazo",
    periodCode: "VIO",
    periodLabel: "La Violencia",
    personality: "ruptura",
    fps: 30,
    width: 1080,
    height: 1920,
    durationInFrames: 756,
  },
  scenes: [
    {
      kind: "portada",
      from: 0,
      durationInFrames: 105,
      kicker: "Bogotá · 9 abril 1948",
      titulo: [[{ text: "El día en que" }], [{ text: "todo se rompió", italic: true }]],
      rule: true,
    },
    {
      kind: "enunciado",
      from: 93,
      durationInFrames: 99,
      label: "Carrera Séptima · centro",
      titulo: [[{ text: "Bogotá" }]],
      sub: "1:05 p.m. — un viernes cualquiera",
      scale: "xl",
    },
    {
      kind: "enunciado",
      from: 180,
      durationInFrames: 90,
      titulo: [[{ text: "1:05" }]],
      sub: "tres disparos en la Séptima",
      scale: "xl",
    },
    {
      kind: "nombre",
      from: 258,
      durationInFrames: 102,
      pre: "Jorge Eliécer",
      nombre: "Gaitán",
      underline: true,
    },
    {
      kind: "corte",
      from: 348,
      durationInFrames: 75,
      bg: "dark",
      linea1: "El caudillo",
      linea2: { text: "ha muerto.", accent: true },
    },
    {
      kind: "cifra",
      from: 411,
      durationInFrames: 108,
      pre: "En cuestión de horas",
      prefix: "≈ ",
      valor: 3000,
      sub: "muertos en el centro",
    },
    {
      kind: "corte",
      from: 507,
      durationInFrames: 96,
      bg: "dark",
      linea1: "La ciudad",
      linea2: { text: "en llamas", accent: true },
      tags: ["Tranvías", "Comercios", "Ministerios"],
    },
    {
      kind: "enunciado",
      from: 591,
      durationInFrames: 99,
      label: "Lo que vino después",
      titulo: [[{ text: "El país se partió" }], [{ text: "en " }, { text: "dos", accent: true, italic: true }, { text: "." }]],
      scale: "l",
    },
    {
      kind: "cierre",
      from: 678,
      durationInFrames: 78,
      mark: "Historia Colombiana · un minuto",
      titulo: "El Bogotazo",
      meta: "9 de abril de 1948 · La Violencia",
      ribbon: ["PRE_IND", "IND", "REG", "VIO", "FN", "POS"],
    },
  ],
};
