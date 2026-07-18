/**
 * Director de arte: decide, POR PIEZA, cómo se aplica el estilo de la casa.
 *
 * El estilo está cerrado (laboratorio de 4 rondas, 2026-07-02): fotografía
 * plata B/N + tinta de grabador al 35% + UN solo acento de color con
 * significado. Lo que varía por pieza — y decide este módulo — es:
 *
 *   - accentColor: una tinta editorial acotada al tricolor colombiano:
 *     rojo, amarillo u azul.
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
import type { ReferenceBrief, SceneMode } from "./scene-plan";

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
  /** Modo de escena documental elegido antes del acento. */
  sceneMode?: SceneMode;
  /** Índice 1-based de la referencia que gobierna la escena. */
  primaryReferenceIndex?: number;
  /** Escena ancla en inglés, para el prompt final. */
  sceneAnchor?: string;
  /** Escena ancla en español, para Producciones. */
  sceneAnchorEs?: string;
  /** Movimiento creativo permitido dentro del ancla documental. */
  creativeMove?: string;
  /** Restricciones históricas que el generador debe respetar. */
  historicalConstraints?: string[];
  /** Ajustes/alertas automáticas aplicadas después de la dirección. */
  warnings?: string[];
}

export const ACCENT_COLOR_EN: Record<AccentColor, string> = {
  rojo: "deep crimson-red",
  amarillo: "muted ochre-gold yellow",
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

const VALID_COLORS = Object.keys(ACCENT_COLOR_EN) as AccentColor[];
const VALID_ENCUADRES: readonly EncuadreId[] = [
  "plano-general",
  "plano-medio",
  "detalle",
  "contrapicado",
  "cenital",
  "interior",
  "retrato",
];

const SYSTEM = `Eres el director de arte de una publicación de historia de Colombia. El estilo de la casa está cerrado: fotografía blanco y negro (gelatina de plata) con tinta de grabador sutil, y UN SOLO acento de color con significado histórico.

Tu trabajo tiene DOS decisiones, en este orden:
1) Elegir la ESCENA DOCUMENTAL PRINCIPAL desde las referencias visuales encontradas.
2) Elegir un acento de color pequeño DENTRO de esa escena.

La creatividad vive en cámara, luz, tensión, composición y punto de vista. NO vive en cambiar el sujeto histórico por una metáfora bonita.

LA ESCENA DOCUMENTAL:
- Si hay TABLERO DE REFERENCIAS, elige una referencia principal (índice 1-based) que gobierne la escena.
- Para ÉPOCAS con referencias de personas, reuniones, plazas, arquitectura o vida pública, la escena principal debe mostrar esa vida pública/personas/lugar. No la reemplaces por un bodegón de escritorio, tintero, vela, mapa o documento aislado.
- El detalle/objeto como protagonista solo es correcto cuando la mejor referencia principal es un objeto, documento, pieza de museo o artefacto material.
- La escena puede ser una composición NUEVA y cinematográfica, pero sus personas, lugar, vestuario, objetos y materialidad deben ser consecuentes con la referencia principal y el momento histórico.
- EDIFICIOS O MONUMENTOS DESTRUIDOS/RECONSTRUIDOS: si el lugar clave del hecho fue incendiado, demolido o reconstruido DESPUÉS del evento (caso típico: el Palacio de Justicia de Bogotá, arrasado en 1985 y reemplazado por el edificio actual inaugurado en 2004 —la fachada de columnas que se ve hoy NO existía en 1985), describe en "sceneAnchor" y "historicalConstraints" la estructura TAL COMO ERA EN LA FECHA DEL HECHO, no la de hoy. Las referencias fotográficas de archivo abierto casi siempre muestran la RECONSTRUCCIÓN moderna: adviértelo de forma explícita —"la fachada actual/reconstruida no debe reproducirse; la referencia del lugar sirve para ubicación, escala y entorno (la plaza, la ciudad, la luz andina), no para copiar el edificio"—. Si conoces el aspecto histórico (materiales, volumen, número de pisos, estilo —el Palacio de 1985 era un bloque modernista horizontal de hormigón, no una columnata neoclásica), decláralo con precisión y sobriedad; si no, mantente en lo verificable y no inventes un estilo.

EL ACENTO (la decisión más importante):
- Elige UN color — "rojo", "amarillo" o "azul" — y UN elemento concreto de la escena que lo recibe. La paleta se mantiene en la bandera colombiana; la variedad viene del elemento, la escena y el encuadre.
- El color debe SIGNIFICAR algo en esa historia, pero NO repitas los mismos objetos por reflejo. Paleta semántica ampliada dentro del tricolor:
  rojo = violencia política, fuego, sangre, cera/sellos, tela partidista, imprenta incendiaria, brasas, pañuelos, flores rituales;
  amarillo = oro SOLO si el tema lo exige; también luz de vela, papel envejecido, maíz/cosecha, polvo del camino, muro encalado cálido, lámpara de aceite;
  azul = mar, ríos, indigo en textiles, porcelana/loza, sombra del cielo, vidrio antiguo, tinta/lavado de mapa SIN letras.
- No uses oro, banderas ni uniformes como salida automática. Úsalos SOLO si la pieza depende literalmente de oro, banderas o uniformes.
- Antes de elegir color, mira la ESCENA DOCUMENTAL PRINCIPAL. Prefiere un detalle material verificable DENTRO de esa escena sobre símbolos obvios.
- Si recibes ACENTOS RECIENTES A EVITAR, NO repitas esos objetos/materiales. En una serie editorial (p. ej. varias épocas), la variedad de escena y objetivo pesa tanto como la precisión histórica.
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

Si el sujeto es una PERSONA (semblanza/biografía): encuadre "retrato" SIEMPRE. Si hay referentes, el acento debe salir de lo que se conoce públicamente de esa persona (retratos, prendas, objetos, espacio público asociado), no de un accesorio genérico.

Además debes dar:
- "sceneMode": public-scene|portrait|real-place|artifact-detail|conceptual-documentary|atmosphere.
- "primaryReferenceIndex": índice 1-based de la referencia principal si existe.
- "sceneAnchor": 1 frase EN INGLÉS que diga qué escena documental gobierna la imagen.
- "sceneAnchorEs": la misma idea en español para auditoría editorial.
- "creativeMove": 1 frase EN INGLÉS sobre cámara/luz/composición; creativo pero fiel a la escena.
- "historicalConstraints": 2-4 restricciones concretas.
- "escena": 1-2 frases EN INGLÉS con detalles visuales concretos y verificables que enriquezcan la composición. Nada inventado contra la historia.

Devuelve JSON puro:
{"sceneMode":"...","primaryReferenceIndex":1,"sceneAnchor":"in English","sceneAnchorEs":"en español","creativeMove":"in English","historicalConstraints":["..."],"accentColor":"rojo|amarillo|azul","accentTarget":"in precise English","accentTargetEs":"en español","encuadre":"...","razon":"1 frase en español","escena":"optional English enrichment"}`;

export interface ArtDirectorArgs {
  titulo: string;
  resumen: string;
  typology?: string;
  /** "Persona" | "Lugar" | "Concepto" | "Institución" cuando la pieza es entidad. */
  tipoEntidad?: string;
  periodoLabel?: string;
  /** La escena base que verá el generador (subjectFor), para decidir sobre ella. */
  subjectText: string;
  /** Títulos/fuentes de referencias visuales ya encontradas. Ayudan a escoger un acento menos genérico. */
  referenceHints?: string[];
  /** Referencias clasificadas por su rol visual. La escena se elige desde aquí. */
  referenceBriefs?: ReferenceBrief[];
  /** Objetivos de acento usados recientemente en piezas hermanas; deben evitarse para no repetir la serie. */
  avoidAccentTargets?: string[];
}

export function artDirectorArgsFromStructured(
  s: StructuredData,
  subjectText: string,
  periodoLabel?: string,
  referenceHints?: string[],
  referenceBriefs?: ReferenceBrief[],
  avoidAccentTargets?: string[]
): ArtDirectorArgs {
  return {
    titulo: s.titulo,
    resumen: s.resumen,
    typology: s.typology,
    tipoEntidad: s.typology === "entidad" ? s.tipo : undefined,
    periodoLabel,
    subjectText,
    referenceHints,
    referenceBriefs,
    avoidAccentTargets,
  };
}

/** Dirección neutra si el LLM falla: monocromo con acento discreto de época. */
export function fallbackDirection(args: { esPersona: boolean }): ArtDirection {
  return {
    accentColor: args.esPersona ? "amarillo" : "azul",
    accentTarget: args.esPersona
      ? "one small ochre-yellow archival object associated with the sitter, such as the warm edge of a worn document folder"
      : "one single deep blue period-accurate material detail chosen by the scene, such as indigo cloth, river water or ceramic glaze",
    accentTargetEs: args.esPersona
      ? "un pequeño objeto amarillo ocre asociado al retratado (borde cálido de una carpeta de documentos)"
      : "un solo detalle azul de época (textil índigo, agua de río o esmalte cerámico)",
    encuadre: args.esPersona ? "retrato" : "plano-medio",
    razon: "Dirección de respaldo: acento mínimo de época (el director de arte no respondió).",
  };
}

function normalizeAccentColor(value: unknown): AccentColor | null {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if ((VALID_COLORS as readonly string[]).includes(s)) return s as AccentColor;
  if (["dorado", "oro", "ocre", "yellow", "gold"].includes(s)) return "amarillo";
  if (["indigo", "índigo", "turquesa", "turquoise", "aguamarina"].includes(s)) return "azul";
  if (["carmesi", "carmesí", "crimson", "granate"].includes(s)) return "rojo";
  return null;
}

function normalizeSceneMode(value: unknown): SceneMode | undefined {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if (
    s === "public-scene" ||
    s === "portrait" ||
    s === "real-place" ||
    s === "artifact-detail" ||
    s === "conceptual-documentary" ||
    s === "atmosphere"
  ) {
    return s;
  }
  return undefined;
}

function stringList(value: unknown, max = 4): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .slice(0, max);
}

