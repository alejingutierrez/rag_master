/**
 * SEO por pieza — fuente de verdad, pura (sin red).
 *
 * `DeliverableSeo` se persiste en `Deliverable.metadata.seo` (lo escribe El Taller
 * vía seo-composer). La capa de lectura (`public-data.getSeo`) lo lee o, si falta,
 * cae a `deriveSeo` (determinista) usando la taxonomía analítica que ya vive en
 * `metadata.atelier.taxonomy`. Así toda pieza publicada queda full-SEO sin escribir
 * en prod ni backfill.
 *
 * Además: `buildMetadata` (objeto `Metadata` de Next) y los constructores de
 * datos estructurados schema.org (`typologyJsonLd`, `articleJsonLd`,
 * `breadcrumbJsonLd`) que consumen las páginas públicas.
 */
import type { Metadata } from "next";
import { AUTHOR, SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE, absUrl } from "./site";
import {
  typologyPath,
  type StructuredData,
  type TypologyKind,
} from "./typology-schemas";
import type { DeliverableTaxonomy } from "./taxonomy";

export interface DeliverableSeo {
  /** Título SEO (≤~60c). El `<title>` = metaTitle + " · Historia Colombiana". */
  metaTitle: string;
  /** Meta description con gancho (≤~155c). También og:description por defecto. */
  metaDescription: string;
  /** 5–10 términos: nombres propios, período, categoría, tema. */
  keywords: string[];
  /** Overrides opcionales de Open Graph (si no, caen a metaTitle/metaDescription). */
  ogTitle?: string;
  ogDescription?: string;
}

// ── Helpers de texto ─────────────────────────────────────────────────

/** Recorta en borde de palabra a `max` chars, sin puntuación colgante ni elipsis. */
function clampText(text: string, max: number): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const i = cut.lastIndexOf(" ");
  const base = i > max * 0.6 ? cut.slice(0, i) : cut;
  return base.replace(/[\s.,;:–—-]+$/u, "").trim();
}

/** Primera frase legible de un markdown (para meta description de ensayos). */
function firstSentence(md: string): string {
  const plain = (md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const m = plain.match(/^(.{40,}?[.!?])(\s|$)/);
  return (m ? m[1] : plain).trim();
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Dedup case-insensitive, descarta vacíos/monosílabos, conserva la 1ª grafía. */
function dedupeKeywords(items: string[], max = 10): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const k = (raw || "").trim();
    if (k.length < 2) continue;
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
    if (out.length >= max) break;
  }
  return out;
}

// ── Derivación / normalización ───────────────────────────────────────

function deriveKeywords(
  tax: Partial<DeliverableTaxonomy> | null | undefined,
  extra: string[] = [],
): string[] {
  const pool: string[] = [];
  if (tax?.periodoNombre) pool.push(tax.periodoNombre);
  if (tax?.categoriaNombre) pool.push(tax.categoriaNombre);
  for (const a of [tax?.entidadesPersonas, tax?.entidadesLugares, tax?.entidadesConceptos]) {
    if (Array.isArray(a)) pool.push(...a);
  }
  if (tax?.clusterTematico) pool.push(tax.clusterTematico);
  pool.push(...extra, "historia de Colombia");
  return dedupeKeywords(pool, 10);
}

/**
 * SEO DETERMINISTA a partir del título, el resumen/answer y la taxonomía. Es el
 * piso de calidad: nunca falla y siempre devuelve algo usable. El compositor con
 * IA sólo lo mejora.
 */
export function deriveSeo(p: {
  titulo: string;
  resumen?: string | null;
  answer?: string | null;
  taxonomy?: Partial<DeliverableTaxonomy> | null;
}): DeliverableSeo {
  const titulo = str(p.titulo) || "Historia de Colombia";
  const metaTitle = clampText(titulo, 60);
  const desc = str(p.resumen) || firstSentence(p.answer || "") || titulo;
  const metaDescription = clampText(desc, 155);
  const keywords = deriveKeywords(p.taxonomy, [titulo]);
  return { metaTitle, metaDescription, keywords };
}

