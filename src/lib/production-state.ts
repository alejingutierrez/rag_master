/**
 * Estado de producción por tipología (solo lectura).
 *
 * "Producido" ⇔ existe un Deliverable COMPLETE cuyo `templateId` es la ficha del
 * mismo tipo (`fichaFormatForKind`) y que está enlazado al ítem:
 *   - pregunta → por FK `Deliverable.questionId` (robusto para preguntas viejas
 *     sin sourceRef; además el Taller ya pasa questionId).
 *   - resto    → por `Deliverable.metadata.sourceRef.{kind,key}` (JSON path, mismo
 *     patrón que ensureUniqueSlug en deliverables/[id]/route.ts).
 *
 * Producir un ítem como formato narrativo (crónica, ensayo…) NO lo marca: su
 * templateId no es la ficha del tipo, así que no entra en esta consulta.
 */

import { prisma } from "@/lib/prisma";
import { fichaFormatForKind, type SourceKind } from "@/lib/source-ref";

export interface ProducedInfo {
  /** Entregable-ficha más reciente que produjo este ítem. */
  deliverableId: string;
  /** ISO si está publicado en el sitio público, null si solo producido. */
  publishedAt: string | null;
}

/**
 * Mapa `key → ProducedInfo` de los ítems ya producidos como ficha de su tipo.
 * Si `keys` viene, se filtra a ese subconjunto (útil para catálogos grandes).
 */
export async function getProducedKeys(
  kind: SourceKind,
  keys?: string[],
): Promise<Map<string, ProducedInfo>> {
  const ficha = fichaFormatForKind(kind);
  const out = new Map<string, ProducedInfo>();

  if (kind === "pregunta") {
    const dels = await prisma.deliverable.findMany({
      where: {
        status: "COMPLETE",
        templateId: ficha,
        ...(keys && keys.length
          ? { questionId: { in: keys } }
          : { questionId: { not: null } }),
      },
      select: { id: true, questionId: true, publishedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    for (const d of dels) {
      if (!d.questionId || out.has(d.questionId)) continue;
      out.set(d.questionId, {
        deliverableId: d.id,
        publishedAt: d.publishedAt?.toISOString() ?? null,
      });
    }
    return out;
  }

  // Resto de tipologías: enlace vía metadata.sourceRef.
  const dels = await prisma.deliverable.findMany({
    where: {
      status: "COMPLETE",
      templateId: ficha,
      metadata: { path: ["sourceRef", "kind"], equals: kind },
    },
    select: { id: true, metadata: true, publishedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  for (const d of dels) {
    const sr = (d.metadata as { sourceRef?: { key?: unknown } } | null)?.sourceRef;
    const k = typeof sr?.key === "string" ? sr.key : "";
    if (!k) continue;
    if (keys && keys.length && !keys.includes(k)) continue;
    if (out.has(k)) continue; // orderBy desc ⇒ el primero es el más reciente
    out.set(k, {
      deliverableId: d.id,
      publishedAt: d.publishedAt?.toISOString() ?? null,
    });
  }
  return out;
}

/** Serializa el mapa a un objeto plano JSON-friendly para la respuesta de API. */
export function producedMapToObject(
  m: Map<string, ProducedInfo>,
): Record<string, ProducedInfo> {
  const o: Record<string, ProducedInfo> = {};
  for (const [k, v] of m) o[k] = v;
  return o;
}