export async function directArt(args: ArtDirectorArgs): Promise<ArtDirection> {
  const esPersona = (args.tipoEntidad ?? "").toLowerCase().startsWith("persona");
  const user = buildArtDirectorUserPrompt(args);

  const raw = await callClaudeJson<Record<string, unknown>>({
    model: SONNET_MODEL,
    system: SYSTEM,
    user,
    maxTokens: 800,
  });

  const color = normalizeAccentColor(raw.accentColor);
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
    sceneMode: normalizeSceneMode(raw.sceneMode),
    primaryReferenceIndex:
      typeof raw.primaryReferenceIndex === "number" && Number.isFinite(raw.primaryReferenceIndex)
        ? Math.trunc(raw.primaryReferenceIndex)
        : undefined,
    sceneAnchor: typeof raw.sceneAnchor === "string" && raw.sceneAnchor.trim() ? raw.sceneAnchor.trim() : undefined,
    sceneAnchorEs:
      typeof raw.sceneAnchorEs === "string" && raw.sceneAnchorEs.trim() ? raw.sceneAnchorEs.trim() : undefined,
    creativeMove:
      typeof raw.creativeMove === "string" && raw.creativeMove.trim() ? raw.creativeMove.trim() : undefined,
    historicalConstraints: stringList(raw.historicalConstraints),
  };
}