/**
 * Valida/recorta un SEO crudo (de `metadata.seo`, del compositor IA o del editor
 * de Producciones). Devuelve null si no hay al menos título + descripción usables.
 */
export function normalizeSeo(raw: unknown): DeliverableSeo | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const metaTitle = clampText(str(o.metaTitle ?? o.title), 70);
  const metaDescription = clampText(str(o.metaDescription ?? o.description), 160);
  if (!metaTitle || !metaDescription) return null;
  const keywords = dedupeKeywords(
    Array.isArray(o.keywords) ? o.keywords.map((k) => str(k)) : [],
    12,
  );
  const ogTitle = str(o.ogTitle) || undefined;
  const ogDescription = str(o.ogDescription) || undefined;
  return { metaTitle, metaDescription, keywords, ...(ogTitle ? { ogTitle } : {}), ...(ogDescription ? { ogDescription } : {}) };
}

// ── Metadata de Next (por página) ────────────────────────────────────

export interface BuildMetadataArgs {
  seo: DeliverableSeo;
  /** Path canónico relativo, p. ej. "/hechos/el-bogotazo". Resuelto vs metadataBase. */
  path: string;
  imageUrl?: string | null;
  /** ISO. Sólo para type "article". */
  publishedTime?: string | null;
  modifiedTime?: string | null;
  type?: "article" | "website";
}

/**
 * Construye el objeto `Metadata` de una página. El `<title>` sale desnudo: el
 * `title.template` del layout raíz añade " · Historia Colombiana" (NO lo dupliques
 * en las páginas).
 */
export function buildMetadata(a: BuildMetadataArgs): Metadata {
  const type = a.type ?? "article";
  const images = [a.imageUrl || DEFAULT_OG_IMAGE];
  const ogTitle = a.seo.ogTitle || a.seo.metaTitle;
  const ogDescription = a.seo.ogDescription || a.seo.metaDescription;
  const ogBase = {
    title: ogTitle,
    description: ogDescription,
    url: a.path,
    siteName: SITE_NAME,
    locale: "es_CO",
    images,
  };
  // Ramas con `type` literal para que el union discriminado de OpenGraph narre bien.
  const openGraph: NonNullable<Metadata["openGraph"]> =
    type === "article"
      ? {
          ...ogBase,
          type: "article",
          authors: [AUTHOR],
          ...(a.publishedTime ? { publishedTime: a.publishedTime } : {}),
          ...(a.modifiedTime ? { modifiedTime: a.modifiedTime } : {}),
        }
      : { ...ogBase, type: "website" };
  return {
    title: a.seo.metaTitle,
    description: a.seo.metaDescription,
    keywords: a.seo.keywords.length ? a.seo.keywords : undefined,
    alternates: { canonical: a.path },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images,
    },
  };
}

// ── Datos estructurados schema.org (JSON-LD) ─────────────────────────

type JsonLdNode = Record<string, unknown>;

const PUBLISHER: JsonLdNode = { "@type": "Organization", name: SITE_NAME, url: SITE_URL };

/** Envuelve nodos en un grafo con un único @context (un solo <script>). */
export function jsonLdGraph(...nodes: (JsonLdNode | null | undefined)[]): JsonLdNode {
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) as JsonLdNode[] };
}

