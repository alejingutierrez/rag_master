/**
 * Buscador de REFERENCIAS VISUALES reales para el generador de imágenes.
 *
 * El realismo del estilo de la casa (plata B/N + tinta 35% + un acento) depende
 * de anclar cada generación en material auténtico: fotos de prensa, pinturas de
 * época, piezas de museo, arquitectura que sigue en pie. Este módulo busca ese
 * material en internet en general, no solo en Wikimedia:
 *
 *   1. Un LLM genera una escalera de queries (es/en, de específico a amplio).
 *   2. Fan-out a proveedores SIN llave (Openverse, Wikimedia Commons, Met Museum,
 *      Art Institute of Chicago, Cleveland Museum, Library of Congress) y, cuando
 *      hay llave, Google Images (serper.dev), Europeana y Smithsonian Open Access.
 *      Cuantas más fuentes, más probable llegar al piso documental.
 *   3. Filtro técnico (tamaño mínimo, dedup) + PUNTUACIÓN DE RELEVANCIA por LLM
 *      (los proveedores devuelven ruido; sin este paso el piso de calidad cae).
 *   4. Piso editorial EN NIVELES (no todo-o-nada): ≥5 relevantes = ancla
 *      documental plena; con menos se degrada (capa de atmósfera + texto de la
 *      pieza en el prompt) en vez de abandonar la imagen. El nivel conseguido se
 *      registra y es auditable desde Producciones.
 *   5. Descarga + normalización (≤1568px, JPEG) listas para images/edits.
 *
 * Las referencias NUNCA se publican: son insumo del generador, como las fotos
 * sobre la mesa de un ilustrador.
 */
import sharp from "sharp";
import { callClaudeJson, SONNET_MODEL } from "./bedrock-json";
import type { StructuredData } from "../typology-schemas";
import { periodInfo } from "../design-tokens";

export const MIN_RELEVANT_REFS = 5;
const MAX_REFS_TO_ATTACH = 7;
/** Ancla documental directa (Tier "documental"): el material de verdad. */
const MIN_SCORE = 6;
export const SCORE_BATCH_SIZE = 45;
/** Umbral blando (Tier "parcial"): sirve como atmósfera/grounding, no como ruido.
 * Incluye la banda 5-6 del rubro ("útil solo como atmósfera general") — mejor
 * darle ESO al generador que dejarlo sin ninguna ancla visual. */
const SOFT_MIN_SCORE = 5;
const MIN_WIDTH = 600;
const PROVIDER_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 25_000;
const UA = "HistoriaColombiana/1.0 (buscador de referencias editoriales)";

export interface ReferenceCandidate {
  provider: string;
  title: string;
  url: string;
  page?: string;
  width: number;
  height: number;
  query: string;
  /** Referer requerido para descargar (algunos CDN bloquean hotlinking, p. ej. artic). */
  referer?: string;
}

export interface ScoredReference extends ReferenceCandidate {
  score: number;
}

/** Referencia descargada, lista para adjuntar a images/edits. */
export interface DownloadedReference {
  buffer: Buffer;
  name: string;
  meta: {
    provider: string;
    title: string;
    url: string;
    page?: string;
    score: number;
  };
}

export interface ReferenceSearchResult {
  /** true = se descargaron ≥5 referencias RELEVANTES (ancla documental plena). */
  ok: boolean;
  /** Mejor esfuerzo: puede traer <5 (o 0) referencias en modo degradado. */
  refs: DownloadedReference[];
  /** Candidatos únicos tras filtro técnico (para diagnóstico). */
  considered: number;
  /** Relevantes según el LLM (score ≥ MIN_SCORE), antes de descargar. */
  relevant: number;
  /** Usables como atmósfera/grounding (score ≥ SOFT_MIN_SCORE). */
  usable: number;
  queries: string[];
}

export interface ReferenceContext {
  titulo: string;
  resumen: string;
  typology?: string;
  periodoLabel?: string;
  entidades?: string[];
  lugares?: string[];
  /** Tipo de entidad cuando aplica: Persona/Lugar/Concepto/Institución. */
  entityType?: string;
  /** Intención visual dominante para orientar queries y scoring. */
  visualIntent?: "retrato-publico" | "lugar-real" | "epoca-material" | "hecho-documental" | "conceptual";
  /** Nombres concretos que sí pueden existir como imagen pública, archivo, objeto o lugar. */
  visualAnchors?: string[];
}

function uniqueStrings(values: Array<string | null | undefined>, max = 14): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = (raw ?? "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

function plainRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function strList(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean)
    .slice(0, max);
}

function visualHintsFromMetadata(metadata: unknown): {
  personas: string[];
  lugares: string[];
  instituciones: string[];
  conceptos: string[];
} {
  const root = plainRecord(metadata);
  const atelier = plainRecord(root.atelier);
  const brief = plainRecord(atelier.brief);
  const entities = plainRecord(brief.entities);
  const taxonomy = plainRecord(atelier.taxonomy);
  return {
    personas: uniqueStrings([...strList(entities.personas), ...strList(taxonomy.entidadesPersonas)], 10),
    lugares: uniqueStrings([...strList(entities.lugares), ...strList(taxonomy.entidadesLugares)], 10),
    instituciones: uniqueStrings([...strList(entities.instituciones), ...strList(taxonomy.entidadesInstituciones)], 8),
    conceptos: uniqueStrings([...strList(entities.conceptos), ...strList(taxonomy.entidadesConceptos)], 8),
  };
}

