import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "100");
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
      } else {
        map.set(k, {
          name, // primer casing visto = nombre canónico
          mentions: 1,
          questionIds: new Set([qid]),
          docIds: new Set([docId]),
          type,
        });
      }
    }
  };

  for (const q of questions) {
    ingest("person", q.entidadesPersonas, q.documentId, q.id);
    ingest("place", q.entidadesLugares, q.documentId, q.id);
    ingest("concept", q.entidadesConceptos, q.documentId, q.id);
  }

  const entities = Array.from(map.values())
    .filter((e) => e.mentions >= minMentions)
    .filter((e) => !typeFilter || e.type === typeFilter)
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, limit)
    .map((e) => ({
      name: e.name,
      mentions: e.mentions,
      docCount: e.docIds.size,
      questionCount: e.questionIds.size,
      type: e.type,
    }));

  // Si filtran un tipo, la lista quedó ya filtrada. Si no, queremos ofrecer
  // un mix balanceado entre persona/lugar/concepto.
  if (!typeFilter && entities.length === limit) {
    // ya está ordenado por mentions; OK
  }

  return NextResponse.json({
    entities,
    totalSampled: questions.length,
    source: "questions", // distingue del regex viejo
  });
}
