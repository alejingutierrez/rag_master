import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/bedrock";
import { searchSimilarChunks } from "@/lib/vector-search";
import { askClaude } from "@/lib/claude";

export const maxDuration = 60;

// POST /api/chat — Pipeline RAG: embedding + search + DB record, then Claude runs in background via after()
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

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

  // 1. Load config from DB if configurationId provided
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

  // 2. Generate embedding
  const queryEmbedding = await generateEmbedding(question, "search_query");

  // 3. Search similar chunks
  const chunks = await searchSimilarChunks(
    queryEmbedding,
    config.topK,
    config.similarityThreshold,
    documentIds as string[] | undefined
  );

  // 4. Return 404 if no chunks found
  if (chunks.length === 0) {
    return Response.json(
      {
        error:
          "No se encontraron fragmentos relevantes. Intenta ajustar el umbral de similitud o verifica que los documentos estén procesados.",
      },
      { status: 404 }
    );
  }

  // 5. Build chunks metadata
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

  // 6. Create conversation record with GENERATING status
  const conversation = await prisma.conversation.create({
    data: {
      question,
      answer: "",
      status: "GENERATING",
      modelUsed,
      templateId: (templateId as string) || null,
      chunksUsed: chunksMetadata,
      configurationId: (configurationId as string) || null,
    },
  });

  // 7. Run Claude in background after response is sent
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
            if (typeof data.text === "string") {
              fullAnswer += data.text;
            }
          } catch {
            // Ignore non-JSON lines
          }
        }
      }

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { answer: fullAnswer, status: "COMPLETE" },
      });
    } catch (error) {
      console.error("Background Claude error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Error al generar respuesta";
      await prisma.conversation
        .update({
          where: { id: conversation.id },
          data: { status: "ERROR", answer: errorMessage },
        })
        .catch((e) => console.error("Error updating conversation status:", e));
    }
  });

  // 8. Return immediately with id and chunks
  return Response.json({
    id: conversation.id,
    chunks: chunksMetadata,
    totalChunksUsed: chunks.length,
  });
}