export function referenceContextFromStructured(
  s: StructuredData,
  opts: { metadata?: unknown } = {}
): ReferenceContext {
  const periodoLabel = s.periodoCode ? (periodInfo(s.periodoCode)?.label ?? "") : "";
  const visualHints = visualHintsFromMetadata(opts.metadata);
  switch (s.typology) {
    case "hecho": {
      const protagonistas = uniqueStrings([...s.protagonistas, ...visualHints.personas], 10);
      const lugares = uniqueStrings([...s.lugares, ...visualHints.lugares], 8);
      return {
        titulo: s.titulo,
        resumen: s.resumen,
        typology: "hecho",
        periodoLabel,
        entidades: protagonistas,
        lugares,
        visualIntent: "hecho-documental",
        visualAnchors: uniqueStrings([s.titulo, ...protagonistas, ...lugares, s.fecha ?? undefined], 18),
      };
    }
    case "epoca": {
      const personas = uniqueStrings([...s.actores, ...visualHints.personas], 10);
      const lugares = uniqueStrings(visualHints.lugares, 8);
      const instituciones = uniqueStrings(visualHints.instituciones, 6);
      return {
        titulo: s.titulo,
        resumen: s.panorama || s.resumen,
        typology: "época",
        periodoLabel: s.rango ?? periodoLabel,
        entidades: uniqueStrings([...personas, ...instituciones], 14),
        lugares,
        visualIntent: "epoca-material",
        visualAnchors: uniqueStrings([
          ...personas,
          ...lugares,
          ...instituciones,
          ...s.hitos.map((h) => h.titulo),
          ...s.transformaciones,
          s.titulo,
          s.rango ?? undefined,
        ], 18),
      };
    }
    case "entidad":
      if (s.tipo === "Persona") {
        return {
          titulo: s.titulo,
          resumen: s.semblanza || s.resumen,
          typology: `entidad (${s.tipo})`,
          periodoLabel,
          entidades: s.relaciones,
          entityType: s.tipo,
          visualIntent: "retrato-publico",
          visualAnchors: uniqueStrings([
            `${s.titulo} portrait`,
            `${s.titulo} fotografía`,
            `${s.titulo} retrato`,
            s.titulo,
            ...s.roles,
            ...s.relaciones,
            ...s.hitos.map((h) => h.titulo),
          ]),
        };
      }
      return {
        titulo: s.titulo,
        resumen: s.semblanza || s.resumen,
        typology: `entidad (${s.tipo})`,
        periodoLabel,
        entidades: s.relaciones,
        entityType: s.tipo,
        visualIntent: s.tipo === "Lugar" ? "lugar-real" : "conceptual",
        visualAnchors: uniqueStrings([s.titulo, ...s.relaciones, ...s.roles, ...s.hitos.map((h) => h.titulo)]),
      };
    case "pregunta":
      return {
        titulo: s.titulo,
        resumen: s.tesis || s.resumen,
        typology: "pregunta",
        periodoLabel,
        entidades: s.temasRelacionados,
        visualIntent: "conceptual",
        visualAnchors: uniqueStrings([s.titulo, ...s.temasRelacionados]),
      };
  }
}

// ── 1. Queries por LLM ───────────────────────────────────────────────

const QUERY_SYSTEM = `Generas queries de BÚSQUEDA DE IMÁGENES para encontrar referencias visuales AUTÉNTICAS (fotos históricas, pinturas de época, piezas de museo, grabados, arquitectura real) sobre un tema de historia de Colombia / América Latina.

REGLA DE ORO — QUERIES CORTAS: van a motores de ARCHIVO (Wikimedia, museos) que hacen AND estricto de términos: una query de 6+ palabras devuelve CERO. Verificado: "José Prudencio Padilla" → 33 resultados; "batalla naval Lago de Maracaibo 1823 pintura grabado independencia" → 0.

Reglas:
- De 5 a 7 queries, cada una de 2 a 4 PALABRAS. Ni una más. Sin apilar sinónimos ("pintura grabado ilustración" en una query = veneno).
- Ancla en NOMBRES PROPIOS: persona, lugar, batalla, institución — solos o con UNA palabra de apoyo ("Riohacha", "batalla Lago Maracaibo", "Cartagena murallas").
- Mezcla español e inglés ("Spanish colonial ship", "naval battle painting").
- Escalera por capas: (1) sujeto exacto/persona/lugar, (2) retrato/foto/obra pública si es persona, (3) objetos/arquitectura/oficio/escena material, (4) atmósfera de época.
- Piensa en QUÉ EXISTE fotografiado o pintado: si el tema es anterior a la fotografía, busca pinturas, grabados, piezas de museo y los LUGARES reales.
- Para ÉPOCAS, NO te quedes en el nombre abstracto del período. Busca actores, hitos, oficios, arquitectura, transporte, vestuario, objetos y paisajes del período.
- Para PERSONAS, empieza por imágenes públicas conocidas de esa persona: retrato, foto, portrait, caricatura, estatua, archivo. Solo después amplía a lugares/objetos asociados.
- Para Google Images/Serper se permite una query algo más natural, pero sigue siendo corta y con nombres propios.

Devuelve JSON puro: {"queries":["...", "..."]}`;

/** Palabras función que no aportan al AND estricto de los motores de archivo.
 *  Solo se descartan cuando la query EXCEDE el tope; nunca vacían la query. */
const ARCHIVE_STOPWORDS = new Set([
  "la", "el", "los", "las", "un", "una", "unos", "unas", "lo",
  "de", "del", "y", "e", "o", "u", "en", "a", "al", "con", "su", "sus",
  "the", "of", "and", "or", "to", "in", "on", "at", "for", "an",
]);

function foldAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Recorta una query a N términos para los motores de ARCHIVO (AND estricto).
 * Dos mejoras sobre el corte ingenuo por los primeros N tokens:
 *  1. Quita paréntesis (años, aclaraciones) que gastan cupo sin ayudar a buscar.
 *  2. Si tras eso sigue excediendo el tope, prioriza palabras de CONTENIDO
 *     (nombres propios, sustantivos) sobre artículos y preposiciones.
 * Ejemplo real que motivó el cambio: "La toma y retoma del Palacio de Justicia
 * (1985)" cortado a 4 tokens daba "La toma y retoma" (basura, cero resultados);
 * ahora da "toma retoma Palacio Justicia". Las queries ya cortas van intactas.
 */
