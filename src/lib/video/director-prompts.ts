/**
 * Los prompts del Director. Aquí vive la calidad: el vocabulario CERRADO de
 * layouts, las reglas de escritura kinetic-typography, y la disciplina de anclar
 * todo en la evidencia. El compositor escribe; el verificador corrige hechos.
 */
import { PERIOD_MENU } from "./periods";
import type { Personality } from "./score";

export const VOCAB_SPEC = `VOCABULARIO DE ESCENAS (cerrado — NO inventes otros "kind"):

1. "portada"  — apertura. { "kind":"portada", "kicker":"<mono: época · fecha o lugar>", "titulo":["<línea serif>","<otra línea>"], "rule":true }
2. "enunciado"— una idea o afirmación fuerte. { "kind":"enunciado", "label":"<mono corto, opcional>", "titulo":["<líneas serif>"], "sub":"<línea en itálica, opcional>", "scale":"s|m|l|xl" }
3. "nombre"   — un protagonista. { "kind":"nombre", "pre":"<nombre/rol suave, opcional>", "nombre":"<APELLIDO enorme>", "underline":true }
4. "cifra"    — un dato numérico. { "kind":"cifra", "pre":"<mono: contexto>", "prefix":"≈ ", "valor":3000, "suffix":" %", "sub":"<qué es, en itálica>" }
5. "corte"    — golpe dramático a fondo NEGRO. { "kind":"corte", "linea1":"<serif>", "linea2":"<serif; toma el color de acento>", "tags":["PALABRA","PALABRA"] }
6. "cierre"   — cierre de marca (al final). { "kind":"cierre", "titulo":"<el tema>", "meta":"<fecha · época>", "ribbon":["IND","VIO","POS"] }
7. "pregunta" — un gancho en forma de pregunta. { "kind":"pregunta", "kicker":"<mono opcional>", "pregunta":["<línea serif>","<otra>"] }
8. "cita"     — una cita textual (testimonio, historiador, documento). { "kind":"cita", "cita":"<frase, máx ~18 palabras>", "autor":"<quién>", "fuente":"<año u obra, opcional>" }
9. "anio"     — un año o rango como protagonista. { "kind":"anio", "label":"<mono>", "anio":"1810", "sub":"<itálica opcional>" }
10. "lista"   — 2 a 4 puntos que suben en secuencia. { "kind":"lista", "titulo":"<mono>", "items":["<punto corto>","<punto>","<punto>"] }
11. "contraste"— dos fuerzas enfrentadas. { "kind":"contraste", "eje":"<mono>", "a":"<lado A>", "b":"<lado B, toma el acento>" }

MARCADORES dentro de los textos:
- *palabra*  → esa palabra toma el color de acento (la tinta de la época). Máximo UNA por línea.
- _palabra_  → itálica (Instrument Serif). Se pueden combinar: *_palabra_*.
- "scale":"xl" para una sola palabra o cifra corta (un año, "Bogotá"). "l" para frases; "m"/"s" si son largas.
- "bg": opcional en cualquier escena — "dark" (fondo negro) o "color" (campo del color de época, texto blanco) para un golpe visual fuerte. Úsalo con intención: 1–3 escenas por video, en los momentos de mayor peso (un quiebre, una cifra brutal, el clímax).
- "weight": número opcional 0.5–1.6 para que una escena dure más (énfasis) o menos.`;

export const WRITING_RULES = `REGLAS DE ESCRITURA (esto es tipografía en movimiento, NO prosa):
- Una idea por escena. Pocas palabras. Frases cortas y contundentes.
- Nada de párrafos, nada de comas largas. Piensa en titulares que golpean.
- Cada CIFRA, FECHA o NOMBRE debe estar respaldado por la evidencia. Si no hay respaldo, NO lo inventes: usa una afirmación cualitativa.
- Un solo *acento* por línea, la palabra clave.
- Arco narrativo: apertura → tensión (nombres, cifras, un par de cortes a negro) → consecuencia → cierre.
- Español de Colombia, registro histórico serio pero vivo. Sin clichés de redes.`;

