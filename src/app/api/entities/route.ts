import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseLimit(raw: string | null): number | null {
  if (raw === "all") return null;
  const n = Number(raw ?? "100");
  return Number.isFinite(n) && n > 0 ? n : 100;
}

/**
 * Entidades del corpus, derivadas de las preguntas estructuradas (Opus 4.7).
 *
 * Antes: NER por regex sobre chunks (heurística — confundía persona/lugar/concepto
 * y muchas mayúsculas eran arrastre de prosa). Ahora: agregación directa de los
 * arrays `entidadesPersonas`, `entidadesLugares`, `entidadesConceptos` que ya
 * fueron clasificadas por el modelo al generar cada pregunta.
 *
 * Mentions = en cuántas preguntas distintas aparece la entidad.
 * Si NO hay preguntas todavía, retornamos lista vacía + flag para que la UI
 * sugiera generar preguntas. NO caemos al regex de chunks porque su tipado
 * era poco confiable.
 */
export async function GET(req: NextRequest) {
  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
  const minMentions = Number(req.nextUrl.searchParams.get("minMentions") ?? "2");
  const typeFilter = req.nextUrl.searchParams.get("type"); // "person" | "place" | "concept" | null

  const questions = await prisma.question.findMany({
    select: {
      id: true,
      documentId: true,
      entidadesPersonas: true,
      entidadesLugares: true,
      entidadesConceptos: true,
    },
  });

  if (questions.length === 0) {
    return NextResponse.json({
      entities: [],
      counts: { all: 0, person: 0, place: 0, concept: 0 },
      totalSampled: 0,
      hint: "Aún no se han generado preguntas. Genera preguntas para extraer entidades.",
    });
  }

  type Bucket = {
    name: string;
    mentions: number;
    questionIds: Set<string>;
    docIds: Set<string>;
    type: "person" | "place" | "concept";
    // Conteo por variante de escritura ("INCORA" vs "Incora") — el nombre
    // mostrado es la variante más frecuente en el corpus, no la primera vista.
    variants: Map<string, number>;
  };

  const map = new Map<string, Bucket>();

  // Clave compuesta tipo::nombre — evita colisión Bolivia (lugar) vs Bolívar (persona).
  const key = (type: string, name: string) => `${type}::${name.trim().toLowerCase()}`;

  const ingest = (type: Bucket["type"], items: string[], docId: string, qid: string) => {
    for (const raw of items) {
      const name = raw.trim();
      if (!name) continue;
      const k = key(type, name);
      const existing = map.get(k);
      if (existing) {
        existing.questionIds.add(qid);
        existing.docIds.add(docId);
        existing.mentions = existing.questionIds.size;
        existing.variants.set(name, (existing.variants.get(name) ?? 0) + 1);
      } else {
        map.set(k, {
          name,
          mentions: 1,
          questionIds: new Set([qid]),
          docIds: new Set([docId]),
          type,
          variants: new Map([[name, 1]]),
        });
      }
    }
  };

  for (const q of questions) {
    ingest("person", q.entidadesPersonas, q.documentId, q.id);
    ingest("place", q.entidadesLugares, q.documentId, q.id);
    ingest("concept", q.entidadesConceptos, q.documentId, q.id);
  }

  const aboveThreshold = Array.from(map.values()).filter(
    (e) => e.mentions >= minMentions,
  );

  // Conteos por tipo sobre el conjunto completo — estables sin importar qué
  // pestaña esté seleccionada. La lista (entities) sí se filtra por tipo.
  const counts = {
    all: aboveThreshold.length,
    person: aboveThreshold.filter((e) => e.type === "person").length,
    place: aboveThreshold.filter((e) => e.type === "place").length,
    concept: aboveThreshold.filter((e) => e.type === "concept").length,
  };

  const sortedEntities = aboveThreshold
    .filter((e) => !typeFilter || e.type === typeFilter)
    .sort((a, b) => b.mentions - a.mentions);

  const entities = (limit === null ? sortedEntities : sortedEntities.slice(0, limit))
    .map((e) => {
      let best = e.name;
      let bestCount = 0;
      for (const [variant, count] of e.variants) {
        if (count > bestCount) {
          best = variant;
          bestCount = count;
        }
      }
      return {
        name: best,
        mentions: e.mentions,
        docCount: e.docIds.size,
        questionCount: e.questionIds.size,
        type: e.type,
      };
    });

  return NextResponse.json({
    entities,
    counts,
    totalSampled: questions.length,
    source: "questions", // distingue del regex viejo
  });
}