export function capForArchives(q: string, maxTokens = 4): string {
  const stripped = q.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const tokens = stripped.split(/\s+/).filter(Boolean);
  if (tokens.length <= maxTokens) return stripped;
  const content = tokens.filter((t) => !ARCHIVE_STOPWORDS.has(foldAccents(t)));
  const chosen = (content.length >= 1 ? content : tokens).slice(0, maxTokens);
  return chosen.join(" ");
}

/** Normaliza un ancla (lugar/persona) a una query de archivo limpia: quita el
 *  rol tras ":", las aclaraciones entre paréntesis y las comas de ciudad. */
function cleanAnchor(s: string): string {
  return (s ?? "")
    .split(":")[0]
    .replace(/\([^)]*\)/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Semillas deterministas antes de llamar al LLM: garantizan nombres propios y capas visuales. */
export function buildReferenceQuerySeeds(ctx: ReferenceContext): string[] {
  const seeds: string[] = [];
  const title = (ctx.titulo ?? "").trim();
  // Eventos (hecho): el lugar icónico suele SER el sujeto visual (el Palacio de
  // Justicia, la Plaza de Bolívar). Si no se busca de forma explícita, el desfile
  // de protagonistas copa las 9 queries y el generador nunca ve el edificio —
  // termina inventando un juzgado genérico. Se intercala lugar/persona con el
  // LUGAR por delante, y se limpian comas/paréntesis para el AND de archivo.
  if (ctx.visualIntent === "hecho-documental") {
    if (title) seeds.push(title);
    const places = (ctx.lugares ?? []).map(cleanAnchor).filter((s) => s.length > 2);
    const people = (ctx.entidades ?? []).map(cleanAnchor).filter((s) => s.length > 2);
    const topPlaces = places.slice(0, 4);
    const topPeople = people.slice(0, 3);
    for (let i = 0; i < Math.max(topPlaces.length, topPeople.length); i++) {
      if (topPlaces[i]) seeds.push(topPlaces[i]);
      if (topPeople[i]) seeds.push(topPeople[i]);
    }
    for (const p of places.slice(4)) seeds.push(p);
    for (const p of people.slice(3)) seeds.push(p);
    return uniqueStrings(seeds, 10);
  }
  if (ctx.visualIntent === "epoca-material") {
    const lugares = ctx.lugares ?? [];
    const lugarKeys = new Set(lugares.map((l) => l.toLowerCase()));
    const anchors = ctx.visualAnchors ?? [];
    const primaryAnchors = anchors.filter((a) => !lugarKeys.has(a.toLowerCase())).slice(0, 5);
    for (const anchor of primaryAnchors) seeds.push(anchor);
    for (const lugar of lugares.slice(0, 3)) seeds.push(lugar);
    if (title) seeds.push(title);
    for (const anchor of anchors) seeds.push(anchor);
    for (const entidad of ctx.entidades ?? []) seeds.push((entidad ?? "").split(":")[0].trim());
  } else if (ctx.visualIntent === "retrato-publico" && title) {
    seeds.push(title, `${title} portrait`, `${title} fotografía`, `${title} retrato`);
  } else if (title) {
    seeds.push(title);
  }

  if (ctx.visualIntent !== "epoca-material") {
    for (const anchor of ctx.visualAnchors ?? []) seeds.push(anchor);
    for (const lugar of ctx.lugares ?? []) seeds.push(lugar);
    for (const entidad of ctx.entidades ?? []) seeds.push((entidad ?? "").split(":")[0].trim());
  }

  if (ctx.visualIntent === "epoca-material") {
    seeds.push("Colombia arquitectura", "Colombia vestuario", "Colombia archivo");
  }
  if (ctx.visualIntent === "lugar-real" && title) {
    seeds.push(`${title} Colombia`, `${title} antiguo`);
  }

  return uniqueStrings(seeds, 12);
}

export async function generateReferenceQueries(ctx: ReferenceContext): Promise<string[]> {
  const lines = [
    `TEMA: ${ctx.titulo}`,
    ctx.resumen ? `RESUMEN: ${ctx.resumen}` : "",
    ctx.typology ? `TIPO DE PIEZA: ${ctx.typology}` : "",
    ctx.entityType ? `TIPO DE ENTIDAD: ${ctx.entityType}` : "",
    ctx.visualIntent ? `INTENCIÓN VISUAL: ${ctx.visualIntent}` : "",
    ctx.periodoLabel ? `PERÍODO: ${ctx.periodoLabel}` : "",
    ctx.visualAnchors?.length ? `ANCLAS VISUALES: ${ctx.visualAnchors.slice(0, 10).join(", ")}` : "",
    ctx.entidades?.length ? `ENTIDADES: ${ctx.entidades.slice(0, 6).join(", ")}` : "",
    ctx.lugares?.length ? `LUGARES: ${ctx.lugares.slice(0, 4).join(", ")}` : "",
  ].filter(Boolean);
  let queries: string[] = [];
  try {
    const raw = await callClaudeJson<{ queries?: unknown }>({
      model: SONNET_MODEL,
      system: QUERY_SYSTEM,
      user: `${lines.join("\n")}\n\nJSON:`,
      maxTokens: 600,
    });
    queries = Array.isArray(raw.queries)
      ? raw.queries.filter((q): q is string => typeof q === "string" && q.trim().length > 2).slice(0, 7)
      : [];
  } catch (e) {
    console.warn(`[refs] generación de queries falló: ${(e as Error).message}`);
  }
  // Anclas garantizadas: nombres propios y capas visuales por tipología, por
  // delante de lo del LLM. Esto evita que épocas/personas caigan en atmósferas
  // genéricas antes de intentar referentes públicos concretos.
  const anchors = buildReferenceQuerySeeds(ctx).filter((s) => s.length > 2);
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const q of [...anchors, ...queries]) {
    const key = q.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(q.trim());
    if (merged.length >= 9) break;
  }
  return merged;
}

