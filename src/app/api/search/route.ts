import { NextRequest, NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/bedrock";
import { searchSimilarChunks } from "@/lib/vector-search";

// POST /api/search - Búsqueda semántica
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,
      topK = 50,
      similarityThreshold = 0.35,
      documentIds,
    } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Se requiere un texto de búsqueda" },
        { status: 400 }
      );
    }

    // 1. Generar embedding de la consulta (search_query para Cohere)
    const queryEmbedding = await generateEmbedding(query, "search_query");

    // 2. Buscar chunks similares
    const results = await searchSimilarChunks(
      queryEmbedding,
      topK,
      similarityThreshold,
      documentIds
    );

    return NextResponse.json({ results, query });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Error en la búsqueda" },
      { status: 500 }
    );
  }
}
