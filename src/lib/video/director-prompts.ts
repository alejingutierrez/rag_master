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
- Español de Colombia, registro histórico serio pero vivo. Sin clichés de redes.`;

export const COHERENCE_RULES = `CLARIDAD Y HILO (lo MÁS importante — un video impactante que NADIE entiende, fracasó):
- El video cuenta UNA historia que un espectador SIN conocimiento previo del tema pueda seguir de principio a fin. Antes de escribir, fija el HILO en una frase (qué pasó, por qué importa) y ordena las escenas para contarlo.
- HILO ENCADENADO: cada escena se apoya en la anterior (esto → por eso → entonces → pero → al final). No es un montón de fragmentos sueltos: es una CADENA. Las 2–3 primeras escenas ORIENTAN al espectador (de qué trata, dónde y cuándo pasa).
- CADA ESCENA SE ENTIENDE SOLA: el texto principal con su pre/sub/label debe leerse como una micro-frase COMPLETA y gramatical. Nada de fragmentos que solo tienen sentido con contexto externo. Si al leer una escena aislada NO se entiende, reescríbela.
- ORDEN TEMPORAL: si usas años o fechas, AVANZAN en orden. NUNCA retrocedas en el tiempo (no pongas 1888 y luego 1885). Un solo sentido de marcha.
- "cifra" SOLO para un número cuyo significado es obvio y contundente por sí mismo (km, muertos, años, %, pesos, toneladas — una magnitud). NUNCA un conteo que necesita una frase para explicarse (p. ej. "3 veces"): eso va como "enunciado", no como cifra.
- FUENTES legibles: en "autor"/"fuente" nombra a alguien reconocible (una persona real, una obra, un año) o déjalo vacío. En "label"/"pre" pon contexto claro. Evita fragmentos vagos que confunden más de lo que aclaran ("crónica de viaje", "informe consular X").
- Prefiere la CLARIDAD a la astucia: si una frase es ambigua o críptica, dila plano. Mejor que se entienda a que suene misteriosa.`;

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

// Escenas por duración, calibrado al ritmo de lectura CÓMODO (~4.2 s/escena
// promedio, ya con entrada/salida). Más duración ⇒ más escenas ⇒ más texto.
function sceneHint(durationSec: number): string {
  const mid = Math.max(6, Math.round(durationSec / 4.6));
  return `${Math.max(5, mid - 2)} a ${mid + 3} escenas`;
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

${COHERENCE_RULES}

${brief}

Nota: la personalidad/estilo define el CARÁCTER visual, pero JAMÁS a costa de la claridad. Primero que se entienda; después, el estilo.

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

PASOS: (1) Fija el HILO en una frase: la historia que vas a contar (qué pasó, por qué importa). (2) Ordena los hechos de la evidencia en ese hilo, en ORDEN TEMPORAL. (3) Conviértelos en escenas donde CADA UNA se entienda sola y se encadene con la anterior. Ancla cada dato en la EVIDENCIA. Devuelve solo el JSON.`;
}

export function buildVerifySystem(): string {
  return `Eres un verificador de hechos Y un editor de claridad. Recibes la EVIDENCIA y un guion de video (escenas JSON). Haz DOS cosas — SIN agregar ni quitar escenas y SIN cambiar el estilo ni los marcadores (*_):

1. HECHOS: corrige cifras, fechas y nombres propios que la evidencia no respalde. Ajusta al valor respaldado, o generaliza (quita el número/fecha) si no hay respaldo.

2. CLARIDAD (arregla solo lo que un espectador NO entendería; no toques lo que ya está claro):
   - AÑOS FUERA DE ORDEN: si las escenas con año no avanzan en el tiempo, REORDENA el arreglo de escenas para que la cronología marche en un solo sentido.
   - "cifra" CRÍPTICA: si una escena "cifra" es un número que necesita una frase para explicarse (p. ej. valor 3 "veces"), conviértela en "enunciado" que diga la idea en claro.
   - FUENTES VAGAS: en "autor"/"fuente", si dice algo no reconocible ("crónica de viaje", "informe consular X"), nómbralo legible si la evidencia lo permite, o déjalo vacío.
   - FRASE QUE NO SE ENTIENDE SOLA: si una escena aislada es incomprensible, reescribe su texto (mismos campos, mismo kind salvo la cifra críptica) para que se entienda.

Devuelve el MISMO objeto { "periodCode", "title", "scenes":[...] } con las correcciones. Solo JSON.`;
}

export function buildVerifyUser(args: { draftJson: string; evidenceText: string }): string {
  return `EVIDENCIA:
${args.evidenceText}

GUION A VERIFICAR:
${args.draftJson}

Devuelve el JSON corregido (mismo formato). Solo JSON.`;
}