// ── 2. Proveedores ───────────────────────────────────────────────────

async function jsonFetch(url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": UA,
      "Api-User-Agent": UA, // convención de Wikimedia para clientes automáticos
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function textFetch(url: string, init: RequestInit = {}): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": UA,
      "Api-User-Agent": UA,
      Accept: "text/html,application/xml,text/xml,*/*",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function firstString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    for (const item of v) {
      const s = firstString(item);
      if (s) return s;
    }
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return firstString(o.content ?? o.value ?? o["@value"] ?? o.url ?? o.id);
  }
  return "";
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function xmlDecode(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function metaContent(html: string, property: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i");
  return xmlDecode(html.match(re)?.[1] ?? "");
}

function upgradeIiifUrl(url: string, size = "1200,"): string {
  return url
    .replace(/^http:/, "https:")
    .replace(/\/full\/[^/]+\/0\/default\.(?:jpg|jpeg|webp|png)$/i, `/full/${size}/0/default.jpg`);
}

async function searchOpenverse(q: string): Promise<ReferenceCandidate[]> {
  const j = asRecord(
    await jsonFetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=20`)
  );
  const results = Array.isArray(j.results) ? j.results : [];
  return results.map((r) => {
    const o = asRecord(r);
    return {
      provider: `openverse:${typeof o.source === "string" ? o.source : "web"}`,
      title: typeof o.title === "string" ? o.title : "",
      url: typeof o.url === "string" ? o.url : "",
      page: typeof o.foreign_landing_url === "string" ? o.foreign_landing_url : undefined,
      width: typeof o.width === "number" ? o.width : 0,
      height: typeof o.height === "number" ? o.height : 0,
      query: q,
    };
  });
}

async function searchWikimedia(q: string): Promise<ReferenceCandidate[]> {
  const j = asRecord(
    await jsonFetch(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|size|mime&format=json`
    )
  );
  const pages = asRecord(asRecord(j.query).pages);
  const out: ReferenceCandidate[] = [];
  for (const p of Object.values(pages)) {
    const page = asRecord(p);
    const ii = asRecord(Array.isArray(page.imageinfo) ? page.imageinfo[0] : undefined);
    const mime = typeof ii.mime === "string" ? ii.mime : "";
    const url = typeof ii.url === "string" ? ii.url : "";
    if (!url || !/jpe?g|png/i.test(mime)) continue;
    out.push({
      provider: "wikimedia",
      title: String(page.title ?? "").replace(/^File:/, ""),
      url,
      page: typeof ii.descriptionurl === "string" ? ii.descriptionurl : undefined,
      width: typeof ii.width === "number" ? ii.width : 0,
      height: typeof ii.height === "number" ? ii.height : 0,
      query: q,
    });
  }
  return out;
}

async function searchMetMuseum(q: string): Promise<ReferenceCandidate[]> {
  const s = asRecord(
    await jsonFetch(
      `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(q)}&hasImages=true`
    )
  );
  const ids = (Array.isArray(s.objectIDs) ? s.objectIDs : []).slice(0, 5);
  const out: ReferenceCandidate[] = [];
  for (const id of ids) {
    try {
      const o = asRecord(
        await jsonFetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)
      );
      if (typeof o.primaryImage === "string" && o.primaryImage) {
        out.push({
          provider: "metmuseum",
          title: typeof o.title === "string" ? o.title : "",
          url: o.primaryImage,
          page: typeof o.objectURL === "string" ? o.objectURL : undefined,
          width: 1200,
          height: 1200,
          query: q,
        });
      }
    } catch {
      // pieza sin acceso: se ignora
    }
  }
  return out;
}

/** Google Images vía serper.dev — la capa "internet en general". Requiere llave. */
async function searchSerper(q: string): Promise<ReferenceCandidate[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];
  const j = asRecord(
    await jsonFetch("https://google.serper.dev/images", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q, num: 20 }),
    })
  );
  const images = Array.isArray(j.images) ? j.images : [];
  return images.map((r) => {
    const o = asRecord(r);
    return {
      provider: "google-images",
      title: typeof o.title === "string" ? o.title : "",
      url: typeof o.imageUrl === "string" ? o.imageUrl : "",
      page: typeof o.link === "string" ? o.link : undefined,
      width: typeof o.imageWidth === "number" ? o.imageWidth : 0,
      height: typeof o.imageHeight === "number" ? o.imageHeight : 0,
      query: q,
    };
  });
}

/** Library of Congress: ruidoso (libros digitalizados) pero robusto desde datacenters;
 * el scoring por LLM filtra el ruido. Complementa a los demás cuando bloquean IPs cloud. */
async function searchLoc(q: string): Promise<ReferenceCandidate[]> {
  const j = asRecord(
    await jsonFetch(`https://www.loc.gov/photos/?q=${encodeURIComponent(q)}&fo=json&c=12`)
  );
  const results = Array.isArray(j.results) ? j.results : [];
  const out: ReferenceCandidate[] = [];
  for (const r of results) {
    const o = asRecord(r);
    const imgs = Array.isArray(o.image_url) ? o.image_url : [];
    const last = imgs[imgs.length - 1];
    if (typeof last !== "string" || !last) continue;
    out.push({
      provider: "loc",
      title: typeof o.title === "string" ? o.title : "",
      url: last.startsWith("//") ? `https:${last}` : last,
      page: typeof o.url === "string" ? o.url : undefined,
      width: 800,
      height: 800,
      query: q,
    });
  }
  return out;
}

