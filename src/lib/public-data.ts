/**
 * Capa de acceso público — SOLO LECTURA.
 * Alimenta el sitio público desde el corpus del admin. Nunca escribe.
 *
 * Curación: SOLO se muestra lo que tiene `publishedAt != null` (el editor decide
 * en Producciones qué se publica). "Empezar en blanco": nada es público hasta
 * publicarlo explícitamente.
 */
import { prisma } from "@/lib/prisma";
import { getAtelierFormat } from "@/lib/atelier-formats";
import { PERIODS } from "@/lib/design-tokens";
import {
  normalizeStructured,
  typologyPath,
  type StructuredData,
  type TypologyKind,
} from "@/lib/typology-schemas";

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
}

export interface EssaySource {
  n: number;
  label: string;
  page: number | null;
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
        imageUrl: true,
        createdAt: true,
        chunksUsed: true,
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
    const sources: EssaySource[] = chunks.map((c, i) => ({
      n: i + 1,
      label: docLabel(c),
      page: typeof c.pageNumber === "number" ? c.pageNumber : null,
    }));

    const period = d.question?.periodoCode ?? null;
    return {
      id: d.id,
      title: (d.question?.pregunta ?? d.userQuestion ?? "Producción").trim(),
      formatName: getAtelierFormat(d.templateId)?.name ?? d.templateId,
      periodCode: period,
      yearRange: period ? (PERIODS[period as keyof typeof PERIODS]?.yearRange ?? null) : null,
      categoria: d.question?.categoriaNombre ?? null,
      answer: d.answer,
      dateLabel: d.createdAt.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      wordCount: d.answer.trim().split(/\s+/).filter(Boolean).length,
      sources,
      imageUrl: d.imageUrl ?? null,
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
  /** Etiqueta secundaria: fecha (hecho), tipo (entidad), rango (época). */
  meta: string | null;
  imageUrl: string | null;
}

function cardMeta(s: StructuredData): string | null {
  switch (s.typology) {
    case "hecho":
      return s.fecha ?? (s.anioInicio ? String(s.anioInicio) : null);
    case "epoca":
      return s.rango ?? null;
    case "entidad":
      return s.tipo;
    case "pregunta":
      return "Pregunta";
  }
}

/** Tarjetas publicadas de una tipología, para su página índice. */
export async function getTypologyList(
  typology: TypologyKind,
  limit = 60,
): Promise<TypologyCard[]> {
  try {
    const rows = await prisma.deliverable.findMany({
      where: { ...PUBLISHED_WHERE, structuredData: { path: ["typology"], equals: typology } },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: { id: true, structuredData: true, imageUrl: true },
    });
    const cards: TypologyCard[] = [];
    for (const r of rows) {
      const s = normalizeStructured(r.structuredData);
      if (!s) continue;
      cards.push({
        id: r.id,
        typology: s.typology,
        slug: s.slug,
        href: typologyPath(s),
        titulo: s.titulo,
        resumen: s.resumen,
        periodCode: s.periodoCode,
        meta: cardMeta(s),
        imageUrl: r.imageUrl ?? null,
      });
    }
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
        chunksUsed: true,
        imageUrl: true,
        structuredData: true,
      },
    });
    if (!d) return null;
    const structured = normalizeStructured(d.structuredData);
    if (!structured) return null;

    const chunks: ChunkUsage[] = Array.isArray(d.chunksUsed)
      ? (d.chunksUsed as unknown as ChunkUsage[])
      : [];
    const sources: EssaySource[] = chunks.map((c, i) => ({
      n: i + 1,
      label: docLabel(c),
      page: typeof c.pageNumber === "number" ? c.pageNumber : null,
    }));

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
              : "Pregunta",
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
      questionOfWeek = { title: q.title, answer: q.answer, href: q.href || "/preguntas" };
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
