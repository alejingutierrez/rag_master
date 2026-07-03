/**
 * Compositor de SEO del Taller: una llamada Sonnet barata que redacta el meta
 * title, la meta description (con gancho, ≤155c) y las keywords de la pieza.
 *
 * Nunca degrada: si la llamada falla o devuelve algo pobre, cae al SEO
 * determinista (`deriveSeo`) construido desde el título, el resumen/answer y la
 * taxonomía analítica. Patrón calcado de `deliverable-classifier.ts`.
 */
import { callClaudeJson, SONNET_MODEL } from "./bedrock-json";
import { deriveSeo, normalizeSeo, type DeliverableSeo } from "../seo";
import type { DeliverableTaxonomy } from "../taxonomy";
import type { TypologyKind } from "../typology-schemas";

const SEO_SYSTEM = `Eres editor SEO de un sitio de historia de Colombia y América Latina. Lees una pieza ya escrita y produces sus metadatos de búsqueda: precisos, sobrios y factuales (nada de clickbait ni superlativos).

Devuelve JSON puro (sin markdown):
{
  "metaTitle": "≤60 caracteres. El nombre/tema de la pieza al frente. SIN el nombre del sitio.",
  "metaDescription": "120–155 caracteres. Una frase con gancho que resume qué encontrará el lector e incluye el término principal de forma natural.",
  "keywords": ["6–10 términos", "nombres propios", "período", "lugar", "concepto/tema"]
}

Reglas:
- Español de Colombia. Ortografía y tildes correctas.
- metaTitle ≤60c y metaDescription ≤155c (cuéntalos). No cierres con puntuación colgante.
- keywords: nombres propios y temas REALES de la pieza (no inventes), en minúscula salvo nombres propios.
- NO escribas nada fuera del JSON.`;

function hints(tax?: DeliverableTaxonomy): string {
  if (!tax) return "";
  const ents = [...(tax.entidadesPersonas ?? []), ...(tax.entidadesLugares ?? []), ...(tax.entidadesConceptos ?? [])];
  const parts = [
    tax.periodoNombre && `período: ${tax.periodoNombre}`,
    tax.categoriaNombre && `categoría: ${tax.categoriaNombre}`,
    ents.length && `entidades: ${ents.slice(0, 12).join(", ")}`,
    tax.clusterTematico && `tema: ${tax.clusterTematico}`,
  ].filter(Boolean);
  return parts.length ? `\n\nPISTAS (taxonomía): ${parts.join(" · ")}` : "";
}

export async function composeSeo(args: {
  titulo: string;
  resumen?: string | null;
  answer: string;
  typology?: TypologyKind | null;
  taxonomy?: DeliverableTaxonomy;
}): Promise<DeliverableSeo> {
  const fallback = deriveSeo({
    titulo: args.titulo,
    resumen: args.resumen,
    answer: args.answer,
    taxonomy: args.taxonomy,
  });

  try {
    const user = `${args.typology ? `TIPO: ${args.typology}\n` : ""}TÍTULO: ${args.titulo}${
      args.resumen ? `\nRESUMEN: ${args.resumen}` : ""
    }\n\nPIEZA (extracto):\n${args.answer.slice(0, 1800)}${hints(args.taxonomy)}\n\nJSON:`;

    const raw = await callClaudeJson<Record<string, unknown>>({
      model: SONNET_MODEL,
      system: SEO_SYSTEM,
      user,
      maxTokens: 700,
      validate: (p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}),
    });

    const seo = normalizeSeo({
      metaTitle: raw.metaTitle,
      metaDescription: raw.metaDescription,
      keywords: raw.keywords,
    });
    if (!seo) return fallback;
    // Piso de calidad: si el modelo dio pocas keywords, completa con las derivadas.
    if (seo.keywords.length < 3) seo.keywords = fallback.keywords;
    return seo;
  } catch (e) {
    console.warn(`[atelier] composeSeo falló, uso fallback determinista: ${(e as Error).message}`);
    return fallback;
  }
}
