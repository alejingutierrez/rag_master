/**
 * Búsqueda de imágenes de archivo para las escenas de video — REUSA el buscador
 * del Taller (`reference-search.ts`, que ya barre Met, Art Institute, Cleveland,
 * Library of Congress, archive.org, Openverse, Wikimedia, Wellcome…). En vez de
 * usarlas como ancla de gpt-image, aquí las usamos DIRECTO en el video.
 *
 * No genera nada: solo encuentra y descarga archivo real (mezcla imagen + tipo).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { searchAllProviders, capForArchives, searchReferences, scoreCandidates } from "../atelier/reference-search";
import type { TypographicScore } from "./score";

export interface SceneImageCandidate {
  url: string;
  title: string;
  provider: string;
  page?: string;
  width: number;
  height: number;
  referer?: string;
}

/** Busca candidatos de archivo para un tema/entidad y los rankea por resolución. */
export async function searchSceneImages(query: string, opts: { minWidth?: number; max?: number } = {}): Promise<SceneImageCandidate[]> {
  const minWidth = opts.minWidth ?? 700;
  const queries = Array.from(new Set([query, capForArchives(query, 3), capForArchives(query, 4)].filter(Boolean)));
  const cands = await searchAllProviders(queries);
  const seen = new Set<string>();
  const out: SceneImageCandidate[] = [];
  for (const c of cands) {
    if (!c.url || seen.has(c.url)) continue;
    if ((c.width || 0) < minWidth) continue;
    seen.add(c.url);
    out.push({ url: c.url, title: c.title, provider: c.provider, page: c.page, width: c.width, height: c.height, referer: c.referer });
  }
  out.sort((a, b) => b.width * b.height - a.width * a.height);
  return out.slice(0, opts.max ?? 14);
}

/** Descarga un candidato a disco (respeta el referer que exige algún CDN). */
export async function downloadImage(c: SceneImageCandidate, dest: string): Promise<void> {
  const headers: Record<string, string> = { "User-Agent": "HistoriaColombianaBot/1.0 (educational history project)" };
  if (c.referer) headers.Referer = c.referer;
  const res = await fetch(c.url, { headers });
  if (!res.ok) throw new Error(`${res.status} al bajar ${c.url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

/** Pie de foto / atribución legible para la escena. */
export function attribution(c: SceneImageCandidate): string {
  return `${c.provider}${c.title ? " · " + c.title.slice(0, 48) : ""}`;
}

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "img";

/**
 * Resuelve las CONSULTAS de imagen de una partitura a archivo real (searchReferences
 * con scoring LLM), descargando a `destDir`. Respeta la cota del tipo y CAE a puro
 * tipo (borra el campo) donde no hay buena imagen. Muta el score. Devuelve nº usado.
 */
export async function resolveScoreImages(
  score: TypographicScore,
  cap: number,
  destDir: string,
  onImg?: (msg: string) => void
): Promise<number> {
  const scenes = score.scenes as unknown as Array<Record<string, unknown>>;
  if (cap <= 0) {
    for (const s of scenes) { delete s.image; delete s.imageFill; }
    return 0;
  }
  mkdirSync(destDir, { recursive: true });
  const cache = new Map<string, string | null>();
  let used = 0;
  const resolve = async (q: string): Promise<string | null> => {
    if (cache.has(q)) return cache.get(q)!;
    if (used >= cap) return null;
    try {
      const res = await searchReferences({ titulo: q, resumen: q, visualAnchors: [q], visualIntent: "hecho-documental" });
      const ref = res.refs[0];
      if (!ref) { cache.set(q, null); return null; }
      const name = `q-${slug(q)}.jpg`;
      writeFileSync(join(destDir, name), ref.buffer);
      const rel = `img/${name}`;
      cache.set(q, rel); used++;
      onImg?.(`"${q}" → ${name} [${ref.meta.provider} score=${ref.meta.score}]`);
      return rel;
    } catch { cache.set(q, null); return null; }
  };
  for (const s of scenes) {
    for (const f of ["image", "imageFill"] as const) {
      const q = s[f];
      if (typeof q === "string" && !q.startsWith("img/")) {
        const p = await resolve(q);
        if (p) s[f] = p; else delete s[f];
      }
    }
  }
  return used;
}

/**
 * PRODUCCIÓN: resuelve las consultas de imagen a URLs de archivo (públicas), sin
 * descargar a disco — funciona en App Runner (Player) y en el render (Remotion Img
 * carga URLs). searchAllProviders + scoreCandidates (scoring LLM). Cae a puro tipo
 * donde no hay imagen relevante. Muta el score. Devuelve nº de imágenes usadas.
 */
export async function resolveScoreImagesToUrls(
  score: TypographicScore,
  cap: number,
  onImg?: (msg: string) => void
): Promise<number> {
  const scenes = score.scenes as unknown as Array<Record<string, unknown>>;
  if (cap <= 0) {
    for (const s of scenes) { delete s.image; delete s.imageFill; }
    return 0;
  }
  const cache = new Map<string, string | null>();
  let used = 0;
  const resolve = async (q: string): Promise<string | null> => {
    if (cache.has(q)) return cache.get(q)!;
    if (used >= cap) return null;
    try {
      const ctx = { titulo: q, resumen: q, visualAnchors: [q], visualIntent: "hecho-documental" as const };
      const queries = Array.from(new Set([q, capForArchives(q, 3)].filter(Boolean)));
      const cands = await searchAllProviders(queries);
      const scored = await scoreCandidates(cands, ctx);
      const top = scored.find((c) => (c.score ?? 0) >= 6 && (c.width ?? 0) >= 700);
      if (!top) { cache.set(q, null); return null; }
      cache.set(q, top.url); used++;
      onImg?.(`"${q}" → ${top.provider} score=${top.score}`);
      return top.url;
    } catch { cache.set(q, null); return null; }
  };
  for (const s of scenes) {
    for (const f of ["image", "imageFill"] as const) {
      const val = s[f];
      if (typeof val === "string" && !/^https?:\/\//.test(val) && !val.startsWith("img/")) {
        const url = await resolve(val);
        if (url) s[f] = url; else delete s[f];
      }
    }
  }
  return used;
}
