/**
 * Fixtures de QA: UNA partitura por cada tipo de video, sobre el mismo tema
 * (el Bogotazo), cada una ejercitando la gramática y la firma visual de su
 * estilo. Se registran como composiciones `fx-<estilo>` en Root.tsx para
 * revisar stills y MP4s por estilo sin pasar por el Director.
 *
 * Las imágenes viven en `remotion/public/img/f*.jpg` (solo dev, no van al repo;
 * se bajan de Wikimedia Commons). Si faltan, ArchivalImage cae a puro tipo.
 */
import type { TypographicScore, Scene } from "../schema";

const F_CALLE = "img/f1.jpg";   // calle del Bogotazo (tranvía en llamas)
const F_TURBA = "img/f2.jpg";   // disturbios frente al Capitolio
const F_GAITAN = "img/f3.jpg";  // retrato de Jorge Eliécer Gaitán
const F_PLAZA = "img/f4.jpg";   // Plaza de Bolívar

/** Omit distributivo: quita el timing a CADA miembro de la unión (no la colapsa). */
type NoTiming<S> = S extends Scene ? Omit<S, "from" | "durationInFrames"> : never;
type SceneDef = [NoTiming<Scene>, number];

function build(title: string, styleId: string, defs: SceneDef[]): TypographicScore {
  let from = 0;
  const scenes: Scene[] = defs.map(([s, sec]) => {
    const durationInFrames = Math.round(sec * 30);
    const scene = { ...s, from, durationInFrames } as Scene;
    from += durationInFrames;
    return scene;
  });
  return {
    meta: {
      topic: "El Bogotazo",
      title,
      periodCode: "VIO",
      periodLabel: "La Violencia",
      personality: styleId as never,
      fps: 30,
      width: 1080,
      height: 1920,
      durationInFrames: from,
    },
    scenes,
  };
}

