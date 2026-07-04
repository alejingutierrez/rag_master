/**
 * Capa de acceso público — SOLO LECTURA.
 * Alimenta el sitio público desde el corpus del admin. Nunca escribe.
 *
 * Curación: SOLO se muestra lo que tiene `publishedAt != null` (el editor decide
 * en Producciones qué se publica). "Empezar en blanco": nada es público hasta
 * publicarlo explícitamente.
 */
import { prisma } from "@/lib/prisma";
import { getAtelierFormat, fichaKindForFormat, type AtelierFormatId } from "@/lib/atelier-formats";
import { PERIODS } from "@/lib/design-tokens";
import {
  normalizeStructured,
  typologyPath,
  slugify,
  type StructuredData,
  type TypologyKind,
} from "@/lib/typology-schemas";
import { normalizeSeo, deriveSeo, type DeliverableSeo } from "@/lib/seo";
import type { DeliverableTaxonomy } from "@/lib/taxonomy";
import { resolveAnchor, periodStartYear, type ContentAnchor } from "@/lib/content-anchor";
import { getDocumentDisplayName, type EnrichmentMetadata } from "@/lib/enrichment-types";
import {
  loadEntityRegistry,
  findRegistryEntity,
  entityKey,
  type RegistryEntity,
  type EntityType,
} from "@/lib/entities-registry";
import { buildEntityLinker, type EntityLinker, type LinkableEntity } from "@/lib/entity-linker";

/** WHERE base de todo lo publicable: pieza del Taller, completa y publicada. */
const PUBLISHED_WHERE = {
  status: "COMPLETE" as const,
  source: "atelier",
  publishedAt: { not: null },
};

export interface PublicEssay {
  id: string;
  title: string;
  formatName: string;
  periodCode: string | null;
}

interface ChunkUsage {
  id?: string;
  documentId?: string;
  documentFilename?: string;
  pageNumber?: number;
  content?: string;
}

export interface EssaySource {
  n: number;
  label: string;
  page: number | null;
  /** Fragmento exacto que respalda la fuente (ya guardado en chunksUsed). */
  snippet: string | null;
}

export interface PublicEssayDetail {
  id: string;
  title: string;
  formatName: string;
  periodCode: string | null;
  yearRange: string | null;
  categoria: string | null;
  answer: string;
  dateLabel: string;
  wordCount: number;
  sources: EssaySource[];
  imageUrl: string | null;
  seo: DeliverableSeo;
  publishedAt: string | null;
  updatedAt: string | null;
}

/** Recorta a un título legible en borde de palabra. */
function shortTitle(text: string, max = 88): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const i = cut.lastIndexOf(" ");
  return (i > max * 0.6 ? cut.slice(0, i) : cut).trimEnd() + "…";
}

function docLabel(c: ChunkUsage): string {
  if (c.documentFilename) return c.documentFilename.replace(/\.pdf$/i, "");
  if (c.documentId) return c.documentId.slice(0, 8);
  return "Fuente";
}

/** Taxonomía analítica de la pieza (`metadata.atelier.taxonomy`), si existe. */
function taxOf(metadata: unknown): DeliverableTaxonomy | undefined {
  const meta = (metadata ?? null) as Record<string, unknown> | null;
  return (meta?.atelier as Record<string, unknown> | undefined)?.taxonomy as
    | DeliverableTaxonomy
    | undefined;
}

/**
 * Etiqueta de fuente ENRIQUECIDA: el título real del documento (autor, año) en vez
 * del nombre de archivo. Cae al filename solo si el documento no fue enriquecido.
 */
function sourceLabel(
  c: ChunkUsage,
  doc?: { filename: string; metadata: unknown } | null,
): string {
  if (!doc) return docLabel(c);
  const meta = (doc.metadata ?? null) as EnrichmentMetadata | null;
  const titulo = getDocumentDisplayName({ filename: doc.filename, metadata: meta });
  const autor = meta?.author?.trim();
  const anio = typeof meta?.publicationYear === "number" ? meta.publicationYear : null;
  if (autor && anio) return `${autor} (${anio}). ${titulo}`;
  if (autor) return `${autor}. ${titulo}`;
  return titulo;
}

/**
 * Resuelve las fuentes de una pieza uniendo `chunksUsed[].documentId → Document`
 * (un solo batch) para mostrar el nombre bibliográfico real. El `documentId` ya
 * viene en cada chunk; antes se ignoraba y se mostraba el filename.
 */
async function resolveSources(chunks: ChunkUsage[]): Promise<EssaySource[]> {
  const ids = [...new Set(chunks.map((c) => c.documentId).filter((x): x is string => !!x))];
  const docMap = new Map<string, { filename: string; metadata: unknown }>();
  if (ids.length) {
    try {
      const docs = await prisma.document.findMany({
        where: { id: { in: ids } },
        select: { id: true, filename: true, metadata: true },
      });
      for (const d of docs) docMap.set(d.id, { filename: d.filename, metadata: d.metadata });
    } catch (err) {
      console.error("[public-data] resolveSources (join a Document) falló:", err);
    }
  }
  return chunks.map((c, i) => ({
    n: i + 1,
    label: sourceLabel(c, c.documentId ? docMap.get(c.documentId) : undefined),
    page: typeof c.pageNumber === "number" ? c.pageNumber : null,
    snippet: cleanSnippet(c.content),
  }));
}

/** Fragmento legible del chunk: colapsa espacios, recorta en borde de palabra. */
function cleanSnippet(raw: string | undefined, max = 320): string | null {
  const t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const i = cut.lastIndexOf(" ");
  return (i > max * 0.6 ? cut.slice(0, i) : cut).trimEnd() + "…";
}

/**
 * SEO de una pieza: usa `metadata.seo` (lo escribe El Taller) si es válido; si no,
 * lo deriva de forma determinista del título/resumen/answer + la taxonomía en
 * `metadata.atelier.taxonomy`. Así las piezas publicadas antes de esta feature
 * también quedan full-SEO, sin necesidad de escribir en prod.
 */
