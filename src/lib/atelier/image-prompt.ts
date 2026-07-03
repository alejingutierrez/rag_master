/**
 * Construye el prompt visual para gpt-image a partir de la ficha de tipología.
 *
 * Estilo fijo (decidido por el editor): FOTOGRAFÍA en blanco y negro con toques
 * de ILUSTRACIÓN de tinta a rayas (hatching / cross-hatching). Documental,
 * archivístico, sin texto. Aspecto: 16:9 para hecho/época/pregunta/ensayo;
 * 9:16 (retrato) para entidad Persona.
 */
import type { ImageSize } from "../openai-image";
import type { StructuredData } from "../typology-schemas";
import { periodInfo } from "../design-tokens";

const STYLE =
  "Black-and-white editorial photograph with the texture of a silver-gelatin print — documentary realism, high contrast, fine film grain — overlaid with subtle touches of pen-and-ink illustration: delicate parallel hatching and cross-hatching lines woven into the shadows and edges, as if an engraver retouched the photograph. Restrained, archival, museum-quality. Absolutely NO text, letters, captions, numbers, logos, watermarks, frames or borders. No modern objects or anachronisms. Historically faithful to the period and to Colombia / Latin America.";

const NEGATIVE = "Avoid: color, cartoon, 3D render, glossy digital art, text, signatures, modern clothing.";

function periodLabel(code: string | null): string {
  if (!code) return "";
  return periodInfo(code)?.label ?? "";
}

/** Tamaño según tipología: retrato solo para personas. */
export function aspectForStructured(s: StructuredData | null): ImageSize {
  if (s && s.typology === "entidad" && s.tipo === "Persona") return "1024x1536";
  return "1536x1024";
}

/** Sujeto visual por tipología. */
function subjectFor(s: StructuredData): string {
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
        return `A dignified vertical portrait of ${s.titulo}, ${roles || "a historical figure"} of Colombian history. Period-accurate dress and setting.${perStr} Solemn, contemplative, three-quarter view, dramatic side light.`;
      }
      return `An evocative view representing "${s.titulo}" (${s.tipo}). ${s.resumen}${perStr}`;
    }
    case "epoca":
      return `An evocative wide establishing scene that captures the spirit of the historical period "${s.titulo}". ${s.panorama || s.resumen} ${
        s.rango ? `Years: ${s.rango}.` : ""
      } A landscape or urban vista with figures, conveying the mood of the era.`;
    case "pregunta":
      return `A symbolic, conceptual documentary composition that evokes the historical question "${s.titulo}". ${s.resumen}${perStr} Suggestive and atmospheric rather than literal.`;
  }
}

/** Prompt completo para gpt-image. */
export function buildImagePrompt(s: StructuredData): string {
  return `${subjectFor(s)}\n\nSTYLE: ${STYLE}\n${NEGATIVE}`;
}

/** Prompt de respaldo para una pieza sin ficha (ensayo): usa título + intención. */
export function buildEssayImagePrompt(title: string, excerpt: string): { prompt: string; size: ImageSize } {
  const subject = `An evocative black-and-white documentary composition inspired by a historical essay titled "${title}". ${excerpt.slice(0, 400)} A single atmospheric scene about Colombian / Latin American history.`;
  return { prompt: `${subject}\n\nSTYLE: ${STYLE}\n${NEGATIVE}`, size: "1536x1024" };
}
