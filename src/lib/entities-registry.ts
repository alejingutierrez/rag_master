/**
 * Lector server-side del REGISTRO CANÓNICO de entidades.
 *
 * El artefacto `src/data/entities.json` (generado por scripts/mine-entities.mts)
 * trae, por entidad canónica, su nombre + variantes, menciones en el corpus y su
 * ÉPOCA derivada (primaria + set denoised + año). Es la fuente de verdad de:
 *   - la época "hogar" de cada entidad (arregla los filtros: las personas ya no
 *     heredan la unión ruidosa de todos los períodos donde se las menciona);
 *   - el nombre canónico para mostrar y el conjunto de variantes para casar
 *     menciones en prosa (auto-enlace) y taxonomías de piezas.
 *
 * Se lee de disco UNA vez por proceso (cacheado) → reemplaza el escaneo de ~8 s
 * del corpus que se hacía por request. Cero BD.
 */
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { slugify } from "@/lib/typology-schemas";

export type EntityType = "persona" | "lugar" | "idea";

export interface RegistryEntity {
  type: EntityType;
  slug: string;
  name: string;
  variants: string[];
  mentions: number;
  /** Época "hogar" (moda del corpus). Para orden/etiqueta, no para el filtro. */
  periodoCode: string | null;
  /** Épocas denoised — la BASE del filtro (una entidad transversal filtra en varias). */
  periods: string[];
  periodoOrden: number;
  anio: number | null;
}

interface RegistryFile {
  generatedAt: string;
  minMentions: number;
  count: number;
  entities: RegistryEntity[];
}

export interface EntityRegistry {
  entities: RegistryEntity[];
  /** `${type}:${slug}` → entidad. */
  byKey: Map<string, RegistryEntity>;
  /**
   * slug de cualquier variante, alias curado o nombre canónico →
   * `${type}:${slug}`. Primera gana.
   */
  variantSlugToKey: Map<string, string>;
  /** `${type}:${slug}` canónico → slugs canónico, variantes y aliases curados. */
  slugsByKey: Map<string, Set<string>>;
  /** Entidades excluidas por curación aunque exista una pieza publicada con ese slug. */
  hiddenKeys: Set<string>;
  generatedAt: string | null;
}

export function entityKey(type: EntityType, slug: string): string {
  return `${type}:${slug}`;
}

let cache: EntityRegistry | null = null;

/** Carga (y cachea) el registro. Tolerante: si el archivo falta, registro vacío. */
export async function loadEntityRegistry(): Promise<EntityRegistry> {
  if (cache) return cache;
  let file: RegistryFile | null = null;
  try {
    const raw = await readFile(join(process.cwd(), "src", "data", "entities.json"), "utf8");
    file = JSON.parse(raw) as RegistryFile;
  } catch (err) {
    console.error("[entities-registry] no se pudo leer entities.json:", (err as Error).message);
  }
  const entities = file?.entities ?? [];
  const byKey = new Map<string, RegistryEntity>();
  const variantSlugToKey = new Map<string, string>();
  const hiddenKeys = new Set<string>();
  for (const e of entities) {
    const k = entityKey(e.type, e.slug);
    byKey.set(k, e);
    const surfaces = new Set<string>([e.slug, ...e.variants.map((v) => slugify(v))]);
    for (const vs of surfaces) if (vs && !variantSlugToKey.has(vs)) variantSlugToKey.set(vs, k);
  }

  // `entity-overrides.json` ya contiene la curación de duplicados realizada
  // por nombre ("QA: duplicado de ..."). Antes solo ocultábamos la variante:
  // el catálogo dinámico de /api/entities no consumía esa decisión y volvía a
  // ofrecerla para producir. Convertimos esas entradas en alias resolubles del
  // registro canónico, sin mantener una segunda entidad.
  try {
    const raw = await readFile(
      join(process.cwd(), "src", "data", "entity-overrides.json"),
      "utf8",
    );
    const overrides = JSON.parse(raw) as Record<
      string,
      { hide?: unknown; _motivo?: unknown }
    >;
    for (const [aliasKey, override] of Object.entries(overrides)) {
      if (aliasKey.startsWith("_")) continue;
      if (override?.hide === true) hiddenKeys.add(aliasKey);
      const reason = typeof override?._motivo === "string" ? override._motivo : "";
      const targetName = reason.match(/^QA:\s*duplicado de\s+"([^"]+)"$/i)?.[1];
      if (!targetName) continue;
      const colon = aliasKey.indexOf(":");
      if (colon < 1) continue;
      const type = aliasKey.slice(0, colon) as EntityType;
      const aliasSlug = aliasKey.slice(colon + 1);
      const targetKey = entityKey(type, slugify(targetName));
      if (!byKey.has(targetKey) || !aliasSlug) continue;
      variantSlugToKey.set(aliasSlug, targetKey);
    }
  } catch (err) {
    console.error(
      "[entities-registry] no se pudieron cargar aliases de entity-overrides.json:",
      (err as Error).message,
    );
  }
  const slugsByKey = new Map<string, Set<string>>();
  for (const [surfaceSlug, canonicalKey] of variantSlugToKey) {
    const slugs = slugsByKey.get(canonicalKey) ?? new Set<string>();
    slugs.add(surfaceSlug);
    slugsByKey.set(canonicalKey, slugs);
  }
  cache = {
    entities,
    byKey,
    variantSlugToKey,
    slugsByKey,
    hiddenKeys,
    generatedAt: file?.generatedAt ?? null,
  };
  return cache;
}

/**
 * Resuelve una entidad por slug (o variante), opcionalmente restringida a un tipo.
 * Prefiere el match directo `type:slug`; luego variante; luego el mismo slug en
 * cualquier tipo (desempata por menciones). Maneja colisiones como
 * "bolivar" (persona Simón Bolívar vs. departamento de Bolívar).
 */
export async function findRegistryEntity(
  slug: string,
  type?: EntityType,
): Promise<RegistryEntity | null> {
  const reg = await loadEntityRegistry();
  if (type) {
    const direct = reg.byKey.get(entityKey(type, slug));
    if (direct) return direct;
  }
  const viaVariant = reg.variantSlugToKey.get(slug);
  if (viaVariant) {
    const e = reg.byKey.get(viaVariant);
    if (e && (!type || e.type === type)) return e;
  }
  let best: RegistryEntity | null = null;
  for (const e of reg.entities) {
    if (e.slug !== slug || (type && e.type !== type)) continue;
    if (!best || e.mentions > best.mentions) best = e;
  }
  return best;
}
