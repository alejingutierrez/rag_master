import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/bedrock";
import { searchSimilarChunks } from "@/lib/vector-search";
import { askClaude } from "@/lib/claude";

export const maxDuration = 60;

// Prefijo que distingue un mensaje de error de una respuesta real.
// No usar caracteres especiales que puedan aparecer en respuestas de Claude.
const ERROR_PREFIX = "\u0000ERROR:";

// POST /api/chat — RAG pipeline: embedding + search, crea registro, Claude corre en after().
// No depende de columnas nuevas: usa answer="" (generando) / respuesta real (listo) / ERROR (fallo).
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  try {
    return await handleChat(body);
  } catch (error) {
    console.error("POST /api/chat error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}

async function handleChat(body: Record<string, unknown>) {
  const {
    question,
    topK = 50,
    similarityThreshold = 0.35,
    maxTokens = 4000,
    documentIds,
    configurationId,
    templateId,
  } = body as {
    question?: string;
    topK?: number;
    similarityThreshold?: number;
    maxTokens?: number;
    documentIds?: string[];
    configurationId?: string;
    templateId?: string;
  };

  if (!question || typeof question !== "string" || !question.trim()) {
    return Response.json({ error: "Se requiere una pregunta" }, { status: 400 });
  }

  // 1. Configuración
  let config = {
    topK: topK as number,
    similarityThreshold: similarityThreshold as number,
    maxTokens: maxTokens as number,
  };
  if (configurationId) {
    const dbConfig = await prisma.configuration.findUnique({
      where: { id: configurationId as string },
    });
    if (dbConfig) {
      config = {
        topK: dbConfig.topK,
        similarityThreshold: dbConfig.similarityThreshold,
        maxTokens: dbConfig.maxTokens,
      };
    }
  }

  // 2. Embedding de la pregunta
  const queryEmbedding = await generateEmbedding(question, "search_query");

  // 3. Búsqueda vectorial
  const chunks = await searchSimilarChunks(
    queryEmbedding,
    config.topK,
    config.similarityThreshold,
    documentIds as string[] | undefined
  );

  if (chunks.length === 0) {
    return Response.json(
      {
        error:
          "No se encontraron fragmentos relevantes. Intenta ajustar el umbral de similitud o verifica que los documentos estén procesados.",
      },
      { status: 404 }
    );
  }

  // 4. Metadatos para el frontend
  const chunksMetadata = chunks.slice(0, 50).map((c) => ({
    id: c.id,
    documentId: c.documentId,
    documentFilename: c.documentFilename,
    pageNumber: c.pageNumber,
    chunkIndex: c.chunkIndex,
    similarity: c.similarity,
    content: c.content.substring(0, 150) + (c.content.length > 150 ? "..." : ""),
  }));

  const modelUsed =
    process.env.BEDROCK_CLAUDE_MODEL_ID ||
    "us.anthropic.claude-opus-4-6-20250610-v1:0";

  // 5. Crear registro de conversación.
  //    answer="" → generando  |  answer=texto → completo  |  answer=ERROR_PREFIX+msg → error
  //    NO usa campos nuevos (status/updatedAt) para no depender de migraciones.
  const conversation = await prisma.conversation.create({
    data: {
      question,
      answer: "",          // Vacío = todavía generando
      modelUsed,
      templateId: (templateId as string) || null,
      chunksUsed: chunksMetadata,
      configurationId: (configurationId as string) || null,
    },
  });

  // 6. Claude corre en background — después de que el HTTP response es enviado.
  //    Puede tardar varios minutos sin ningún timeout de conexión activo.
  after(async () => {
    try {
      const claudeStream = await askClaude(
        question,
        chunks,
        config.maxTokens,
        { templateId: templateId as string | undefined }
      );

      const reader = claudeStream.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (typeof data.text === "string") fullAnswer += data.text;
          } catch { /* líneas no-JSON */ }
        }
      }

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { answer: fullAnswer },
      });
    } catch (error) {
      console.error("Background Claude error:", error);
      const msg = error instanceof Error ? error.message : "Error al generar respuesta";
      await prisma.conversation
        .update({
          where: { id: conversation.id },
          data: { answer: ERROR_PREFIX + msg },
        })
        .catch((e) => console.error("Error saving error state:", e));
    }
  });

  // 7. Devolver en < 5s — el cliente empieza a hacer polling con el id.
  return Response.json({
    id: conversation.id,
    chunks: chunksMetadata,
    totalChunksUsed: chunks.length,
  });
}