/** Internet Archive — sin llave. Bueno para libros escaneados, mapas, láminas y fotos históricas. */
async function searchInternetArchive(q: string): Promise<ReferenceCandidate[]> {
  const query = `${q} AND (mediatype:image OR mediatype:texts)`;
  const url =
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}` +
    "&fl[]=identifier&fl[]=title&fl[]=description&fl[]=date&rows=12&page=1&output=json";
  const j = asRecord(await jsonFetch(url));
  const docs = Array.isArray(asRecord(j.response).docs) ? (asRecord(j.response).docs as unknown[]) : [];
  const out: ReferenceCandidate[] = [];
  for (const raw of docs) {
    const o = asRecord(raw);
    const identifier = typeof o.identifier === "string" ? o.identifier : "";
    if (!identifier) continue;
    const title = firstString(o.title) || identifier;
    out.push({
      provider: "internetarchive",
      title,
      url: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
      page: `https://archive.org/details/${encodeURIComponent(identifier)}`,
      width: 800,
      height: 800,
      query: q,
    });
  }
  return out;
}

/** Wellcome Collection — sin llave. API pública + IIIF para obras digitalizadas abiertas. */
async function searchWellcome(q: string): Promise<ReferenceCandidate[]> {
  const j = asRecord(
    await jsonFetch(
      `https://api.wellcomecollection.org/catalogue/v2/works?query=${encodeURIComponent(q)}&include=images&limit=12`
    )
  );
  const results = Array.isArray(j.results) ? j.results : [];
  const out: ReferenceCandidate[] = [];
  for (const raw of results) {
    const o = asRecord(raw);
    const images = Array.isArray(o.images) ? o.images : [];
    const image = asRecord(images[0]);
    const imageId = typeof image.id === "string" ? image.id : "";
    if (!imageId) continue;
    const id = typeof o.id === "string" ? o.id : "";
    out.push({
      provider: "wellcome",
      title: typeof o.title === "string" ? stripHtml(o.title) : "",
      url: `https://iiif.wellcomecollection.org/image/${encodeURIComponent(imageId)}/full/1200,/0/default.jpg`,
      page: id ? `https://wellcomecollection.org/works/${encodeURIComponent(id)}` : undefined,
      width: 1200,
      height: 1200,
      query: q,
    });
  }
  return out;
}

/** Gallica / BnF — sin llave vía SRU + miniaturas/IIIF. Puede devolver challenge: en ese caso se silencia. */
async function searchGallica(q: string): Promise<ReferenceCandidate[]> {
  const xml = await textFetch(
    `https://gallica.bnf.fr/services/engine/search/sru?operation=searchRetrieve&version=1.2&query=${encodeURIComponent(
      `gallica all ${q}`
    )}&maximumRecords=10`
  );
  if (/Vérification de sécurité|Verification de securite|captcha/i.test(xml)) return [];
  const records = xml.split(/<srw:record>|<record>/i).slice(1);
  const seen = new Set<string>();
  const out: ReferenceCandidate[] = [];
  for (const record of records) {
    const ark = record.match(/ark:\/12148\/([a-z0-9]+)/i)?.[1];
    if (!ark || seen.has(ark)) continue;
    seen.add(ark);
    const title = xmlDecode(record.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1] ?? "");
    out.push({
      provider: "gallica",
      title: stripHtml(title) || `Gallica ${ark}`,
      // `.thumbnail` es más estable que IIIF para resultados heterogéneos (libros, mapas, láminas).
      url: `https://gallica.bnf.fr/ark:/12148/${ark}.thumbnail`,
      page: `https://gallica.bnf.fr/ark:/12148/${ark}`,
      width: 800,
      height: 800,
      query: q,
    });
  }
  return out;
}

/** Art Institute of Chicago — sin llave, imágenes IIIF. Fuerte en pintura de época. */
async function searchArtInstitute(q: string): Promise<ReferenceCandidate[]> {
  const j = asRecord(
    await jsonFetch(
      `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&limit=12&fields=id,title,image_id`
    )
  );
  const iiifRaw = asRecord(j.config).iiif_url;
  const iiif = typeof iiifRaw === "string" ? iiifRaw : "https://www.artic.edu/iiif/2";
  const data = Array.isArray(j.data) ? j.data : [];
  const out: ReferenceCandidate[] = [];
  for (const r of data) {
    const o = asRecord(r);
    if (typeof o.image_id !== "string" || !o.image_id) continue; // sin imagen digitalizada
    out.push({
      provider: "artic",
      title: typeof o.title === "string" ? o.title : "",
      url: `${iiif}/${o.image_id}/full/1200,/0/default.jpg`,
      page: typeof o.id === "number" ? `https://www.artic.edu/artworks/${o.id}` : undefined,
      width: 1200,
      height: 1200,
      query: q,
      referer: "https://www.artic.edu/", // su CDN IIIF exige Referer (si no, 403)
    });
  }
  return out;
}

/** Cleveland Museum of Art — Open Access, sin llave. Arte y artefactos de época. */
async function searchCleveland(q: string): Promise<ReferenceCandidate[]> {
  const j = asRecord(
    await jsonFetch(
      `https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(q)}&limit=12&has_image=1`
    )
  );
  const data = Array.isArray(j.data) ? j.data : [];
  const out: ReferenceCandidate[] = [];
  for (const r of data) {
    const o = asRecord(r);
    const images = asRecord(o.images);
    const web = asRecord(images.web);
    const print = asRecord(images.print);
    const url =
      (typeof web.url === "string" && web.url) || (typeof print.url === "string" && print.url) || "";
    if (!url) continue;
    out.push({
      provider: "cleveland",
      title: typeof o.title === "string" ? o.title : "",
      url,
      page: typeof o.url === "string" ? o.url : undefined,
      width: 1000,
      height: 1000,
      query: q,
    });
  }
  return out;
}

function rijksName(o: Record<string, unknown>): string {
  const ids = Array.isArray(o.identified_by) ? o.identified_by : [];
  for (const raw of ids) {
    const item = asRecord(raw);
    if (String(item.type ?? "").toLowerCase() === "name" && typeof item.content === "string") return item.content;
  }
  return firstString(o.identified_by);
}