function getSeo(row: {
  metadata: unknown;
  titulo: string;
  resumen?: string | null;
  answer?: string | null;
}): DeliverableSeo {
  const meta = (row.metadata ?? null) as Record<string, unknown> | null;
  const stored = normalizeSeo(meta?.seo);
  if (stored) return stored;
  const taxonomy = taxOf(row.metadata);
  return deriveSeo({ titulo: row.titulo, resumen: row.resumen, answer: row.answer, taxonomy });
}

/**
 * Producciones recientes para "Lo último" / el archivo público.
 * El "título" de una producción es la pregunta que responde (o la consulta libre).
 */
export async function getRecentEssays(limit = 8): Promise<PublicEssay[]> {
  try {
    const rows = await prisma.deliverable.findMany({
      where: PUBLISHED_WHERE,
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: {
        id: true,
        templateId: true,
        userQuestion: true,
        question: { select: { pregunta: true, periodoCode: true } },
      },
    });
    return rows.map((d) => ({
      id: d.id,
      title: shortTitle(d.question?.pregunta ?? d.userQuestion ?? "(producción)"),
      formatName: getAtelierFormat(d.templateId)?.name ?? d.templateId,
      periodCode: d.question?.periodoCode ?? null,
    }));
  } catch (err) {
    console.error("[public-data] getRecentEssays falló:", err);
    return [];
  }
}

/** Total de producciones publicadas (para conteos del archivo). */
export async function getEssayCount(): Promise<number> {
  try {
    return await prisma.deliverable.count({ where: PUBLISHED_WHERE });
  } catch (err) {
    console.error("[public-data] getEssayCount falló:", err);
    return 0;
  }
}

