/**
 * Director de arte: decide, POR PIEZA, cómo se aplica el estilo de la casa.
 *
 * El estilo está cerrado (laboratorio de 4 rondas, 2026-07-02): fotografía
 * plata B/N + tinta de grabador al 35% + UN solo acento de color con
 * significado. Lo que varía por pieza — y decide este módulo — es:
 *
 *   - accentColor: rojo | amarillo | azul (el tricolor con semántica histórica:
 *     rojo = fuego/sangre política/banderas; amarillo = oro/riqueza/luz;
 *     azul = mar/ríos/uniformes navales/loza).
 *   - accentTarget: el elemento CONCRETO que recibe la tinta — el que subraya
 *     el momento de la historia (las banderas del mitin, el oro de la balsa,
 *     el florero de Llorente).
 *   - encuadre: la composición. Rotan libremente según lo que la escena pida
 *     (decisión editorial); Persona siempre en retrato vertical.
 *
 * Una llamada Sonnet. Si falla, hay una dirección de respaldo neutra para que
 * la imagen nunca se quede sin generar por culpa de este paso.
 */
import { callClaudeJson, SONNET_MODEL } from "./bedrock-json";
import type { StructuredData } from "../typology-schemas";

export type AccentColor = "rojo" | "amarillo" | "azul";
export type EncuadreId =
  | "plano-general"
  | "plano-medio"
  | "detalle"
  | "contrapicado"
  | "cenital"
  | "interior"
  | "retrato";

export interface ArtDirection {
  accentColor: AccentColor;
  /** El elemento acentuado, en inglés preciso para el generador. */
  accentTarget: string;
  /** El mismo elemento en español, para la UI de Producciones. */
  accentTargetEs: string;
  encuadre: EncuadreId;
  /** Una línea sobre por qué ese color/objetivo (UI). */
  razon: string;
  /** Enriquecimiento opcional de la escena (detalles visuales concretos, EN). */
  escena?: string;
}

export const ACCENT_COLOR_EN: Record<AccentColor, string> = {
  rojo: "deep crimson-red",
  amarillo: "luminous gold-yellow",
  azul: "deep cobalt-blue",
};

export const ENCUADRE_LABEL: Record<EncuadreId, string> = {
  "plano-general": "Plano general",
  "plano-medio": "Plano medio",
  detalle: "Detalle",
  contrapicado: "Contrapicado",
  cenital: "Cenital",
  interior: "Interior",
  retrato: "Retrato",
};

const VALID_COLORS: readonly AccentColor[] = ["rojo", "amarillo", "azul"];
const VALID_ENCUADRES: readonly EncuadreId[] = [
  "plano-general",
  "plano-medio",
  "detalle",
  "contrapicado",
  "cenital",
  "interior",
  "retrato",
];

const SYSTEM = `Eres el director de arte de una publicación de historia de Colombia. El estilo de la casa está cerrado: fotografía blanco y negro (gelatina de plata) con tinta de grabador sutil, y UN SOLO acento de color con significado histórico. Tu trabajo: decidir ese acento y el encuadre para UNA pieza.

EL ACENTO (la decisión más importante):
- Elige UN color — "rojo", "amarillo" o "azul" — y UN elemento concreto de la escena que lo recibe.
- El color debe SIGNIFICAR algo en esa historia: rojo = fuego, sangre política, banderas liberales, pasión insurrecta; amarillo = oro, riqueza, cosecha, luz ritual; azul = mar, ríos, uniformes navales, loza colonial, cielo ceremonial.
- El elemento debe ser HISTÓRICAMENTE PRECISO y VISUALMENTE ACOTADO (unas banderas, un florero, los granos de oro en la batea, el paño de un uniforme — no "toda la escena").
- Descríbelo con precisión material para que el ilustrador no invente: si son banderas liberales, di "plain solid red liberal party flags, no emblems"; si es loza, di su decoración real.

EL ENCUADRE (elige el que más potencia ESTA escena; rotan libremente entre piezas):
- "plano-general": la escena entera y su lugar (plazas, batallas, paisajes con multitud).
- "plano-medio": la acción entre personas, a distancia de cuerpo (forcejeos, encuentros, oficios).
- "detalle": un objeto o gesto a primer plano que condensa el momento (bodegón documental).
- "contrapicado": desde abajo, monumental (balcones, puños en alto, arquitectura que pesa).
- "cenital": desde arriba, el patrón de la multitud o del territorio.
- "interior": dentro del recinto donde ocurre (tiendas, despachos, templos; luz de ventana).
- "retrato": SOLO para piezas cuyo sujeto es UNA PERSONA (vertical, tres cuartos, luz lateral).

Si el sujeto es una PERSONA (semblanza/biografía): encuadre "retrato" SIEMPRE, y el acento va en una prenda u objeto documentado de esa persona.

Además puedes dar "escena": 1-2 frases EN INGLÉS con detalles visuales concretos y verificables que enriquezcan la composición (objetos, luz, hora, gestos de época). Nada inventado contra la historia.

Devuelve JSON puro:
{"accentColor":"rojo|amarillo|azul","accentTarget":"in precise English","accentTargetEs":"en español","encuadre":"...","razon":"1 frase en español","escena":"optional English enrichment"}`;

