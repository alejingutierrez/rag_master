import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/bedrock";
import { searchSimilarChunks } from "@/lib/vector-search";
import { askClaude } from "@/lib/claude";

// Opus con 90KB de contexto puede tardar >120s; en App Runner no aplica límite Vercel
// pero lo dejamos alto por si acaso.
export const maxDuration = 300;

// App Runner / ALB tiene un idle-timeout de 60s.
// Si no enviamos bytes durante 60s la conexión se cierra con 502.
// Enviamos un comentario SSE cada 20s para mantener la conexión viva.
const HEARTBEAT_INTERVAL_MS = 20_000;

// POST /api/chat - Pipeline RAG completo con streaming
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      question,
      topK = 50,
      similarityThreshold = 0.35,
      maxTokens = 8000,
      documentIds,
      configurationId,
      templateId,
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

    // 4. Preparar metadatos de chunks para el frontend
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

    const encoder = new TextEncoder();

    // 5. Crear el ReadableStream de respuesta y obtener el controller
    //    start() es síncrono — controller queda asignado antes de usarlo.
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const responseStream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });

    // 6. Inyectar metadatos de chunks como PRIMER evento SSE.
    //    El cliente ya puede mostrar las fuentes mientras Opus genera la respuesta.
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({ chunks: chunksMetadata, totalChunksUsed: chunks.length })}\n\n`
      )
    );

    // 7. Heartbeat cada 20s para que App Runner / ALB no cierre la conexión por inactividad.
    //    Los comentarios SSE (": ...") son ignorados por el cliente pero mantienen el TCP vivo.
    const heartbeatTimer = setInterval(() => {
      try {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      } catch {
        clearInterval(heartbeatTimer);
      }
    }, HEARTBEAT_INTERVAL_MS);

    // 8. Procesar Claude en segundo plano — la respuesta HTTP ya está en vuelo.
    (async () => {
      let fullAnswer = "";
      try {
        const claudeStream = await askClaude(question, chunks, config.maxTokens, { templateId });
        const reader = claudeStream.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          controller.enqueue(value);

          // Acumular texto para guardar en DB
          const text = new TextDecoder().decode(value);
          for (const line of text.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) fullAnswer += data.text;
            } catch {
              // Ignorar líneas que no son JSON válido
            }
          }
        }
      } catch (error) {
        console.error("Chat stream error:", error);
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: error instanceof Error ? error.message : "Error al generar respuesta",
              })}\n\n`
            )
          );
        } catch {
          // Stream ya cerrado
        }
      } finally {
        clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          // Ya cerrado
        }

        // Guardar conversación (sin bloquear — el stream ya está cerrado)
        if (fullAnswer) {
          prisma.conversation
            .create({
              data: {
                question,
                answer: fullAnswer,
                modelUsed,
                templateId: templateId || null,
                chunksUsed: chunks.map((c) => ({
                  id: c.id,
                  similarity: c.similarity,
                  documentFilename: c.documentFilename,
                  pageNumber: c.pageNumber,
                })),
                configurationId: configurationId || null,
              },
            })
            .catch((e) => console.error("Error saving conversation:", e));
        }
      }
    })();

    // 9. Devolver la respuesta de inmediato — el stream se llena en el paso 8.
    //    X-Accel-Buffering: no  → evita que proxies intermedios (nginx, ALB) buffereen el SSE.
    //    Cache-Control: no-transform → evita compresión que forzaría buffering.
    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);

    const isThrottled =
      error instanceof Error &&
      (error.name === "ThrottlingException" ||
        error.message.includes("throttl"));
    const isModelError =
      error instanceof Error &&
      (error.message.includes("model") || error.message.includes("Model"));

    let errorMsg = "Error al procesar la pregunta";
    if (isThrottled)
      errorMsg = "Bedrock está saturado. Espera unos segundos e intenta de nuevo.";
    else if (isModelError)
      errorMsg = `Error de modelo: ${(error as Error).message}`;

    return new Response(JSON.stringify({ error: errorMsg }), {
      status: isThrottled ? 429 : 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