export function buildArtDirectorUserPrompt(args: ArtDirectorArgs): string {
  const board = args.referenceBriefs?.length
    ? `TABLERO DE REFERENCIAS CLASIFICADAS (elige primero la escena principal desde aquí; no la sustituyas por una metáfora):\n${args.referenceBriefs
        .slice(0, 8)
        .map(
          (r) =>
            `${r.index}. ${r.title} — ${r.provider}, score ${r.score}, rol ${r.role}. Uso editorial: ${r.reason}`
        )
        .join("\n")}`
    : "";
  return [
    `PIEZA: ${args.titulo}`,
    args.resumen ? `RESUMEN: ${args.resumen}` : "",
    args.typology ? `TIPOLOGÍA: ${args.typology}${args.tipoEntidad ? ` · ${args.tipoEntidad}` : ""}` : "",
    args.periodoLabel ? `PERÍODO: ${args.periodoLabel}` : "",
    board,
    args.referenceHints?.length ? `REFERENTES VISUALES ENCONTRADOS:\n${args.referenceHints.slice(0, 8).map((r, i) => `${i + 1}. ${r}`).join("\n")}` : "",
    args.typology === "epoca" && args.referenceBriefs?.some((r) => r.role === "people-scene" || r.role === "place")
      ? "REGLA PARA ESTA ÉPOCA: si hay referencias de personas, reuniones, lugares o vida pública, la escena debe partir de ellas. No la conviertas en tintero, escritorio, mapa, sello, vela o documento aislado salvo que esa sea la referencia principal."
      : "",
    args.avoidAccentTargets?.length
      ? `ACENTOS RECIENTES A EVITAR:\n${args.avoidAccentTargets
          .slice(0, 10)
          .map((r, i) => `${i + 1}. ${r}`)
          .join("\n")}\nElige otro detalle material, otra escena o un encuadre distinto aunque el acento anterior también fuera históricamente plausible.`
      : "",
    `ESCENA BASE DEL GENERADOR:\n${args.subjectText}`,
    "",
    "JSON:",
  ]
    .filter(Boolean)
    .join("\n");
}
