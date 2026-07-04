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
  /** slug de cualquier variante (o del canónico) → `${type}:${slug}`. Primera gana. */
  variantSlugToKey: Map<string, string>;
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
  for (const e of entities) {
    const k = entityKey(e.type, e.slug);
    byKey.set(k, e);
    const surfaces = new Set<string>([e.slug, ...e.variants.map((v) => slugify(v))]);
    for (const vs of surfaces) if (vs && !variantSlugToKey.has(vs)) variantSlugToKey.set(vs, k);
  }
  cache = { entities, byKey, variantSlugToKey, generatedAt: file?.generatedAt ?? null };
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