export function personalityBrief(p: Personality): string {
  switch (p) {
    case "ruptura":
      return `PERSONALIDAD "ruptura": tensión y quiebre. Alterna ritmo, usa 1–2 escenas "corte" a negro en los momentos de fractura. Cifras duras, frases sentenciosas. Empieza situando (portada), remata con una consecuencia fuerte antes del cierre.`;
    case "cifra":
      return `PERSONALIDAD "cifra": guiada por datos. Prioriza escenas "cifra" y "enunciado"; cada número ancla un punto. Menos cortes a negro.`;
    case "archivo":
      return `PERSONALIDAD "archivo": contemplativa. Ritmo más pausado (weights altos), más "enunciado" y "nombre", pocos o ningún "corte". Tono de documento.`;
    case "retrato":
      return `PERSONALIDAD "retrato": biográfica. Centra en una persona: abre con "nombre", encadena hitos con "enunciado", "anio" y "cifra", cierra con su legado.`;
    case "cronologia":
      return `PERSONALIDAD "cronologia": marcha en el tiempo. Usa varias escenas "anio" como jalones, con "enunciado" entre ellas. Orden estrictamente cronológico; el video avanza como una línea de tiempo.`;
    case "voces":
      return `PERSONALIDAD "voces": narrada por fuentes. Prioriza "cita" (testimonios, historiadores, documentos de la época) intercaladas con "enunciado". Deja que las voces lleven el hilo; ancla cada cita en la evidencia.`;
    case "enigma":
      return `PERSONALIDAD "enigma": abre con una "pregunta" fuerte (el gancho), desarrolla la tensión con "enunciado"/"cifra"/"corte", y resuelve al final. La pregunta inicial organiza todo el video.`;
    case "causa-consecuencia":
      return `PERSONALIDAD "causa-consecuencia": explica un antes y un después. Una "lista" de causas → un "corte" de bisagra → una "lista" de consecuencias. Cierra con el saldo.`;
    case "contraste":
      return `PERSONALIDAD "contraste": dos fuerzas enfrentadas. Apóyate en escenas "contraste" y "corte"; cada beat es una tensión entre dos lados (bandos, proyectos, regiones).`;
    case "manifiesto":
      return `PERSONALIDAD "manifiesto": arenga. "enunciado" grandes y sentenciosos, ritmo de proclama, frases que golpean. Pocos datos, mucha convicción; remata con una afirmación rotunda.`;
    default:
      return `PERSONALIDAD "ruptura": tensión y quiebre, con 1–2 "corte" a negro en los momentos de fractura.`;
  }
}

function sceneHint(durationSec: number): string {
  if (durationSec <= 15) return "6 a 7 escenas";
  if (durationSec <= 30) return "9 a 12 escenas";
  if (durationSec <= 45) return "12 a 16 escenas";
  return "16 a 22 escenas";
}

const EXAMPLE = `EJEMPLO (formato exacto, abreviado):
{
  "periodCode": "VIO",
  "title": "El Bogotazo",
  "scenes": [
    { "kind":"portada", "kicker":"Bogotá · 9 abril 1948", "titulo":["El día en que","_todo se rompió_"], "rule":true },
    { "kind":"nombre", "pre":"Jorge Eliécer", "nombre":"Gaitán", "underline":true },
    { "kind":"corte", "linea1":"El caudillo", "linea2":"ha muerto." },
    { "kind":"cifra", "pre":"En cuestión de horas", "prefix":"≈ ", "valor":3000, "sub":"muertos en el centro" },
    { "kind":"enunciado", "label":"Lo que vino después", "titulo":["El país se partió","en *dos*."] },
    { "kind":"cierre", "titulo":"El Bogotazo", "meta":"9 de abril de 1948 · La Violencia", "ribbon":["IND","VIO","POS"] }
  ]
}`;

/** `brief` = el carácter del tipo/estilo (de styles.ts) o de una personalidad. */
export function buildComposeSystem(brief: string): string {
  return `Eres el Director de video de "Historia Colombiana": conviertes un tema histórico en un guion de video tipográfico vertical (9:16) que resume el tema con ritmo y personalidad, sobre una misma línea gráfica editorial.

${VOCAB_SPEC}

${WRITING_RULES}

${brief}

Para escenas con imagen, pon en "image"/"imageFill" una CONSULTA de búsqueda de archivo (2-4 palabras con nombres propios), no una ruta.

ÉPOCAS (elige un "periodCode" para el tema):
${PERIOD_MENU}

Respondes ÚNICAMENTE con un objeto JSON { "periodCode", "title", "scenes":[...] }. Sin markdown, sin comentarios.`;
}

export function buildComposeUser(args: { topic: string; evidenceText: string; durationSec: number }): string {
  return `TEMA: ${args.topic}

DURACIÓN OBJETIVO: ${args.durationSec}s  →  apunta a ${sceneHint(args.durationSec)}.

EVIDENCIA (única fuente de hechos; cítala mentalmente, nunca en pantalla):
${args.evidenceText}

${EXAMPLE}

Escribe el guion del video para el TEMA, anclando cada hecho en la EVIDENCIA. Devuelve solo el JSON.`;
}

export function buildVerifySystem(): string {
  return `Eres un verificador escéptico. Recibes la EVIDENCIA y un guion de video (escenas JSON). Tu trabajo: corregir SOLO los hechos que la evidencia no respalde —cifras, fechas, nombres propios—. Ajusta al valor respaldado, o generaliza (quita el número/fecha) si no hay respaldo. NO agregues ni quites escenas, NO cambies el estilo ni los marcadores (*_), NO reescribas lo que ya está bien.

Devuelve el MISMO objeto { "periodCode", "title", "scenes":[...] } con las correcciones aplicadas. Solo JSON.`;
}

export function buildVerifyUser(args: { draftJson: string; evidenceText: string }): string {
  return `EVIDENCIA:
${args.evidenceText}

GUION A VERIFICAR:
${args.draftJson}

Devuelve el JSON corregido (mismo formato). Solo JSON.`;
}