function rijksAccessPoint(o: Record<string, unknown>): string {
  const subjects = Array.isArray(o.subject_of) ? o.subject_of : [];
  for (const rawSubject of subjects) {
    const subject = asRecord(rawSubject);
    const carriers = Array.isArray(subject.digitally_carried_by) ? subject.digitally_carried_by : [];
    for (const rawCarrier of carriers) {
      const carrier = asRecord(rawCarrier);
      const points = Array.isArray(carrier.access_point) ? carrier.access_point : [];
      for (const point of points) {
        const id = firstString(point);
        if (/rijksmuseum\.nl\/.+collectie/i.test(id)) return id;
      }
    }
  }
  return "";
}

/** Rijksmuseum Data Services — sin llave. Útil para objetos, mapas, grabados y cultura material. */
async function searchRijksmuseum(q: string): Promise<ReferenceCandidate[]> {
  const j = asRecord(
    await jsonFetch(
      `https://data.rijksmuseum.nl/search/collection?title=${encodeURIComponent(q)}&imageAvailable=true`
    )
  );
  const items = Array.isArray(j.orderedItems) ? j.orderedItems.slice(0, 5) : [];
  const out: ReferenceCandidate[] = [];
  for (const raw of items) {
    const itemId = firstString(raw);
    if (!itemId) continue;
    try {
      const detail = asRecord(await jsonFetch(itemId, { headers: { Accept: "application/json" } }));
      const page = rijksAccessPoint(detail);
      if (!page) continue;
      const html = await textFetch(page);
      const img = metaContent(html, "og:image");
      if (!img) continue;
      out.push({
        provider: "rijksmuseum",
        title: rijksName(detail),
        url: upgradeIiifUrl(img),
        page,
        width: 1024,
        height: 1024,
        query: q,
        referer: "https://www.rijksmuseum.nl/",
      });
    } catch {
      // Algunos IDs no tienen representación pública; se ignoran.
    }
  }
  return out;
}

/** Europeana — agrega archivos europeos (mucho material colonial y de ultramar).
 * Como Google, es un buscador amplio: recibe la query completa. Requiere llave. */
async function searchEuropeana(q: string): Promise<ReferenceCandidate[]> {
  const key = process.env.EUROPEANA_API_KEY;
  if (!key) return [];
  const j = asRecord(
    await jsonFetch(
      `https://api.europeana.eu/record/v2/search.json?wskey=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}&qf=TYPE%3AIMAGE&media=true&thumbnail=true&rows=20`
    )
  );
  const items = Array.isArray(j.items) ? j.items : [];
  const out: ReferenceCandidate[] = [];
  for (const r of items) {
    const o = asRecord(r);
    const shown = Array.isArray(o.edmIsShownBy) ? o.edmIsShownBy[0] : undefined;
    const preview = Array.isArray(o.edmPreview) ? o.edmPreview[0] : undefined;
    const url = (typeof shown === "string" && shown) || (typeof preview === "string" && preview) || "";
    if (!url) continue;
    const title = Array.isArray(o.title) ? o.title[0] : o.title;
    out.push({
      provider: "europeana",
      title: typeof title === "string" ? title : "",
      url,
      page: typeof o.guid === "string" ? o.guid : undefined,
      width: 800,
      height: 800,
      query: q,
    });
  }
  return out;
}

/** Smithsonian Open Access — fondo enorme, mucho de América Latina. Requiere llave. */
async function searchSmithsonian(q: string): Promise<ReferenceCandidate[]> {
  const key = process.env.SMITHSONIAN_API_KEY;
  if (!key) return [];
  const j = asRecord(
    await jsonFetch(
      `https://api.si.edu/openaccess/api/v1.0/search?q=${encodeURIComponent(q)}&rows=15&api_key=${encodeURIComponent(key)}`
    )
  );
  const rows = Array.isArray(asRecord(j.response).rows) ? (asRecord(j.response).rows as unknown[]) : [];
  const out: ReferenceCandidate[] = [];
  for (const r of rows) {
    const o = asRecord(r);
    const dnr = asRecord(asRecord(o.content).descriptiveNonRepeating);
    const list = Array.isArray(asRecord(dnr.online_media).media) ? (asRecord(dnr.online_media).media as unknown[]) : [];
    const first = asRecord(list[0]);
    const url =
      (typeof first.content === "string" && first.content) ||
      (typeof first.thumbnail === "string" && first.thumbnail) ||
      "";
    if (!url) continue;
    out.push({
      provider: "smithsonian",
      title: typeof o.title === "string" ? o.title : "",
      url,
      page: typeof dnr.record_link === "string" ? dnr.record_link : undefined,
      width: 1000,
      height: 1000,
      query: q,
    });
  }
  return out;
}

const PROVIDERS: Array<{
  name: string;
  fn: (q: string) => Promise<ReferenceCandidate[]>;
  /** true = motor de archivo con AND estricto: recibe la query recortada (≤4 términos). */
  archive: boolean;
}> = [
  { name: "openverse", fn: searchOpenverse, archive: true },
  { name: "wikimedia", fn: searchWikimedia, archive: true },
  { name: "metmuseum", fn: searchMetMuseum, archive: true },
  { name: "artic", fn: searchArtInstitute, archive: true },
  { name: "cleveland", fn: searchCleveland, archive: true },
  { name: "loc", fn: searchLoc, archive: true },
  { name: "internetarchive", fn: searchInternetArchive, archive: false },
  { name: "wellcome", fn: searchWellcome, archive: false },
  { name: "gallica", fn: searchGallica, archive: false },
  { name: "rijksmuseum", fn: searchRijksmuseum, archive: false },
  { name: "smithsonian", fn: searchSmithsonian, archive: true },
  // Buscadores amplios (relevancia, no AND estricto): reciben la query completa.
  { name: "europeana", fn: searchEuropeana, archive: false },
  { name: "serper", fn: searchSerper, archive: false },
];

export const REFERENCE_PROVIDER_NAMES = PROVIDERS.map((p) => p.name);