/** Detalle de una producción para la página de lectura pública. */
export async function getEssay(id: string): Promise<PublicEssayDetail | null> {
  try {
    const d = await prisma.deliverable.findUnique({
      where: { id },
      select: {
        id: true,
        templateId: true,
        answer: true,
        status: true,
        source: true,
        publishedAt: true,
        updatedAt: true,
        imageUrl: true,
        createdAt: true,
        chunksUsed: true,
        metadata: true,
        userQuestion: true,
        question: {
          select: { pregunta: true, periodoCode: true, categoriaNombre: true },
        },
      },
    });
    if (!d || d.status !== "COMPLETE" || d.source !== "atelier" || !d.publishedAt || !d.answer)
      return null;

    const chunks: ChunkUsage[] = Array.isArray(d.chunksUsed)
      ? (d.chunksUsed as unknown as ChunkUsage[])
      : [];
    const sources: EssaySource[] = await resolveSources(chunks);

    const period = d.question?.periodoCode ?? null;
    const title = (d.question?.pregunta ?? d.userQuestion ?? "Producción").trim();
    const categoria = d.question?.categoriaNombre ?? null;
    return {
      id: d.id,
      title,
      formatName: getAtelierFormat(d.templateId)?.name ?? d.templateId,
      periodCode: period,
      yearRange: period ? (PERIODS[period as keyof typeof PERIODS]?.yearRange ?? null) : null,
      categoria,
      answer: d.answer,
      dateLabel: d.createdAt.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      wordCount: d.answer.trim().split(/\s+/).filter(Boolean).length,
      sources,
      imageUrl: d.imageUrl ?? null,
      seo: getSeo({ metadata: d.metadata, titulo: title, resumen: categoria, answer: d.answer }),
      publishedAt: d.publishedAt ? d.publishedAt.toISOString() : null,
      updatedAt: d.updatedAt ? d.updatedAt.toISOString() : null,
    };
  } catch (err) {
    console.error("[public-data] getEssay falló:", err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipologías públicas (hecho / época / entidad / pregunta) desde structuredData.
// ─────────────────────────────────────────────────────────────────────────────

function dateLabelOf(d: Date): string {
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

export interface TypologyCard {
  id: string;
  typology: TypologyKind;
  slug: string;
  href: string;
  titulo: string;
  resumen: string;
  periodCode: string | null;
  /** Rango cronológico de la época (0=PRE … 15=TRANS) para orden. */
  periodoOrden: number;
  /** Año representativo (inicio) para orden fino y etiquetas. */
  anio: number | null;
  /** Entidades segmentadas — base de filtros y relaciones wiki. */
  entidades: { personas: string[]; lugares: string[]; ideas: string[] };
  /** Etiqueta secundaria: fecha (hecho), tipo (entidad), rango (época), año. */
  meta: string | null;
  imageUrl: string | null;
}

function cardMeta(s: StructuredData, anchor: ContentAnchor): string | null {
  switch (s.typology) {
    case "hecho":
      return s.fecha ?? (anchor.anio != null ? String(anchor.anio) : null);
    case "epoca":
      return s.rango ?? (anchor.anio != null ? String(anchor.anio) : null);
    case "entidad":
      return s.tipo;
    case "pregunta":
      return anchor.anio != null ? String(anchor.anio) : null;
  }
}

/**
 * Tarjetas publicadas de una tipología, para su página índice.
 * Orden: cronológico por ÉPOCA → AÑO (no por fecha de publicación). El ancla se
 * resuelve en lectura desde `structuredData` + `metadata.atelier.taxonomy`.
 */
export async function getTypologyList(
  typology: TypologyKind,
  limit = 300,
): Promise<TypologyCard[]> {
  try {
    const rows = await prisma.deliverable.findMany({
      where: { ...PUBLISHED_WHERE, structuredData: { path: ["typology"], equals: typology } },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: { id: true, structuredData: true, imageUrl: true, metadata: true },
    });
    const cards: TypologyCard[] = [];
    for (const r of rows) {
      const s = normalizeStructured(r.structuredData);
      if (!s) continue;
      const anchor = resolveAnchor({ structured: s, taxonomy: taxOf(r.metadata) });
      cards.push({
        id: r.id,
        typology: s.typology,
        slug: s.slug,
        href: typologyPath(s),
        titulo: s.titulo,
        resumen: s.resumen,
        periodCode: anchor.periodCode,
        periodoOrden: anchor.periodoOrden,
        anio: anchor.anio,
        entidades: { personas: anchor.personas, lugares: anchor.lugares, ideas: anchor.ideas },
        meta: cardMeta(s, anchor),
        imageUrl: r.imageUrl ?? null,
      });
    }
    cards.sort(
      (a, b) =>
        a.periodoOrden - b.periodoOrden ||
        (a.anio ?? periodStartYear(a.periodCode) ?? 9999) -
          (b.anio ?? periodStartYear(b.periodCode) ?? 9999) ||
        a.titulo.localeCompare(b.titulo, "es"),
    );
    return cards;
  } catch (err) {
    console.error(`[public-data] getTypologyList(${typology}) falló:`, err);
    return [];
  }
}

export interface TypologyDetail {
  id: string;
  structured: StructuredData;
  formatName: string;
  answer: string;
  dateLabel: string;
  wordCount: number;
  yearRange: string | null;
  sources: EssaySource[];
  imageUrl: string | null;
  seo: DeliverableSeo;
  publishedAt: string | null;
  updatedAt: string | null;
}

/** Detalle publicado de una ficha por tipología + slug. */
export async function getTypologyDetail(
  typology: TypologyKind,
  slug: string,
): Promise<TypologyDetail | null> {
  try {
    const d = await prisma.deliverable.findFirst({
      where: {
        ...PUBLISHED_WHERE,
        AND: [
          { structuredData: { path: ["typology"], equals: typology } },
          { structuredData: { path: ["slug"], equals: slug } },
        ],
      },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        templateId: true,
        answer: true,
        createdAt: true,
        publishedAt: true,
        updatedAt: true,
        chunksUsed: true,
        imageUrl: true,
        structuredData: true,
        metadata: true,
      },
    });
    if (!d) return null;
    const structured = normalizeStructured(d.structuredData);
    if (!structured) return null;

    const chunks: ChunkUsage[] = Array.isArray(d.chunksUsed)
      ? (d.chunksUsed as unknown as ChunkUsage[])
      : [];
    const sources: EssaySource[] = await resolveSources(chunks);

    const period = structured.periodoCode;
    return {
      id: d.id,
      structured,
      formatName: getAtelierFormat(d.templateId)?.name ?? d.templateId,
      answer: d.answer,
      dateLabel: dateLabelOf(d.createdAt),
      wordCount: d.answer.trim().split(/\s+/).filter(Boolean).length,
      yearRange: period ? (PERIODS[period as keyof typeof PERIODS]?.yearRange ?? null) : null,
      sources,
      imageUrl: d.imageUrl ?? null,
      seo: getSeo({
        metadata: d.metadata,
        titulo: structured.titulo,
        resumen: structured.resumen,
        answer: d.answer,
      }),
      publishedAt: d.publishedAt ? d.publishedAt.toISOString() : null,
      updatedAt: d.updatedAt ? d.updatedAt.toISOString() : null,
    };
  } catch (err) {
    console.error(`[public-data] getTypologyDetail(${typology}/${slug}) falló:`, err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Home dinámica: bloques editables (hero, destacados, colección, pregunta) que
// referencian deliverables PUBLICADOS. Si un bloque no está configurado, la home
// usa sus defaults hardcoded. Referencias colgadas (despublicadas) se ignoran.
// ─────────────────────────────────────────────────────────────────────────────

export interface HomeCard {
  id: string;
  href: string;
  title: string;
  desc: string;
  periodCode: string | null;
  kicker: string;
  imageUrl: string | null;
}

export interface HomeData {
  hero: HomeCard | null;
  featured: HomeCard[];
  collection: { title: string; subtitle: string; cards: HomeCard[] } | null;
  questionOfWeek: { title: string; answer: string; href: string } | null;
}

interface HomeConfigRaw {
  hero?: { deliverableId?: string };
  featured?: string[];
  collection?: { title?: string; subtitle?: string; items?: string[] };
  questionOfWeek?: { deliverableId?: string; title?: string; answer?: string; href?: string };
}

function cardFromDeliverable(d: {
  id: string;
  templateId: string;
  answer: string;
  imageUrl: string | null;
  structuredData: unknown;
  userQuestion: string | null;
  question: { pregunta: string; periodoCode: string | null } | null;
}): HomeCard {
  const s = normalizeStructured(d.structuredData);
  if (s) {
    return {
      id: d.id,
      href: typologyPath(s),
      title: s.titulo,
      desc: s.resumen || d.answer.replace(/[#*>]/g, "").trim().slice(0, 140),
      periodCode: s.periodoCode,
      kicker:
        s.typology === "hecho"
          ? "Hecho"
          : s.typology === "epoca"
            ? "Época"
            : s.typology === "entidad"
              ? "Entidad"
              : "Ensayo",
      imageUrl: d.imageUrl ?? null,
    };
  }
  const title = d.question?.pregunta ?? d.userQuestion ?? "Producción";
  return {
    id: d.id,
    href: `/ensayos/${d.id}`,
    title: shortTitle(title, 80),
    desc: d.answer.replace(/[#*>]/g, "").trim().slice(0, 140),
    periodCode: d.question?.periodoCode ?? null,
    kicker: getAtelierFormat(d.templateId)?.name ?? "Ensayo",
    imageUrl: d.imageUrl ?? null,
  };
}

/** Resuelve ids → HomeCards publicadas, en el orden pedido (ignora las faltantes). */
async function resolvePublishedCards(ids: string[]): Promise<HomeCard[]> {
  const clean = ids.filter((x) => typeof x === "string" && x);
  if (clean.length === 0) return [];
  const rows = await prisma.deliverable.findMany({
    where: { ...PUBLISHED_WHERE, id: { in: clean } },
    select: {
      id: true,
      templateId: true,
      answer: true,
      imageUrl: true,
      structuredData: true,
      userQuestion: true,
      question: { select: { pregunta: true, periodoCode: true } },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: HomeCard[] = [];
  for (const id of clean) {
    const r = byId.get(id);
    if (r) out.push(cardFromDeliverable(r));
  }
  return out;
}

/** Config cruda del home (para el editor). */
export async function getHomeConfigRaw(): Promise<HomeConfigRaw> {
  try {
    const row = await prisma.homeConfig.findUnique({ where: { id: "default" } });
    if (!row) return {};
    return {
      hero: (row.hero as HomeConfigRaw["hero"]) ?? {},
      featured: Array.isArray(row.featured) ? (row.featured as string[]) : [],
      collection: (row.collection as HomeConfigRaw["collection"]) ?? {},
      questionOfWeek: (row.questionOfWeek as HomeConfigRaw["questionOfWeek"]) ?? {},
    };
  } catch (err) {
    console.error("[public-data] getHomeConfigRaw falló:", err);
    return {};
  }
}

/** Home resuelta y lista para render (con referencias publicadas). */
export async function getHome(): Promise<HomeData> {
  const empty: HomeData = { hero: null, featured: [], collection: null, questionOfWeek: null };
  try {
    const cfg = await getHomeConfigRaw();

    const heroId = cfg.hero?.deliverableId;
    const heroCards = heroId ? await resolvePublishedCards([heroId]) : [];
    const hero = heroCards[0] ?? null;

    const featured = cfg.featured?.length ? await resolvePublishedCards(cfg.featured) : [];

    let collection: HomeData["collection"] = null;
    if (cfg.collection?.items?.length) {
      const cards = await resolvePublishedCards(cfg.collection.items);
      if (cards.length) {
        collection = {
          title: cfg.collection.title || "Colección",
          subtitle: cfg.collection.subtitle || "",
          cards,
        };
      }
    }

    let questionOfWeek: HomeData["questionOfWeek"] = null;
    const q = cfg.questionOfWeek;
    if (q?.deliverableId) {
      const cards = await resolvePublishedCards([q.deliverableId]);
      const c = cards[0];
      if (c) {
        questionOfWeek = { title: c.title, answer: c.desc, href: c.href };
      }
    } else if (q?.title && q?.answer) {
      questionOfWeek = { title: q.title, answer: q.answer, href: q.href || "/ensayos" };
    }

    return { hero, featured, collection, questionOfWeek };
  } catch (err) {
    console.error("[public-data] getHome falló:", err);
    return empty;
  }
}

/** Conteos publicados por tipología (para índices y home). */
export async function getTypologyCounts(): Promise<Record<TypologyKind, number>> {
  const empty: Record<TypologyKind, number> = { hecho: 0, epoca: 0, entidad: 0, pregunta: 0 };
  try {
    const kinds: TypologyKind[] = ["hecho", "epoca", "entidad", "pregunta"];
    await Promise.all(
      kinds.map(async (k) => {
        empty[k] = await prisma.deliverable.count({
          where: { ...PUBLISHED_WHERE, structuredData: { path: ["typology"], equals: k } },
        });
      }),
    );
    return empty;
  } catch (err) {
    console.error("[public-data] getTypologyCounts falló:", err);
    return empty;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Enlaces del timeline: piezas publicadas agrupadas por período. Alimenta la
// línea de tiempo pública — el sidebar del período (época + muestra de piezas) y
// el vínculo evento↔hecho por solape de año. Es el puente wiki timeline→fichas.
// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineLinkPiece {
  href: string;
  titulo: string;
  /** hecho | epoca | entidad | pregunta | ensayo */
  kind: string;
  anio: number | null;
  anioFin: number | null;
}

export interface PeriodTimelineLinks {
  epoca: { href: string; titulo: string; resumen: string } | null;
  /** Hechos publicados del período (para casar un evento con su hecho por año). */
  hechos: TimelineLinkPiece[];
  /** Todas las piezas del período, ordenadas cronológicamente (muestra en sidebar). */
  pieces: TimelineLinkPiece[];
  counts: { hechos: number; epocas: number; entidades: number; ensayos: number; total: number };
}

export type TimelineLinks = Record<string, PeriodTimelineLinks>;

function emptyPeriodLinks(): PeriodTimelineLinks {
  return {
    epoca: null,
    hechos: [],
    pieces: [],
    counts: { hechos: 0, epocas: 0, entidades: 0, ensayos: 0, total: 0 },
  };
}

/** Piezas publicadas por período para la línea de tiempo pública. Solo lectura.
 *  Consume las piezas ancladas (cacheadas): sin query ni resolveAnchor propios. */
export async function getTimelineLinks(): Promise<TimelineLinks> {
  try {
    const pieces = await getAnchoredPieces();
    const out: TimelineLinks = {};
    for (const p of pieces) {
      const code = p.periodCode;
      if (!code) continue;

      const bucket = (out[code] ??= emptyPeriodLinks());
      const piece: TimelineLinkPiece = {
        href: p.href,
        titulo: p.titulo,
        kind: p.kind,
        anio: p.anio,
        anioFin: p.anioFin,
      };

      bucket.pieces.push(piece);
      bucket.counts.total++;
      if (p.kind === "hecho") {
        bucket.hechos.push(piece);
        bucket.counts.hechos++;
      } else if (p.kind === "epoca") {
        bucket.counts.epocas++;
        if (!bucket.epoca) bucket.epoca = { href: p.href, titulo: p.titulo, resumen: p.resumen };
      } else if (p.kind === "entidad") {
        bucket.counts.entidades++;
      } else {
        bucket.counts.ensayos++;
      }
    }

    const byYear = (a: TimelineLinkPiece, b: TimelineLinkPiece) =>
      (a.anio ?? 9999) - (b.anio ?? 9999) || a.titulo.localeCompare(b.titulo, "es");
    for (const code of Object.keys(out)) {
      out[code].pieces.sort(byYear);
      out[code].hechos.sort(byYear);
    }
    return out;
  } catch (err) {
    console.error("[public-data] getTimelineLinks falló:", err);
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WIKIZACIÓN — piezas ancladas + hub de época + índice/nodo de entidades.
// Todo se deriva en lectura del ancla (época+año+entidades) que ya vive en cada
// pieza publicada. Cero escritura a prod. Es el tejido que interconecta el sitio.
// ─────────────────────────────────────────────────────────────────────────────

export type { EntityType };

export const ENTITY_TYPE_META: Record<
  EntityType,
  {
    plural: string;
    singular: string;
    index: string;
    array: "personas" | "lugares" | "ideas";
    color: string;
  }
> = {
  persona: { plural: "Personas", singular: "Persona", index: "/personas", array: "personas", color: "var(--p-ind)" },
  lugar: { plural: "Lugares", singular: "Lugar", index: "/lugares", array: "lugares", color: "var(--p-pos)" },
  idea: { plural: "Ideas", singular: "Idea", index: "/ideas", array: "ideas", color: "var(--p-cna)" },
};

/** Ruta del nodo público de una entidad, por tipo: /personas · /lugares · /ideas. */
export function entityPath(type: EntityType, slug: string): string {
  return `${ENTITY_TYPE_META[type].index}/${slug}`;
}

/** Tipo público a partir del `tipo` de una ficha de entidad. */
function entityTypeFromTipo(tipo: string | null | undefined): EntityType {
  if (tipo === "Lugar") return "lugar";
  if (tipo === "Concepto" || tipo === "Institución") return "idea";
  return "persona";
}

export interface AnchoredPiece {
  id: string;
  href: string;
  titulo: string;
  resumen: string;
  kind: string; // hecho | epoca | entidad | pregunta | ensayo
  templateId: string; // formato del Taller (crónica/ensayo/…/ficha-*)
  imageUrl: string | null;
  periodCode: string | null;
  periodoOrden: number;
  anio: number | null;
  anioFin: number | null;
  personas: string[];
  lugares: string[];
  ideas: string[];
  entidadTipo: string | null; // Persona|Lugar|Concepto|Institución (solo fichas de entidad)
  entidadSlug: string | null; // slug de la ficha de entidad, si aplica
}

/** Carga todas las piezas publicadas con su ancla resuelta. Base de la wikización. */
async function loadAnchoredPieces(): Promise<AnchoredPiece[]> {
  const rows = await prisma.deliverable.findMany({
    where: PUBLISHED_WHERE,
    select: {
      id: true,
      templateId: true,
      structuredData: true,
      metadata: true,
      imageUrl: true,
      userQuestion: true,
      question: { select: { periodoCode: true, yearPrincipal: true, pregunta: true } },
    },
  });
  const out: AnchoredPiece[] = [];
  for (const r of rows) {
    const s = normalizeStructured(r.structuredData);
    const anchor = resolveAnchor({
      structured: s,
      taxonomy: taxOf(r.metadata),
      fallbackPeriodo: r.question?.periodoCode,
      fallbackYear: r.question?.yearPrincipal,
    });
    out.push({
      id: r.id,
      href: s ? typologyPath(s) : `/ensayos/${r.id}`,
      titulo: s?.titulo ?? shortTitle(r.question?.pregunta ?? r.userQuestion ?? "Producción", 80),
      resumen: s?.resumen ?? "",
      kind: s?.typology ?? "ensayo",
      templateId: r.templateId,
      imageUrl: r.imageUrl ?? null,
      periodCode: anchor.periodCode,
      periodoOrden: anchor.periodoOrden,
      anio: anchor.anio,
      anioFin: anchor.anioFin,
      personas: anchor.personas,
      lugares: anchor.lugares,
      ideas: anchor.ideas,
      entidadTipo: s?.typology === "entidad" ? s.tipo : null,
      entidadSlug: s?.typology === "entidad" ? s.slug : null,
    });
  }
  return out;
}

// ── Caché en memoria: piezas ancladas + índice de entidades publicadas ────────
// loadAnchoredPieces() escanea TODOS los deliverables publicados y resuelve el
// ancla de cada uno: caro, y se llamaba 4+ veces al navegar entidades/timeline.
// Es determinista hasta publicar/despublicar → cache de proceso con TTL corto.
// Junto con el registro (que ya no escanea el corpus en cada request), elimina
// el trabajo pesado que hacía lento el sitio.
const ANCHORED_TTL_MS = 2 * 60 * 1000;
let anchoredCache: { pieces: AnchoredPiece[]; at: number } | null = null;

async function getAnchoredPieces(): Promise<AnchoredPiece[]> {
  const now = Date.now();
  if (anchoredCache && now - anchoredCache.at < ANCHORED_TTL_MS) return anchoredCache.pieces;
  const pieces = await loadAnchoredPieces();
  anchoredCache = { pieces, at: now };
  return pieces;
}

interface PublishedEntityData {
  index: EntityIndex;
  /** slugs (canónicos + variantes) presentes en piezas PUBLICADAS, por tipo. */
  publishedSlugs: Record<EntityType, Set<string>>;
}
let pubEntityCache: { data: PublishedEntityData; at: number } | null = null;

/** Índice de entidades PUBLICADAS (para el gate) + co-ocurrencia, cacheado. */
async function getPublishedEntityData(): Promise<PublishedEntityData> {
  const now = Date.now();
  if (pubEntityCache && now - pubEntityCache.at < ANCHORED_TTL_MS) return pubEntityCache.data;
  const pieces = await getAnchoredPieces();
  const index = buildEntityIndex(pieces);
  const publishedSlugs: Record<EntityType, Set<string>> = {
    persona: new Set(),
    lugar: new Set(),
    idea: new Set(),
  };
  for (const acc of index.byKey.values()) {
    const set = publishedSlugs[acc.type];
    set.add(acc.slug);
    for (const v of acc.variants.keys()) {
      const vs = slugify(v);
      if (vs) set.add(vs);
    }
  }
  const data: PublishedEntityData = { index, publishedSlugs };
  pubEntityCache = { data, at: now };
  return data;
}

// ── Época como HUB ───────────────────────────────────────────────────────────

export interface HubPiece {
  href: string;
  titulo: string;
  anio: number | null;
  kind: string;
}
export interface EntityChip {
  name: string;
  slug: string;
  href: string;
  count: number;
}
export interface PeriodHub {
  hechos: HubPiece[];
  ensayos: HubPiece[];
  personas: EntityChip[];
  lugares: EntityChip[];
  ideas: EntityChip[];
  pieceCount: number;
}

function chipMap(map: Map<string, EntityChip>, type: EntityType, names: string[]) {
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const slug = slugify(name);
    if (!slug) continue;
    const cur = map.get(slug);
    if (cur) cur.count++;
    else map.set(slug, { name, slug, href: entityPath(type, slug), count: 1 });
  }
}

/** Todo lo publicado anclado a un período: hechos, ensayos y entidades. */
export async function getPeriodHub(periodCode: string): Promise<PeriodHub> {
  const empty: PeriodHub = { hechos: [], ensayos: [], personas: [], lugares: [], ideas: [], pieceCount: 0 };
  try {
    const pieces = (await getAnchoredPieces()).filter((p) => p.periodCode === periodCode);
    const hechos: HubPiece[] = [];
    const ensayos: HubPiece[] = [];
    const personas = new Map<string, EntityChip>();
    const lugares = new Map<string, EntityChip>();
    const ideas = new Map<string, EntityChip>();
    for (const p of pieces) {
      const hp: HubPiece = { href: p.href, titulo: p.titulo, anio: p.anio, kind: p.kind };
      if (p.kind === "hecho") hechos.push(hp);
      else if (p.kind === "pregunta" || p.kind === "ensayo") ensayos.push(hp);
      chipMap(personas, "persona", p.personas);
      chipMap(lugares, "lugar", p.lugares);
      chipMap(ideas, "idea", p.ideas);
    }
    const byYear = (a: HubPiece, b: HubPiece) =>
      (a.anio ?? 9999) - (b.anio ?? 9999) || a.titulo.localeCompare(b.titulo, "es");
    hechos.sort(byYear);
    ensayos.sort(byYear);
    const top = (m: Map<string, EntityChip>) =>
      [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es")).slice(0, 30);
    return {
      hechos,
      ensayos,
      personas: top(personas),
      lugares: top(lugares),
      ideas: top(ideas),
      pieceCount: pieces.length,
    };
  } catch (err) {
    console.error(`[public-data] getPeriodHub(${periodCode}) falló:`, err);
    return empty;
  }
}

// ── Entidades: índice + nodo wiki con co-ocurrencia ──────────────────────────

export interface EntityAccum {
  key: string; // `${type}:${slug}`
  type: EntityType;
  slug: string;
  variants: Map<string, number>; // conteo por variante de escritura
  pieceIds: Set<string>;
  periods: Set<string>;
  periodoOrden: number;
  anio: number | null;
  related: Map<string, number>; // key de la otra entidad → piezas compartidas
  hasFicha: boolean;
  resumen: string | null;
}

export function canonicalName(acc: EntityAccum): string {
  let best = "";
  let bestN = -1;
  for (const [v, n] of acc.variants) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

export interface EntityIndex {
  byKey: Map<string, EntityAccum>;
  piecesById: Map<string, AnchoredPiece>;
}

/** Construye el índice de entidades (con relaciones por co-ocurrencia) desde las piezas. */
export function buildEntityIndex(pieces: AnchoredPiece[]): EntityIndex {
  const byKey = new Map<string, EntityAccum>();
  const piecesById = new Map<string, AnchoredPiece>();

  const upsert = (type: EntityType, rawName: string): EntityAccum | null => {
    const name = rawName.trim();
    if (!name) return null;
    const slug = slugify(name);
    if (!slug) return null;
    const key = `${type}:${slug}`;
    let acc = byKey.get(key);
    if (!acc) {
      acc = {
        key,
        type,
        slug,
        variants: new Map(),
        pieceIds: new Set(),
        periods: new Set(),
        periodoOrden: 99,
        anio: null,
        related: new Map(),
        hasFicha: false,
        resumen: null,
      };
      byKey.set(key, acc);
    }
    acc.variants.set(name, (acc.variants.get(name) ?? 0) + 1);
    return acc;
  };

  for (const p of pieces) {
    piecesById.set(p.id, p);
    // Entidades de la pieza, con su tipo.
    const ents: EntityAccum[] = [];
    for (const [type, list] of [
      ["persona", p.personas],
      ["lugar", p.lugares],
      ["idea", p.ideas],
    ] as const) {
      const seen = new Set<string>();
      for (const nm of list) {
        const acc = upsert(type, nm);
        if (!acc || seen.has(acc.key)) continue;
        seen.add(acc.key);
        acc.pieceIds.add(p.id);
        if (p.periodCode) acc.periods.add(p.periodCode);
        if (p.periodoOrden < acc.periodoOrden) acc.periodoOrden = p.periodoOrden;
        if (p.anio != null && (acc.anio == null || p.anio < acc.anio)) acc.anio = p.anio;
        ents.push(acc);
      }
    }
    // Co-ocurrencia: todo par de entidades de la misma pieza se relaciona.
    for (const a of ents) {
      for (const b of ents) {
        if (a.key === b.key) continue;
        a.related.set(b.key, (a.related.get(b.key) ?? 0) + 1);
      }
    }
    // La ficha de entidad enriquece su propio nodo.
    if (p.kind === "entidad" && p.entidadTipo) {
      const acc = upsert(entityTypeFromTipo(p.entidadTipo), p.titulo);
      if (acc) {
        acc.hasFicha = true;
        acc.resumen = p.resumen || acc.resumen;
      }
    }
  }

  return { byKey, piecesById };
}

export interface PublicEntity {
  name: string;
  slug: string;
  type: EntityType;
  href: string;
  mentions: number;
  periods: string[];
  periodoOrden: number;
  anio: number | null;
  hasFicha: boolean;
  resumen: string | null;
}

// ── Entidades públicas: REGISTRO (época/nombre) ∩ PUBLICADO (visibilidad) ─────
// El registro canónico (src/data/entities.json) aporta identidad y ÉPOCA de cada
// entidad; el gate de solo-publicado decide cuáles se muestran: una entidad sale
// en el sitio solo si aparece en ≥1 pieza PUBLICADA. Así los filtros de época
// funcionan (época "hogar" curada, no la unión ruidosa de todos los períodos) y
// no se listan lugares / ideas / personas sin contenido publicado.

/** ¿La entidad del registro aparece en alguna pieza publicada de su tipo? */
function isPublishedEntity(e: RegistryEntity, pub: Set<string>): boolean {
  if (pub.has(e.slug)) return true;
  for (const v of e.variants) if (pub.has(slugify(v))) return true;
  return false;
}

/** El acc del índice publicado que corresponde a esta entidad del registro. */
function findPublishedAcc(e: RegistryEntity, index: EntityIndex): EntityAccum | null {
  const slugs = new Set<string>([e.slug, ...e.variants.map((v) => slugify(v))]);
  for (const vs of slugs) {
    const acc = index.byKey.get(entityKey(e.type, vs));
    if (acc) return acc;
  }
  return null;
}

function registryToPublic(e: RegistryEntity, index: EntityIndex): PublicEntity {
  const acc = findPublishedAcc(e, index);
  return {
    name: e.name,
    slug: e.slug,
    type: e.type,
    href: entityPath(e.type, e.slug),
    mentions: e.mentions,
    periods: e.periods,
    periodoOrden: e.periodoOrden,
    anio: e.anio,
    hasFicha: acc?.hasFicha ?? false,
    resumen: acc?.resumen ?? null,
  };
}

/** Relaciones (co-ocurrencia en piezas PUBLICADAS) de un acc → EntityRelation[]. */
function relatedFromAcc(acc: EntityAccum, index: EntityIndex): EntityRelation[] {
  return [...acc.related.entries()]
    .map(([k, shared]) => {
      const o = index.byKey.get(k);
      if (!o) return null;
      return { name: canonicalName(o), slug: o.slug, type: o.type, href: entityPath(o.type, o.slug), shared } as EntityRelation;
    })
    .filter((x): x is EntityRelation => !!x)
    .sort((a, b) => b.shared - a.shared || a.name.localeCompare(b.name, "es"))
    .slice(0, 16);
}

/** El registro tiene miles de entidades; el índice muestra las más referenciadas. */
export const ENTITY_DISPLAY_CAP = 300;

/**
 * Índice público de entidades de un tipo: las del REGISTRO que además aparecen en
 * piezas PUBLICADAS (gate). Ordenadas por prominencia (menciones del corpus),
 * capadas a `ENTITY_DISPLAY_CAP`. El filtro de época navega dentro de ellas.
 */
export async function getEntityUniverse(type: EntityType): Promise<PublicEntity[]> {
  try {
    const [reg, { index, publishedSlugs }] = await Promise.all([
      loadEntityRegistry(),
      getPublishedEntityData(),
    ]);
    const pub = publishedSlugs[type];
    const list: PublicEntity[] = [];
    for (const e of reg.entities) {
      if (e.type !== type || !isPublishedEntity(e, pub)) continue;
      list.push(registryToPublic(e, index));
    }
    list.sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name, "es"));
    return list.slice(0, ENTITY_DISPLAY_CAP);
  } catch (err) {
    console.error(`[public-data] getEntityUniverse(${type}) falló:`, err);
    return [];
  }
}

/** Conteos por tipo — entidades del registro presentes en piezas publicadas. */
export async function getEntityCounts(): Promise<Record<EntityType, number>> {
  const empty: Record<EntityType, number> = { persona: 0, lugar: 0, idea: 0 };
  try {
    const [reg, { publishedSlugs }] = await Promise.all([
      loadEntityRegistry(),
      getPublishedEntityData(),
    ]);
    for (const e of reg.entities) {
      if (isPublishedEntity(e, publishedSlugs[e.type])) empty[e.type]++;
    }
    return empty;
  } catch (err) {
    console.error("[public-data] getEntityCounts falló:", err);
    return empty;
  }
}

// ── Auto-enlace de entidades en prosa ────────────────────────────────────────
// Diccionario = entidades PUBLICADAS (registro ∩ piezas). Se pasa al renderer de
// prosa para enlazar menciones a su página. Cacheado como el resto (TTL corto);
// el registro viene ordenado por prominencia, así que en colisiones de superficie
// gana la entidad más mencionada.
let linkerCache: { linker: EntityLinker; at: number } | null = null;

export async function getEntityLinker(): Promise<EntityLinker> {
  const now = Date.now();
  if (linkerCache && now - linkerCache.at < ANCHORED_TTL_MS) return linkerCache.linker;
  try {
    const [reg, { publishedSlugs }] = await Promise.all([
      loadEntityRegistry(),
      getPublishedEntityData(),
    ]);
    const entities: LinkableEntity[] = [];
    for (const e of reg.entities) {
      if (!isPublishedEntity(e, publishedSlugs[e.type])) continue;
      entities.push({
        key: entityKey(e.type, e.slug),
        type: e.type,
        slug: e.slug,
        href: entityPath(e.type, e.slug),
        surfaces: [e.name, ...e.variants],
      });
    }
    const linker = buildEntityLinker(entities);
    linkerCache = { linker, at: now };
    return linker;
  } catch (err) {
    console.error("[public-data] getEntityLinker falló:", err);
    return { regex: null, bySurface: new Map() };
  }
}

/**
 * Resuelve nombres de entidad → href de su página pública, SOLO si están
 * publicadas. Para enlazar chips (p. ej. las entidades clave de un evento del
 * timeline) a la wiki — así el drawer nunca queda sin caminos hacia dónde seguir.
 */
export async function resolveEntityHrefs(names: string[]): Promise<Record<string, string>> {
  try {
    const [reg, { publishedSlugs }] = await Promise.all([
      loadEntityRegistry(),
      getPublishedEntityData(),
    ]);
    const out: Record<string, string> = {};
    for (const raw of names) {
      const name = (raw ?? "").trim();
      if (!name || out[name] !== undefined) continue;
      const slug = slugify(name);
      if (!slug) continue;
      const key = reg.variantSlugToKey.get(slug);
      const ent = key ? reg.byKey.get(key) : undefined;
      if (ent && isPublishedEntity(ent, publishedSlugs[ent.type])) {
        out[name] = entityPath(ent.type, ent.slug);
      }
    }
    return out;
  } catch (err) {
    console.error("[public-data] resolveEntityHrefs falló:", err);
    return {};
  }
}

export interface EntityPieceRef {
  href: string;
  titulo: string;
  kind: string;
  anio: number | null;
}
export interface EntityRelation {
  name: string;
  slug: string;
  type: EntityType;
  href: string;
  shared: number;
}
export interface EntityNode extends PublicEntity {
  pieces: EntityPieceRef[];
  related: EntityRelation[];
}

/**
 * Nodo wiki de una entidad. Identidad + ÉPOCA salen del REGISTRO; las piezas que
 * la referencian y sus entidades relacionadas salen de lo PUBLICADO (co-ocurrencia
 * acotada). Gate: sin presencia publicada → null (404). Fallback a las piezas si
 * la entidad no está en el registro (para no romper enlaces). `type` desambigua
 * colisiones de slug (p. ej. Bolívar persona vs. departamento).
 */
export async function getEntityNode(slug: string, type?: EntityType): Promise<EntityNode | null> {
  try {
    const [e, { index, publishedSlugs }] = await Promise.all([
      findRegistryEntity(slug, type),
      getPublishedEntityData(),
    ]);
    if (!e) return pieceEntityNode(slug, index, type);

    // Gate CONSISTENTE con las listas y el auto-enlace: la entidad tiene página
    // si aparece en ≥1 pieza publicada (por taxonomía) O tiene ficha propia — lo
    // mismo que decide si se lista/enlaza. Sin esto, una entidad con solo ficha
    // (que no la referencia otra pieza) se listaba y enlazaba pero su página 404.
    if (!isPublishedEntity(e, publishedSlugs[e.type])) return null;

    const varSlugs = new Set<string>([e.slug, ...e.variants.map((v) => slugify(v))]);
    const namesOf = (p: AnchoredPiece) =>
      e.type === "persona" ? p.personas : e.type === "lugar" ? p.lugares : p.ideas;

    const pieceRefs: EntityPieceRef[] = [...index.piecesById.values()]
      .filter((p) => namesOf(p).some((n) => varSlugs.has(slugify(n))))
      .map((p) => ({ href: p.href, titulo: p.titulo, kind: p.kind, anio: p.anio }))
      .sort((a, b) => (a.anio ?? 9999) - (b.anio ?? 9999) || a.titulo.localeCompare(b.titulo, "es"));

    const acc = findPublishedAcc(e, index);
    return {
      ...registryToPublic(e, index),
      pieces: pieceRefs,
      related: acc ? relatedFromAcc(acc, index) : [],
    };
  } catch (err) {
    console.error(`[public-data] getEntityNode(${slug}) falló:`, err);
    return null;
  }
}

/** Fallback: nodo de una entidad que aparece en piezas pero no está en el registro. */
function pieceEntityNode(slug: string, index: EntityIndex, type?: EntityType): EntityNode | null {
  const { byKey, piecesById } = index;
  let acc: EntityAccum | null = null;
  for (const a of byKey.values()) {
    if (a.slug !== slug || (type && a.type !== type)) continue;
    if (!acc || a.pieceIds.size > acc.pieceIds.size) acc = a;
  }
  if (!acc) return null;
  const pieceRefs: EntityPieceRef[] = [...acc.pieceIds]
    .map((id) => piecesById.get(id))
    .filter((p): p is AnchoredPiece => !!p)
    .map((p) => ({ href: p.href, titulo: p.titulo, kind: p.kind, anio: p.anio }))
    .sort((a, b) => (a.anio ?? 9999) - (b.anio ?? 9999) || a.titulo.localeCompare(b.titulo, "es"));
  return {
    name: canonicalName(acc),
    slug: acc.slug,
    type: acc.type,
    href: entityPath(acc.type, acc.slug),
    mentions: acc.pieceIds.size,
    periods: [...acc.periods],
    periodoOrden: acc.periodoOrden,
    anio: acc.anio,
    hasFicha: acc.hasFicha,
    resumen: acc.resumen,
    pieces: pieceRefs,
    related: relatedFromAcc(acc, index),
  };
}

// ── Ensayos: superficie pública de lectura (todo lo discursivo) ──────────────

/**
 * Índice de ENSAYOS: las piezas discursivas (tipología `pregunta` + prosa sin
 * ficha), ordenadas por ÉPOCA→AÑO. Reusa TypologyCard para el índice/filtros.
 * Las fichas (hecho/época/entidad) NO entran — son nodos wiki, no lectura.
 */
export async function getEssaysIndex(): Promise<TypologyCard[]> {
  try {
    const pieces = await getAnchoredPieces();
    const cards: TypologyCard[] = [];
    for (const p of pieces) {
      // Clasifica por FORMATO (lo que el autor produjo), no por la tipología que
      // el Taller adivinó: narrativas (crónica/ensayo/reportaje/…) + preguntas.
      // Las fichas hecho/época/entidad son nodos wiki, no lectura → fuera.
      const fk = fichaKindForFormat(p.templateId as AtelierFormatId);
      if (fk !== null && fk !== "pregunta") continue;
      cards.push({
        id: p.id,
        typology: "pregunta" as TypologyKind,
        slug: p.id,
        // Narrativa → lector /ensayos/[id]; pregunta → su ficha /preguntas/[slug].
        href: fk === "pregunta" ? p.href : `/ensayos/${p.id}`,
        titulo: p.titulo,
        resumen: p.resumen,
        periodCode: p.periodCode,
        periodoOrden: p.periodoOrden,
        anio: p.anio,
        entidades: { personas: p.personas, lugares: p.lugares, ideas: p.ideas },
        meta: p.anio != null ? (p.anio < 0 ? `${-p.anio} a.C.` : String(p.anio)) : null,
        imageUrl: p.imageUrl,
      });
    }
    cards.sort(
      (a, b) =>
        a.periodoOrden - b.periodoOrden ||
        (a.anio ?? periodStartYear(a.periodCode) ?? 9999) -
          (b.anio ?? periodStartYear(b.periodCode) ?? 9999) ||
        a.titulo.localeCompare(b.titulo, "es"),
    );
    return cards;
  } catch (err) {
    console.error("[public-data] getEssaysIndex falló:", err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sitemap: una entrada por pieza publicada. Al ser dinámico (leído en vivo),
// publicar aparece de inmediato sin rebuild.
// ─────────────────────────────────────────────────────────────────────────────

export interface SitemapEntry {
  path: string;
  lastModified: Date;
}

/** Paths + lastModified de todas las piezas publicadas (fichas y ensayos). */
export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  try {
    const rows = await prisma.deliverable.findMany({
      where: PUBLISHED_WHERE,
      orderBy: { publishedAt: "desc" },
      select: { id: true, structuredData: true, updatedAt: true, publishedAt: true },
    });
    return rows.map((r) => {
      const s = normalizeStructured(r.structuredData);
      return {
        path: s ? typologyPath(s) : `/ensayos/${r.id}`,
        lastModified: r.updatedAt ?? r.publishedAt ?? r.updatedAt,
      };
    });
  } catch (err) {
    console.error("[public-data] getSitemapEntries falló:", err);
    return [];
  }
}
