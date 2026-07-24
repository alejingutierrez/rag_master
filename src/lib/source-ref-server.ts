import "server-only";

import { findRegistryEntity, type EntityType } from "@/lib/entities-registry";
import {
  entidadKey,
  fichaFormatForKind,
  type SourceRef,
} from "@/lib/source-ref";
import type { AtelierFormatId } from "@/lib/atelier-formats";
export { validateEntitySourceContract } from "@/lib/entity-source-contract";

const ENTITY_SOURCE_TYPES: Record<string, EntityType> = {
  person: "persona",
  place: "lugar",
  concept: "idea",
};

/** Canonicaliza la llave de una entidad antes de medir o producirla. */
export async function canonicalizeSourceRef(ref: SourceRef | null): Promise<SourceRef | null> {
  if (!ref || ref.kind !== "entidad") return ref;
  const [rawType, ...slugParts] = ref.key.split(":");
  const type = ENTITY_SOURCE_TYPES[rawType];
  const slug = slugParts.join(":");
  if (!type || !slug) return ref;
  const entity = await findRegistryEntity(slug, type);
  if (!entity) return ref;
  const publicType = type === "persona" ? "person" : type === "lugar" ? "place" : "concept";
  return {
    ...ref,
    key: entidadKey(publicType, entity.name),
    label: entity.name,
  };
}

/** Solo las fichas del mismo tipo son idempotentes por sourceRef. */
export function isCanonicalFicha(formatId: AtelierFormatId, ref: SourceRef | null): ref is SourceRef {
  return Boolean(ref && fichaFormatForKind(ref.kind) === formatId);
}