function dedupeCandidates(all: ReferenceCandidate[]): ReferenceCandidate[] {
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const out: ReferenceCandidate[] = [];
  for (const c of all) {
    if (!c.url || c.width < MIN_WIDTH) continue;
    const cleanUrl = c.url.split("?")[0].toLowerCase();
    const urlKey = /\/iiif\/|iiif\.|\/full\/[^/]+\/0\/default\.(?:jpg|jpeg|webp|png)$/i.test(cleanUrl)
      ? cleanUrl
      : (cleanUrl.split("/").pop() ?? cleanUrl);
    if (seenUrl.has(urlKey)) continue;
    // Misma FOTO específica republicada en varias URLs/tamaños (típico de
    // Flickr vía Openverse): colapsa por título normalizado para no gastar los
    // 7 cupos de referencia en la misma imagen. Verificado con el Palacio de
    // Justicia: 5 copias de "28 años sin los desaparecidos" copaban el set.
    // Los títulos vacíos o muy cortos NO se colapsan (perderíamos fotos válidas).
    const titleKey = foldAccents(c.title).replace(/[^a-z0-9]+/g, " ").trim();
    const dedupeTitle = titleKey.length >= 12;
    if (dedupeTitle && seenTitle.has(titleKey)) continue;
    seenUrl.add(urlKey);
    if (dedupeTitle) seenTitle.add(titleKey);
    out.push(c);
  }
  return out;
}

export async function searchAllProviders(queries: string[]): Promise<ReferenceCandidate[]> {
  const all: ReferenceCandidate[] = [];
  // Diagnóstico por proveedor: sin esto, un bloqueo de IPs de datacenter (o un
  // cambio de API) se ve como "0 candidatas" sin explicación en los logs.
  const failures: Record<string, number> = {};
  const empties: Record<string, number> = {};
  for (const q of queries) {
    const settled = await Promise.allSettled(
      PROVIDERS.map((p) => p.fn(p.archive ? capForArchives(q) : q))
    );
    settled.forEach((s, i) => {
      const name = PROVIDERS[i].name;
      if (s.status === "fulfilled") {
        all.push(...s.value);
        if (s.value.length === 0) empties[name] = (empties[name] ?? 0) + 1;
      } else {
        failures[name] = (failures[name] ?? 0) + 1;
        console.warn(
          `[refs] ${name} falló con "${q}": ${(s.reason as Error)?.message?.slice(0, 160) ?? s.reason}`
        );
      }
    });
  }
  const resumen = PROVIDERS.map(
    (p) => `${p.name}=${failures[p.name] ? `ERR×${failures[p.name]}` : `ok(${empties[p.name] ?? 0} vacías)`}`
  ).join(" · ");
  console.log(`[refs] proveedores: ${resumen} · candidatas brutas: ${all.length}`);
  return dedupeCandidates(all);
}

// ── 3. Puntuación de relevancia por LLM ──────────────────────────────

const SCORE_SYSTEM = `Puntúas candidatos a REFERENCIA VISUAL para ilustrar una pieza de historia de Colombia. Ves título, fuente, página y la query que lo encontró.

Puntúa 0–10 cada candidato según su utilidad como ANCLA DOCUMENTAL para un ilustrador:
- 9–10: material de época del tema exacto (foto de prensa, pintura, pieza de museo, el lugar real).
- 7–8: del tema o su contexto directo (el lugar hoy, la actividad exacta, vestuario/objetos del período).
- 5–6: útil solo como atmósfera general (paisaje o arquitectura de la región/época, actividad análoga en otra geografía).
- 0–4: ruido — logos, mapas genéricos, portadas de libros, páginas de texto, temas ajenos, arte moderno sin relación.

Reglas de juicio:
- Si la intención es retrato-publico, una foto/retrato/caricatura/estatua/archivo del personaje exacto puntúa 9–10; un personaje distinto o "gente de la época" puntúa bajo.
- Si la pieza es una época, premia referentes materiales variados: edificios, oficios, transportes, vestuario, prensa/archivo SIN depender de texto legible, objetos de museo y paisajes reales.
- Prefiere archivos públicos, museos, bibliotecas, Commons/Openverse, Google Images con página de archivo/museo/prensa; baja puntaje a thumbnails, logos, libros, PDFs o páginas sin imagen clara.
- Sé escéptico: un título ambiguo sin señales del tema puntúa bajo.
Devuelve JSON puro: {"scores":[{"i":0,"score":7},...]} — un item por candidato, mismo orden.`;

export async function scoreCandidates(
  candidates: ReferenceCandidate[],
  ctx: ReferenceContext
): Promise<ScoredReference[]> {
  if (candidates.length === 0) return [];
  const scored: ScoredReference[] = [];
  for (const batch of buildCandidateScoreBatches(candidates)) {
    try {
      scored.push(...(await scoreCandidateBatch(batch, ctx)));
    } catch (e) {
      console.warn(`[refs] scoring de lote (${batch.length} candidatas) falló: ${(e as Error).message}`);
      scored.push(...batch.map((c) => ({ ...c, score: 0 })));
    }
  }
  return scored.sort((a, b) => b.score - a.score);
}

export function buildCandidateScoreBatches<T>(
  candidates: T[],
  batchSize = SCORE_BATCH_SIZE
): T[][] {
  const safeSize = Math.max(1, Math.trunc(batchSize));
  const batches: T[][] = [];
  for (let i = 0; i < candidates.length; i += safeSize) {
    batches.push(candidates.slice(i, i + safeSize));
  }
  return batches;
}

