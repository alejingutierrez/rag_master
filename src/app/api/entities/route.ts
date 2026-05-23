import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * NER pragmático: extrae secuencias de palabras con mayúscula del corpus.
 * No es perfecto (no distingue persona/lugar/evento) pero da una vista útil
 * sin requerir un modelo NER dedicado.
 *
 * Para la versión completa con persona/lugar/evento se necesitaría un servicio
 * NER en español (spaCy, Stanza, o un LLM). Por ahora se infiere por heurística.
 */
export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "100");
  const minMentions = Number(req.nextUrl.searchParams.get("minMentions") ?? "5");

  // Sample heavy: solo primeros 200 chunks como muestra para evitar timeouts
  const sampleSize = Number(req.nextUrl.searchParams.get("sample") ?? "200");

  const chunks = await prisma.chunk.findMany({
    take: sampleSize,
    orderBy: { createdAt: "desc" },
    select: {
      content: true,
      documentId: true,
      pageNumber: true,
    },
  });

  // Stop words español/historia común
  const stopWords = new Set([
    "El", "La", "Los", "Las", "Un", "Una", "Unos", "Unas",
    "De", "Del", "En", "Por", "Para", "Con", "Sin", "Sobre", "Bajo", "Entre",
    "Y", "O", "Pero", "Si", "No", "Que", "Quien", "Cual", "Donde", "Cuando",
    "Como", "Porque", "Aunque", "Mientras", "Es", "Son", "Era", "Fue", "Será",
    "Capítulo", "Sección", "Página", "Editor", "Editorial", "Autor", "Volumen",
    "Tomo", "Parte", "Apéndice", "Nota", "Notas", "Véase", "Cf",
    "Sr", "Sra", "Don", "Doña", "Dr", "Dra", "Mr", "Mrs",
  ]);

  type Entity = {
    name: string;
    mentions: number;
    docIds: Set<string>;
    pages: Set<number>;
    type: "person" | "place" | "concept";
  };

  const entitiesMap = new Map<string, Entity>();

  // Regex: secuencia de 1-4 palabras capitalizadas
  const re = /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:de\s+|del\s+|la\s+|las\s+|los\s+|d'|de\s+la\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})\b/g;

  for (const c of chunks) {
    const matches = c.content.matchAll(re);
    for (const m of matches) {
      const name = m[1].trim();
      if (name.length < 4 || name.length > 60) continue;
      const firstWord = name.split(" ")[0];
      if (stopWords.has(firstWord)) continue;
      // Quitar entidades que parecen ser inicio de frase + sustantivo común
      const words = name.split(" ");
      if (words.length === 1 && words[0].length < 5) continue;

      const existing = entitiesMap.get(name) ?? {
        name,
        mentions: 0,
        docIds: new Set<string>(),
        pages: new Set<number>(),
        type: classifyEntity(name),
      };
      existing.mentions++;
      existing.docIds.add(c.documentId);
      existing.pages.add(c.pageNumber);
      entitiesMap.set(name, existing);
    }
  }

  const entities = Array.from(entitiesMap.values())
    .filter((e) => e.mentions >= minMentions)
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, limit)
    .map((e) => ({
      name: e.name,
      mentions: e.mentions,
      docCount: e.docIds.size,
      pageCount: e.pages.size,
      type: e.type,
    }));

  return NextResponse.json({ entities, totalSampled: chunks.length });
}

function classifyEntity(name: string): "person" | "place" | "concept" {
  // Heurística simple. Palabras de lugar comunes.
  const placeMarkers = ["Colombia", "Bogotá", "Medellín", "Cali", "Cartagena", "Boyacá", "Cundinamarca", "Antioquia", "España", "Francia", "Estados Unidos", "América", "Europa", "Río", "Mar", "Cordillera", "Departamento", "Provincia", "Ciudad", "Pueblo", "Municipio"];
  if (placeMarkers.some((p) => name.includes(p))) return "place";

  // Si tiene "de la/de los/del" probablemente persona o concepto
  // Si es 2-3 palabras y la primera es nombre común español, probablemente persona
  const personFirstNames = ["Simón", "José", "Francisco", "Manuel", "Pedro", "Pablo", "Juan", "Antonio", "Carlos", "Tomás", "Diego", "Hernán", "Bartolomé", "Sebastián", "Camilo", "Mariano", "Rafael", "Eduardo", "Miguel", "Andrés", "Santiago", "Alfonso", "Gonzalo", "Bolívar", "Santander", "Nariño", "Mosquera", "Núñez", "Caro", "Gaitán", "Rojas", "López", "Pastrana", "Uribe", "Santos", "Petro"];
  const firstWord = name.split(" ")[0];
  if (personFirstNames.some((p) => firstWord.includes(p) || name.includes(p))) return "person";

  return "concept";
}