export const FIXTURES: Record<string, TypographicScore> = {
  "hueso-y-ceniza": build("El día que ardió Bogotá", "hueso-y-ceniza", [
    [{ kind: "portada", bg: "dark", kicker: "9 de abril · 1948", titulo: [[{ text: "El día que" }], [{ text: "ardió ", accent: true }, { text: "Bogotá" }]], rule: true }, 3.6],
    [{ kind: "enunciado", image: F_CALLE, scrim: "full", pan: "in", titulo: [[{ text: "Un disparo" }], [{ text: "encendió la ", accent: false }, { text: "ciudad", accent: true }]] }, 3.6],
    [{ kind: "corte", bg: "dark", linea1: "No fue un motín.", linea2: { text: "Fue una ruptura.", accent: true }, tags: ["Gaitán", "1948", "Centro"] }, 3.4],
    [{ kind: "cifra", bg: "light", pre: "Muertos estimados", prefix: "≈ ", valor: 3000, sub: "solo en los primeros días" }, 3.8],
    [{ kind: "imagen", image: F_TURBA, pan: "up", kicker: "Archivo", titulo: [[{ text: "La turba llegó" }], [{ text: "al ", accent: false }, { text: "Capitolio", accent: true }]], pie: "Sady González · Bogotá, 1948" }, 3.8],
    [{ kind: "cierre", bg: "dark", mark: "Historia Colombiana", titulo: "La Violencia", meta: "1948 – 1958 · Serie documental", ribbon: ["VIO", "FN", "CNA"] }, 3.6],
  ]),

  manifiesto: build("Lo que el 9 de abril gritó", "manifiesto", [
    [{ kind: "portada", kicker: "Manifiesto · 1948", titulo: [[{ text: "Lo que el" }], [{ text: "9 de abril", accent: true }], [{ text: "gritó" }]], rule: true }, 3.4],
    [{ kind: "enunciado", bg: "color", scale: "xl", titulo: [[{ text: "El pueblo" }], [{ text: "no cabía" }], [{ text: "en la urna" }]] }, 3.2],
    [{ kind: "corte", bg: "dark", linea1: "Mataron al caudillo.", linea2: { text: "Nació la rabia.", accent: true } }, 3.2],
    [{ kind: "enunciado", scale: "l", titulo: [[{ text: "La palabra fue" }], [{ text: "pólvora", accent: true }]], sub: "y la ciudad, papel" }, 3.2],
    [{ kind: "pregunta", bg: "color", pregunta: [[{ text: "¿Quién manda" }], [{ text: "cuando el líder" }], [{ text: "cae?" }]] }, 3.4],
    [{ kind: "cierre", mark: "Historia Colombiana", titulo: "Manifiesto", meta: "El Bogotazo · 9 de abril de 1948" }, 3.4],
  ]),

  brutalista: build("3000", "brutalista", [
    [{ kind: "portada", bg: "dark", kicker: "Bogotá · 1948", titulo: [[{ text: "EL PESO" }], [{ text: "DE UN ", accent: false }, { text: "DISPARO", accent: true }]] }, 3],
    [{ kind: "cifra", bg: "color", pre: "Muertos en una semana", prefix: "≈ ", valor: 3000 }, 3.2],
    [{ kind: "corte", bg: "dark", linea1: "Una bala.", linea2: { text: "Diez años de guerra.", accent: true } }, 2.8],
    [{ kind: "contraste", eje: "El país partido", a: "Un caudillo", b: "Una nación rota" }, 3.4],
    [{ kind: "cifra", bg: "light", pre: "Edificios destruidos", valor: 142, sub: "en el centro de Bogotá" }, 3.2],
    [{ kind: "cierre", bg: "dark", mark: "Historia Colombiana", titulo: "Plomo", meta: "La Violencia · 1948–1958" }, 3],
  ]),

  "cifra-monumento": build("El Bogotazo en cifras", "cifra-monumento", [
    [{ kind: "portada", kicker: "El dato · 1948", titulo: [[{ text: "El Bogotazo" }], [{ text: "en ", accent: false }, { text: "cifras", accent: true }]], rule: true }, 3.4],
    [{ kind: "cifra", pre: "Muertos estimados", prefix: "≈ ", valor: 3000, sub: "9 – 15 de abril de 1948" }, 3.8],
    [{ kind: "contraste", eje: "La escala", a: "1 magnicidio", b: "10 años de Violencia" }, 3.6],
    [{ kind: "lista", titulo: "Lo que se quemó", items: ["El tranvía municipal", "142 edificios del centro", "Los archivos judiciales"] }, 4.2],
    [{ kind: "cifra", bg: "dark", pre: "Desplazados en la década", prefix: "≈ ", valor: 2000000, sub: "la cifra que nadie contó" }, 4],
    [{ kind: "cierre", mark: "Historia Colombiana", titulo: "Cifra-monumento", meta: "El Bogotazo · 1948", ribbon: ["VIO", "FN"] }, 3.4],
  ]),

  voces: build("Voces del 9 de abril", "voces", [
    [{ kind: "portada", bg: "dark", kicker: "Testimonios · 1948", titulo: [[{ text: "Voces del" }], [{ text: "9 de abril", accent: true }]], rule: true }, 3.6],
    [{ kind: "cita", image: F_GAITAN, scrim: "full", pan: "in", cita: [{ text: "¡Yo no soy un hombre, " }, { text: "soy un pueblo!", accent: true }], autor: "Jorge Eliécer Gaitán", fuente: "Discurso, 1946" }, 4.4],
    [{ kind: "cita", bg: "light", cita: [{ text: "Bogotá olía a humo y a " }, { text: "pólvora", accent: true }, { text: " durante semanas." }], autor: "Testigo anónimo", fuente: "Crónica de época" }, 4.2],
    [{ kind: "cifra", bg: "dark", pre: "Radios tomadas por la turba", valor: 12, sub: "la revuelta se narró en vivo" }, 3.6],
    [{ kind: "cita", image: F_TURBA, scrim: "full", pan: "up", cita: [{ text: "Nadie daba órdenes: la ciudad " }, { text: "se mandaba sola", accent: true }, { text: "." }], autor: "Arturo Alape", fuente: "El Bogotazo, 1983" }, 4.4],
    [{ kind: "cierre", bg: "dark", mark: "Historia Colombiana", titulo: "Voces", meta: "El Bogotazo · 1948" }, 3.6],
  ]),

  cronologia: build("Nueve horas de abril", "cronologia", [
    [{ kind: "portada", kicker: "Cronología · 1948", titulo: [[{ text: "Nueve horas" }], [{ text: "de ", accent: false }, { text: "abril", accent: true }]], rule: true }, 3.4],
    [{ kind: "anio", image: F_GAITAN, scrim: "bottom", pan: "right", label: "1:05 p. m.", anio: "1:05", sub: "Gaitán sale de su oficina" }, 3.6],
    [{ kind: "anio", bg: "light", label: "1:15 p. m.", anio: "1:15", sub: "tres disparos en la Carrera Séptima" }, 3.4],
    [{ kind: "imagen", image: F_CALLE, pan: "right", kicker: "3:00 p. m.", titulo: [[{ text: "El centro" }], [{ text: "en ", accent: false }, { text: "llamas", accent: true }]], pie: "Archivo · Bogotá, 1948" }, 3.6],
    [{ kind: "anio", bg: "dark", label: "Medianoche", anio: "10:00", sub: "el ejército retoma la Plaza" }, 3.4],
    [{ kind: "cierre", mark: "Historia Colombiana", titulo: "Cronología", meta: "9 de abril de 1948", ribbon: ["VIO"] }, 3.4],
  ]),

  retrato: build("Gaitán", "retrato", [
    [{ kind: "nombre", bg: "dark", pre: "El caudillo del pueblo", nombre: "GAITÁN", imageFill: F_GAITAN, underline: true }, 4],
    [{ kind: "enunciado", titulo: [[{ text: "Abogado, tribuno," }], [{ text: "candidato del ", accent: false }, { text: "pueblo", accent: true }]], sub: "Bogotá, 1898 – 1948" }, 3.6],
    [{ kind: "anio", image: F_PLAZA, scrim: "bottom", pan: "in", label: "El ascenso", anio: "1946", sub: "funda su movimiento popular" }, 3.6],
    [{ kind: "cita", bg: "light", cita: [{ text: "El hambre no es " }, { text: "liberal", accent: true }, { text: " ni conservadora." }], autor: "Jorge Eliécer Gaitán" }, 4],
    [{ kind: "cifra", bg: "dark", pre: "Personas en su marcha del silencio", prefix: "≈ ", valor: 100000, sub: "febrero de 1948" }, 3.8],
    [{ kind: "cierre", mark: "Historia Colombiana", titulo: "Retrato", meta: "Jorge Eliécer Gaitán · 1898–1948" }, 3.6],
  ]),

  archivo: build("Bogotá, abril de 1948", "archivo", [
    [{ kind: "portada", bg: "dark", kicker: "Archivo · 1948", titulo: [[{ text: "Bogotá," }], [{ text: "abril de ", accent: false }, { text: "1948", accent: true }]], rule: true }, 4],
    [{ kind: "imagen", image: F_CALLE, pan: "in", kicker: "Carrera Séptima", pie: "Sady González · Archivo de Bogotá" }, 4.6],
    [{ kind: "imagen", image: F_TURBA, pan: "left", kicker: "El Capitolio", titulo: [[{ text: "La multitud" }]], pie: "Archivo fotográfico · 1948" }, 4.6],
    [{ kind: "cita", bg: "dark", cita: [{ text: "Las fotos llegaron antes que los " }, { text: "periódicos", accent: true }, { text: "." }], autor: "Historia gráfica de Colombia" }, 4.2],
    [{ kind: "imagen", image: F_PLAZA, pan: "up", kicker: "Plaza de Bolívar", pie: "Panorámica · mediados de siglo" }, 4.6],
    [{ kind: "cierre", bg: "dark", mark: "Historia Colombiana", titulo: "Archivo", meta: "El Bogotazo · 1948" }, 4],
  ]),

  editorial: build("El magnicidio que partió el siglo", "editorial", [
    [{ kind: "portada", kicker: "Reportaje · 1948", titulo: [[{ text: "El magnicidio que" }], [{ text: "partió el ", accent: false }, { text: "siglo", accent: true }]], rule: true }, 3.6],
    [{ kind: "enunciado", label: "La tesis", titulo: [[{ text: "Un crimen sin" }], [{ text: "culpable ", accent: false }, { text: "claro", accent: true }]], sub: "y un país que ya estaba en guerra" }, 3.8],
    [{ kind: "cita", cita: [{ text: "El 9 de abril el siglo XX colombiano se " }, { text: "quebró en dos", accent: true }, { text: "." }], autor: "Herbert Braun", fuente: "Mataron a Gaitán" }, 4.2],
    [{ kind: "lista", titulo: "Tres consecuencias", items: ["La Violencia se vuelve nacional", "El centro de Bogotá se reconstruye", "El bipartidismo pacta el Frente Nacional"] }, 4.4],
    [{ kind: "imagen", image: F_PLAZA, pan: "in", kicker: "El escenario", titulo: [[{ text: "La Plaza vacía" }]], pie: "Plaza de Bolívar · Archivo" }, 3.8],
    [{ kind: "cifra", pre: "Años del Frente Nacional", valor: 16, sub: "el pacto que siguió al fuego" }, 3.6],
    [{ kind: "cierre", mark: "Historia Colombiana", titulo: "Editorial", meta: "El Bogotazo · 1948", ribbon: ["VIO", "FN"] }, 3.6],
  ]),

  collage: build("Extra: arde Bogotá", "collage", [
    [{ kind: "portada", bg: "dark", kicker: "Prensa · 9 de abril", titulo: [[{ text: "EXTRA:" }], [{ text: "arde ", accent: false }, { text: "Bogotá", accent: true }]] }, 3],
    [{ kind: "imagen", image: F_CALLE, pan: "left", kicker: "Última hora", pie: "El Tiempo · 10 de abril de 1948" }, 2.6],
    [{ kind: "corte", bg: "dark", linea1: "Cayó Gaitán.", linea2: { text: "La calle responde.", accent: true }, tags: ["Extra", "Bogotá"] }, 2.8],
    [{ kind: "imagen", image: F_TURBA, pan: "right", kicker: "El Capitolio", pie: "Foto: Sady González" }, 2.6],
    [{ kind: "enunciado", scale: "l", titulo: [[{ text: "Los titulares" }], [{ text: "salieron ", accent: false }, { text: "quemados", accent: true }]] }, 3],
    [{ kind: "imagen", image: F_PLAZA, pan: "down", kicker: "La plaza", pie: "Panorámica · Archivo" }, 2.6],
    [{ kind: "cierre", bg: "dark", mark: "Historia Colombiana", titulo: "Prensa", meta: "El Bogotazo · 1948" }, 3.2],
  ]),
};