async function scoreCandidateBatch(
  candidates: ReferenceCandidate[],
  ctx: ReferenceContext
): Promise<ScoredReference[]> {
  const list = candidates
    .map(
      (c, i) =>
        `${i}. [${c.provider}] "${c.title || "(sin título)"}" (query: ${c.query}; page: ${
          c.page ?? "n/a"
        }; size: ${c.width}x${c.height})`
    )
    .join("\n");
  const user = [
    `PIEZA: ${ctx.titulo} — ${ctx.resumen}`,
    ctx.typology ? `TIPO: ${ctx.typology}` : "",
    ctx.entityType ? `TIPO DE ENTIDAD: ${ctx.entityType}` : "",
    ctx.visualIntent ? `INTENCIÓN VISUAL: ${ctx.visualIntent}` : "",
    ctx.periodoLabel ? `PERÍODO: ${ctx.periodoLabel}` : "",
    ctx.visualAnchors?.length ? `ANCLAS VISUALES: ${ctx.visualAnchors.slice(0, 10).join(", ")}` : "",
    `CANDIDATOS:\n${list}`,
    "",
    "JSON:",
  ]
    .filter(Boolean)
    .join("\n");
  const raw = await callClaudeJson<{ scores?: unknown }>({
    model: SONNET_MODEL,
    system: SCORE_SYSTEM,
    user,
    maxTokens: 3000,
  });
  const scores = new Map<number, number>();
  if (Array.isArray(raw.scores)) {
    for (const s of raw.scores) {
      const o = asRecord(s);
      const i = typeof o.i === "number" ? o.i : -1;
      const score = typeof o.score === "number" ? o.score : 0;
      if (i >= 0 && i < candidates.length) scores.set(i, score);
    }
  }
  return candidates
    .map((c, i) => ({ ...c, score: scores.get(i) ?? 0 }))
    .sort((a, b) => b.score - a.score);
}

// ── 4. Descarga + normalización ──────────────────────────────────────

async function downloadOne(ref: ScoredReference, index: number): Promise<DownloadedReference | null> {
  try {
    const res = await fetch(ref.url, {
      headers: {
        "User-Agent": UA,
        ...(ref.referer ? { Referer: ref.referer } : {}), // CDN con anti-hotlink (artic)
      },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const raw = Buffer.from(await res.arrayBuffer());
    if (raw.length < 10_000) return null; // miniatura o placeholder
    const buffer = await sharp(raw)
      .resize(1568, 1568, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    return {
      buffer,
      name: `ref-${index + 1}.jpg`,
      meta: { provider: ref.provider, title: ref.title, url: ref.url, page: ref.page, score: ref.score },
    };
  } catch {
    return null;
  }
}

async function downloadReferences(scored: ScoredReference[], max: number): Promise<DownloadedReference[]> {
  const out: DownloadedReference[] = [];
  // Descarga secuencial con exceso de candidatos: si una URL falla, entra la siguiente.
  for (const ref of scored) {
    if (out.length >= max) break;
    const dl = await downloadOne(ref, out.length);
    if (dl) out.push(dl);
  }
  return out;
}

// ── 5. Orquestación ──────────────────────────────────────────────────

const BROADEN_SYSTEM = `Las queries anteriores no encontraron suficientes referencias visuales. Genera 3 queries MÁS AMPLIAS para el mismo tema: la actividad genérica, el tipo de lugar, el período en la región. CORTAS: 2-4 palabras cada una, sin apilar sinónimos (los motores de archivo hacen AND estricto). Español y/o inglés. JSON puro: {"queries":["..."]}`;

export async function searchReferences(ctx: ReferenceContext): Promise<ReferenceSearchResult> {
  const queries = await generateReferenceQueries(ctx);

  let candidates = await searchAllProviders(queries);
  let scored = await scoreCandidates(candidates, ctx);
  let relevant = scored.filter((s) => s.score >= MIN_SCORE);

  // Segunda pasada con queries más amplias si no se llegó al piso.
  if (relevant.length < MIN_RELEVANT_REFS) {
    try {
      const raw = await callClaudeJson<{ queries?: unknown }>({
        model: SONNET_MODEL,
        system: BROADEN_SYSTEM,
        user: `TEMA: ${ctx.titulo} — ${ctx.resumen}\nQUERIES YA USADAS: ${queries.join(" · ")}\n\nJSON:`,
        maxTokens: 400,
      });
      const broader = Array.isArray(raw.queries)
        ? raw.queries.filter((q): q is string => typeof q === "string" && q.trim().length > 2).slice(0, 3)
        : [];
      if (broader.length) {
        queries.push(...broader);
        const extra = await searchAllProviders(broader);
        const known = new Set(candidates.map((c) => c.url));
        const fresh = extra.filter((c) => !known.has(c.url));
        if (fresh.length) {
          const freshScored = await scoreCandidates(fresh, ctx);
          scored = [...scored, ...freshScored].sort((a, b) => b.score - a.score);
          candidates = [...candidates, ...fresh];
          relevant = scored.filter((s) => s.score >= MIN_SCORE);
        }
      }
    } catch (e) {
      console.warn(`[refs] ampliación de queries falló: ${(e as Error).message}`);
    }
  }

  // Descarga el MEJOR material disponible, sin abandonar si no se llega al piso.
  // - Con ≥5 relevantes: solo material documental (preserva la calidad del Tier 1).
  // - Si no: se echa mano de la capa de atmósfera (score ≥ SOFT_MIN_SCORE) para
  //   que el generador tenga AL MENOS algo de ancla visual. El caller decide el
  //   modo (edits con refs vs. generación desde el texto) según lo que baje.
  const usable = scored.filter((s) => s.score >= SOFT_MIN_SCORE);
  const pool = relevant.length >= MIN_RELEVANT_REFS ? relevant : usable;
  const refs = await downloadReferences(pool, MAX_REFS_TO_ATTACH);
  // Las descargas pueden fallar (hotlink muerto): el piso se evalúa sobre lo bajado.
  const relevantDownloaded = refs.filter((r) => r.meta.score >= MIN_SCORE).length;
  return {
    ok: relevantDownloaded >= MIN_RELEVANT_REFS,
    refs,
    considered: candidates.length,
    relevant: relevant.length,
    usable: usable.length,
    queries,
  };
}
