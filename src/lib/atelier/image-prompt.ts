/**
 * Prompt visual del estilo de la casa — CERRADO en el laboratorio de 4 rondas
 * (2026-07-02) con el editor:
 *
 *   - Base: fotografía B/N con textura de gelatina de plata.
 *   - Tinta de grabador al 35% ("sombras y bordes"): la foto domina, el rayado
 *     vive solo en sombras profundas y contornos.
 *   - UN acento de color con significado (rojo/amarillo/azul) sobre UN elemento
 *     que subraya el momento histórico. Sin fugas a objetos vecinos.
 *   - Encuadre elegido por el director de arte (rotan libremente; Persona = retrato).
 *   - Referencias reales adjuntas vía images/edits (≥5) como ancla documental.
 *
 * Aspecto: 16:9 (1536x1024) para hecho/época/pregunta/ensayo; 9:16 (1024x1536)
 * para entidad Persona.
 */
import type { ImageSize } from "../openai-image";
import type { StructuredData } from "../typology-schemas";
import { periodInfo } from "../design-tokens";
import { ACCENT_COLOR_EN, type ArtDirection, type EncuadreId } from "./art-director";

// ── Estilo cerrado ───────────────────────────────────────────────────

/** Parada 35% del dial fotografía↔tinta (Ronda 3 del laboratorio). */
const STYLE_35 =
  "A black-and-white editorial photograph with the texture of a silver-gelatin print — documentary realism, high contrast, fine film grain — overlaid with subtle touches of pen-and-ink illustration: delicate parallel hatching and cross-hatching woven into the shadows and along the edges of forms, as if an engraver discreetly retouched the photograph. The photograph clearly dominates; the ink is an undertone.";

const COMMON =
  "Restrained, archival, museum-quality. Absolutely NO text, letters, captions, numbers, logos, watermarks, frames or borders. No modern objects or anachronisms. Historically faithful to the period and to Colombia / Latin America.";

function accentClause(d: ArtDirection): string {
  const colorEn = ACCENT_COLOR_EN[d.accentColor];
  return (
    `Plus ONE restrained accent of ${colorEn} spot ink, applied like a lithographer's second plate ONLY on ${d.accentTarget}; ` +
    `every other element of the image stays strictly monochrome. The accent must NOT bleed onto neighboring objects — ` +
    `similar items nearby (other ceramics, textiles, flames, flags) stay black-and-white. Render the accented element with ` +
    `historical precision; do not invent emblems, patterns or variants.`
  );
}

function negativeClause(d: ArtDirection): string {
  const colorEn = ACCENT_COLOR_EN[d.accentColor];
  return `Avoid: any color other than the single ${colorEn} accent, rainbow palettes, cartoon, 3D render, glossy digital art, text, signatures, modern clothing.`;
}

/** Cláusula de referencias: se añade SOLO cuando van imágenes adjuntas (edits). */
export const REFERENCE_CLAUSE =
  "The attached images are authentic references: period photographs, paintings, museum artifacts and real places related to this subject. Use them ONLY as documentary grounding for faces, costumes, artifacts, architecture, landscape and atmosphere. Do NOT copy any reference literally, do NOT reproduce their captions, lettering or painterly style; compose an entirely NEW photographic scene.";

// ── Encuadres (Ronda 4: rotan libremente según la escena) ────────────

const ENCUADRE_EN: Record<EncuadreId, string> = {
  "plano-general":
    "EXTREME WIDE ESTABLISHING SHOT: the whole scene and its setting, the key action as a focal point in the middle distance, landscape or architecture closing the frame.",
  "plano-medio":
    "MEDIUM SHOT at the heart of the action: the protagonists at body distance, gestures caught mid-motion, onlookers pressing at the edges of the frame, faces lit by period light.",
  detalle:
    "CLOSE-UP documentary still-life: the single object or gesture that condenses the moment fills the frame; hands, textures and ground-level period details around it, shallow depth.",
  contrapicado:
    "DRAMATIC LOW-ANGLE SHOT from the ground: figures and architecture towering against the sky, the scene's key element placed with weight in the frame.",
  cenital:
    "HIGH-ANGLE SHOT from directly above: the crowd or the terrain reads as a living pattern, converging on the scene's key element near the center, long shadows on the ground.",
  interior:
    "INTIMATE INTERIOR SHOT inside the room where it happens: window light raking across period furnishings and surfaces, the protagonists caught mid-scene.",
  retrato:
    "DIGNIFIED VERTICAL PORTRAIT: three-quarter view, solemn and contemplative, dramatic side light, period-accurate dress, the sitter's world softly out of focus behind.",
};

// ── Sujeto por tipología ─────────────────────────────────────────────