export interface ArtDirectorArgs {
  titulo: string;
  resumen: string;
  typology?: string;
  /** "Persona" | "Lugar" | "Concepto" | "Institución" cuando la pieza es entidad. */
  tipoEntidad?: string;
  periodoLabel?: string;
  /** La escena base que verá el generador (subjectFor), para decidir sobre ella. */
  subjectText: string;
}

export function artDirectorArgsFromStructured(
  s: StructuredData,
  subjectText: string,
  periodoLabel?: string
): ArtDirectorArgs {
  return {
    titulo: s.titulo,
    resumen: s.resumen,
    typology: s.typology,
    tipoEntidad: s.typology === "entidad" ? s.tipo : undefined,
    periodoLabel,
    subjectText,
  };
}

/** Dirección neutra si el LLM falla: monocromo con acento discreto de época. */
export function fallbackDirection(args: { esPersona: boolean }): ArtDirection {
  return {
    accentColor: "rojo",
    accentTarget: "one single small period-accurate red detail chosen by the scene (a ribbon, a sash, an ember)",
    accentTargetEs: "un solo detalle rojo de época (cinta, faja o brasa)",
    encuadre: args.esPersona ? "retrato" : "plano-medio",
    razon: "Dirección de respaldo: acento mínimo de época (el director de arte no respondió).",
  };
}

export async function directArt(args: ArtDirectorArgs): Promise<ArtDirection> {
  const esPersona = (args.tipoEntidad ?? "").toLowerCase().startsWith("persona");
  const user = [
    `PIEZA: ${args.titulo}`,
    args.resumen ? `RESUMEN: ${args.resumen}` : "",
    args.typology ? `TIPOLOGÍA: ${args.typology}${args.tipoEntidad ? ` · ${args.tipoEntidad}` : ""}` : "",
    args.periodoLabel ? `PERÍODO: ${args.periodoLabel}` : "",
    `ESCENA BASE DEL GENERADOR:\n${args.subjectText}`,
    "",
    "JSON:",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await callClaudeJson<Record<string, unknown>>({
    model: SONNET_MODEL,
    system: SYSTEM,
    user,
    maxTokens: 800,
  });

  const color = VALID_COLORS.find((c) => c === String(raw.accentColor ?? "").toLowerCase());
  let encuadre = VALID_ENCUADRES.find((e) => e === String(raw.encuadre ?? "").toLowerCase());
  const accentTarget = typeof raw.accentTarget === "string" ? raw.accentTarget.trim() : "";
  if (!color || !accentTarget) {
    return fallbackDirection({ esPersona });
  }
  // Persona ⇒ retrato, siempre (formato 9:16 de la tipología).
  if (esPersona) encuadre = "retrato";
  if (!encuadre) encuadre = esPersona ? "retrato" : "plano-medio";

  return {
    accentColor: color,
    accentTarget,
    accentTargetEs:
      typeof raw.accentTargetEs === "string" && raw.accentTargetEs.trim()
        ? raw.accentTargetEs.trim()
        : accentTarget,
    encuadre,
    razon: typeof raw.razon === "string" ? raw.razon.trim() : "",
    escena: typeof raw.escena === "string" && raw.escena.trim() ? raw.escena.trim() : undefined,
  };
}
