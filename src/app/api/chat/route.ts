import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/bedrock";
import { searchSimilarChunks } from "@/lib/vector-search";
import { askClaude } from "@/lib/claude";

// POST /api/chat - Pipeline RAG completo con streaming
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      question,
      topK = 30,
      similarityThreshold = 0.35,
      maxTokens = 8000,
      documentIds,
      configurationId,
    } = body;

    if (!question || typeof question !== "string") {
      return new Response(
        JSON.stringify({ error: "Se requiere una pregunta" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1. Obtener configuración si se especificó
    let config = { topK, similarityThreshold, maxTokens };
    if (configurationId) {
      const dbConfig = await prisma.configuration.findUnique({
        where: { id: configurationId },
      });
      if (dbConfig) {
        config = {
          topK: dbConfig.topK,
          similarityThreshold: dbConfig.similarityThreshold,
          maxTokens: dbConfig.maxTokens,
        };
      }
    }

    // 2. Generar embedding de la pregunta (search_query para Cohere)
    const queryEmbedding = await generateEmbedding(question, "search_query");

    // 3. Buscar chunks similares
    const chunks = await searchSimilarChunks(
      queryEmbedding,
      config.topK,
      config.similarityThreshold,
      documentIds
    );

    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "No se encontraron fragmentos relevantes. Intenta ajustar el umbral de similitud o verifica que los documentos estén procesados.",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Enviar a Claude con streaming
    const stream = await askClaude(question, chunks, config.maxTokens);

    // 5. Preparar metadatos de chunks para el frontend (top 50 para el modal, Claude recibe todos)
    const chunksMetadata = chunks.slice(0, 50).map((c) => ({
      id: c.id,
      documentId: c.documentId,
      documentFilename: c.documentFilename,
      pageNumber: c.pageNumber,
      chunkIndex: c.chunkIndex,
      similarity: c.similarity,
      content: c.content.substring(0, 150) + (c.content.length > 150 ? "..." : ""),
    }));

    // 6. Crear un TransformStream que inyecta los chunks al inicio y captura la respuesta
    let fullAnswer = "";
    let chunksInjected = false;
    const encoder = new TextEncoder();
    const modelUsed =
      process.env.BEDROCK_CLAUDE_MODEL_ID ||
      "us.anthropic.claude-opus-4-6-20250610-v1:0";

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        // Inyectar metadatos de chunks como primer evento
        if (!chunksInjected) {
          chunksInjected = true;
          const chunksEvent = `data: ${JSON.stringify({ chunks: chunksMetadata, totalChunksUsed: chunks.length })}\n\n`;
          controller.enqueue(encoder.encode(chunksEvent));
        }

        // Pasar el chunk de Claude al cliente
        controller.enqueue(chunk);

        // Acumular texto para guardar después
        const text = new TextDecoder().decode(chunk);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.replace("data: ", ""));
            if (data.text) fullAnswer += data.text;
          } catch {
            // Ignorar líneas que no son JSON válido
          }
        }
      },
      async flush() {
        // Guardar la conversación en la DB
        try {
          await prisma.conversation.create({
            data: {
              question,
              answer: fullAnswer,
              modelUsed,
              chunksUsed: chunks.map((c) => ({
                id: c.id,
                similarity: c.similarity,
                documentFilename: c.documentFilename,
                pageNumber: c.pageNumber,
              })),
              configurationId: configurationId || null,
            },
          });
        } catch (error) {
          console.error("Error saving conversation:", error);
        }
      },
    });

    const responseStream = stream.pipeThrough(transformStream);

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: "Error al procesar la pregunta" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