function periodLabel(code: string | null): string {
  if (!code) return "";
  return periodInfo(code)?.label ?? "";
}

/** Tamaño según tipología: retrato solo para personas. */
export function aspectForStructured(s: StructuredData | null): ImageSize {
  if (s && s.typology === "entidad" && s.tipo === "Persona") return "1024x1536";
  return "1536x1024";
}

/** Sujeto visual por tipología (la escena base, sin estilo). */
export function subjectFor(s: StructuredData): string {
  const per = periodLabel(s.periodoCode);
  const perStr = per ? ` Set in the period of ${per} in Colombian history.` : "";
  switch (s.typology) {
    case "hecho": {
      const donde = s.lugares.slice(0, 2).join(", ");
      const quien = s.protagonistas.slice(0, 2).join(", ");
      return `A dramatic documentary scene depicting the historical event "${s.titulo}". ${s.resumen} ${
        donde ? `Location: ${donde}.` : ""
      } ${quien ? `Key figures involved: ${quien}.` : ""} ${s.fecha ? `Time: ${s.fecha}.` : ""}${perStr} A single powerful, atmospheric composition, no montage.`;
    }
    case "entidad": {
      if (s.tipo === "Persona") {
        const roles = s.roles.slice(0, 2).join(", ");
        return `A dignified vertical portrait of ${s.titulo}, ${roles || "a historical figure"} of Colombian history. Period-accurate dress and setting.${perStr}`;
      }
      return `An evocative view representing "${s.titulo}" (${s.tipo}). ${s.resumen}${perStr} A single powerful, atmospheric composition, no montage.`;
    }
    case "epoca":
      return `An evocative scene that captures the spirit of the historical period "${s.titulo}". ${s.panorama || s.resumen} ${
        s.rango ? `Years: ${s.rango}.` : ""
      } Everyday and public life of the era, conveying its mood. A single powerful, atmospheric composition, no montage.`;
    case "pregunta":
      return `A symbolic, conceptual documentary composition that evokes the historical question "${s.titulo}". ${s.resumen}${perStr} Suggestive and atmospheric rather than literal. A single powerful composition, no montage.`;
  }
}

/** Sujeto de respaldo para una pieza sin ficha (ensayo). */
export function essaySubject(title: string, excerpt: string): string {
  return `An evocative documentary composition inspired by a historical essay titled "${title}". ${excerpt.slice(0, 400)} A single atmospheric scene about Colombian / Latin American history, no montage.`;
}

/**
 * Extracto en prosa de la pieza para anclar la imagen cuando FALTAN referencias
 * visuales: el texto generado compensa parte de lo que darían las fotos/pinturas.
 * Sin markdown ni marcadores, recortado a un límite de frase.
 */
export function pieceContextExcerpt(answer: string | null | undefined, max = 700): string {
  if (!answer) return "";
  const clean = answer
    .replace(/```[\s\S]*?```/g, " ") // bloques de código
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // imágenes markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // enlaces → su texto
    .replace(/\[[#^]?\d+\]/g, " ") // citas/notas al pie [1] [^1] [#1]
    .replace(/[#>*_`~|]/g, " ") // marcas de markdown
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return `${(stop > max * 0.5 ? cut.slice(0, stop + 1) : cut).trim()} …`;
}

// ── Prompt final ─────────────────────────────────────────────────────

export interface StyledPromptArgs {
  /** Escena base (subjectFor / essaySubject). */
  subject: string;
  direction: ArtDirection;
  /** true cuando van referencias adjuntas (images/edits). */
  withReferences: boolean;
  /** Prosa de la pieza (ES) inyectada como contexto factual cuando faltan
   * referencias visuales: ancla el generador en el texto, no en imágenes. */
  contextText?: string;
}

/** Compone el prompt completo: sujeto + contexto + encuadre + referencias + estilo. */
export function buildStyledPrompt(args: StyledPromptArgs): string {
  const d = args.direction;
  const escena = d.escena ? ` ${d.escena}` : "";
  const context = args.contextText?.trim();
  const parts = [
    `${args.subject}${escena}`,
    ...(context
      ? [
          `HISTORICAL CONTEXT (Spanish — use ONLY to get the scene, figures, clothing, objects, architecture and setting historically right; do NOT render any of this text, letters or words in the image): ${context}`,
        ]
      : []),
    `COMPOSITION: ${ENCUADRE_EN[d.encuadre]}`,
    ...(args.withReferences ? [REFERENCE_CLAUSE] : []),
    `STYLE: ${STYLE_35} ${accentClause(d)}`,
    `${negativeClause(d)}\n${COMMON}`,
  ];
  return parts.join("\n\n");
}