/** Migas: Inicio → índice de tipología → pieza. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absUrl(it.path),
    })),
  };
}

function authoredBits(ctx: { datePublished?: string | null; dateModified?: string | null }): JsonLdNode {
  return {
    author: { "@type": "Person", name: AUTHOR },
    publisher: PUBLISHER,
    ...(ctx.datePublished ? { datePublished: ctx.datePublished } : {}),
    ...(ctx.dateModified ? { dateModified: ctx.dateModified } : {}),
  };
}

interface DetailCtx {
  path: string;
  imageUrl?: string | null;
  description: string;
  datePublished?: string | null;
  dateModified?: string | null;
}

/** Nodo schema.org de una ficha por tipología (Event / Person·Place·… / QAPage / Article). */
export function typologyJsonLd(s: StructuredData, ctx: DetailCtx): JsonLdNode {
  const url = absUrl(ctx.path);
  const image = ctx.imageUrl ? [absUrl(ctx.imageUrl)] : undefined;
  const common: JsonLdNode = {
    url,
    name: s.titulo,
    description: ctx.description || s.resumen,
    inLanguage: "es",
    ...(image ? { image } : {}),
  };

  switch (s.typology) {
    case "hecho": {
      // Event exige startDate; sin año de inicio cae a Article (evita Event inválido).
      if (s.anioInicio == null) {
        return { "@type": "Article", headline: s.titulo, ...common, ...authoredBits(ctx) };
      }
      return {
        "@type": "Event",
        ...common,
        startDate: String(s.anioInicio),
        ...(s.anioFin != null ? { endDate: String(s.anioFin) } : {}),
        ...(s.lugares[0] ? { location: { "@type": "Place", name: s.lugares[0] } } : {}),
        ...(s.protagonistas.length
          ? { about: s.protagonistas.map((name) => ({ "@type": "Person", name })) }
          : {}),
      };
    }
    case "epoca":
      return {
        "@type": "Article",
        headline: s.titulo,
        ...common,
        ...authoredBits(ctx),
        ...(s.rango ? { temporalCoverage: s.rango } : {}),
      };
    case "entidad": {
      const t =
        s.tipo === "Persona"
          ? "Person"
          : s.tipo === "Lugar"
            ? "Place"
            : s.tipo === "Institución"
              ? "Organization"
              : "DefinedTerm";
      return {
        "@type": t,
        ...common,
        description: s.semblanza || ctx.description || s.resumen,
      };
    }
    case "pregunta":
      return {
        "@type": "QAPage",
        ...common,
        mainEntity: {
          "@type": "Question",
          name: s.pregunta || s.titulo,
          text: s.pregunta || s.titulo,
          acceptedAnswer: { "@type": "Answer", text: s.tesis || ctx.description || s.resumen },
        },
      };
  }
}

/** Nodo Article para un ensayo (pieza narrativa sin ficha estructurada). */
export function articleJsonLd(a: {
  path: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
  wordCount?: number;
}): JsonLdNode {
  const image = a.imageUrl ? [absUrl(a.imageUrl)] : undefined;
  return {
    "@type": "Article",
    headline: a.title,
    name: a.title,
    description: a.description,
    inLanguage: "es",
    url: absUrl(a.path),
    ...(image ? { image } : {}),
    ...authoredBits(a),
    ...(a.wordCount ? { wordCount: a.wordCount } : {}),
  };
}

const INDEX_LABEL: Record<TypologyKind, string> = {
  hecho: "Hechos",
  epoca: "Épocas",
  entidad: "Entidades",
  pregunta: "Preguntas",
};

/**
 * Grafo JSON-LD completo de una ficha de detalle: el nodo de tipología + las
 * migas. Centraliza lo que necesitan las 4 páginas `[slug]`.
 */
export function detailJsonLd(d: {
  structured: StructuredData;
  seo: DeliverableSeo;
  imageUrl?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}): JsonLdNode {
  const s = d.structured;
  const path = typologyPath(s);
  const indexPath = `/${path.split("/")[1]}`;
  return jsonLdGraph(
    typologyJsonLd(s, {
      path,
      imageUrl: d.imageUrl,
      description: d.seo.metaDescription,
      datePublished: d.publishedAt,
      dateModified: d.updatedAt,
    }),
    breadcrumbJsonLd([
      { name: "Inicio", path: "/" },
      { name: INDEX_LABEL[s.typology], path: indexPath },
      { name: s.titulo, path },
    ]),
  );
}

export { AUTHOR, SITE_NAME } from "./site";
