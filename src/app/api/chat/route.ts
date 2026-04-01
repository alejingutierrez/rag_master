import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/bedrock";
import { searchSimilarChunks } from "@/lib/vector-search";
import { askClaude } from "@/lib/claude";

// App Runner no tiene límite de función a nivel Vercel; lo dejamos alto por compatibilidad.
export const maxDuration = 300;

// El ALB de App Runner tiene idle-timeout de 60s.
// Enviamos un comentario SSE cada 20s para mantener el TCP vivo.
const HEARTBEAT_INTERVAL_MS = 20_000;

// POST /api/chat — Pipeline RAG completo con streaming
//
// ARQUITECTURA ANTI-TIMEOUT:
// El Response se devuelve en < 10ms (solo validación de body).
// TODO el trabajo asíncrono (embedding, búsqueda, Claude) ocurre en el IIFE
// de fondo. El heartbeat garantiza que el ALB nunca vea una conexión idle.
//
// Esto previene:
//   - 502 (idle timeout) → heartbeat cada 20s
//   - 504 (gateway timeout esperando HTTP headers) → headers enviados en < 10ms
export async function POST(request: NextRequest) {
  // --- Validación síncrona (única lógica antes de retornar el Response) ---
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const {
    question,
    topK = 50,
    similarityThreshold = 0.35,
    maxTokens = 8000,
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
    return new Response(JSON.stringify({ error: "Se requiere una pregunta" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  // --- Crear ReadableStream y arrancar heartbeat ANTES de cualquier I/O ---
  // El controller se asigna síncronamente en start(), antes de usarlo.
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const responseStream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  // Heartbeat: mantiene el ALB despierto mientras Bedrock y Opus trabajan.
  const heartbeatTimer = setInterval(() => {
    try {
      controller.enqueue(encoder.encode(": keepalive\n\n"));
    } catch {
      clearInterval(heartbeatTimer);
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Señal inmediata al cliente: la petición fue recibida y está procesando.
  controller.enqueue(
    encoder.encode(`data: ${JSON.stringify({ status: "searching" })}\n\n`)
  );

  // --- IIFE de fondo: todo el I/O ocurre aquí ---
  // En este punto ya hemos retornado el Response abajo (< 10ms desde la petición).
  (async () => {
    let fullAnswer = "";
    try {
      // 1. Obtener configuración
      let config = { topK: topK as number, similarityThreshold: similarityThreshold as number, maxTokens: maxTokens as number };
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

      // 2. Generar embedding (puede tardar hasta 75s si Bedrock está throttleando)
      //    Ahora ocurre aquí, dentro del IIFE — el ALB ya tiene los headers HTTP.
      const queryEmbedding = await generateEmbedding(
        question as string,
        "search_query"
      );

      // 3. Buscar chunks similares
      const chunks = await searchSimilarChunks(
        queryEmbedding,
        config.topK,
        config.similarityThreshold,
        documentIds as string[] | undefined
      );

      if (chunks.length === 0) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              error:
                "No se encontraron fragmentos relevantes. Intenta ajustar el umbral de similitud o verifica que los documentos estén procesados.",
            })}\n\n`
          )
        );
        return;
      }

      // 4. Enviar metadatos de chunks — el cliente muestra las fuentes ahora,
      //    mientras Opus genera la respuesta.
      const chunksMetadata = chunks.slice(0, 50).map((c) => ({
        id: c.id,
        documentId: c.documentId,
        documentFilename: c.documentFilename,
        pageNumber: c.pageNumber,
        chunkIndex: c.chunkIndex,
        similarity: c.similarity,
        content:
          c.content.substring(0, 150) + (c.content.length > 150 ? "..." : ""),
      }));

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            chunks: chunksMetadata,
            totalChunksUsed: chunks.length,
          })}\n\n`
        )
      );

      // 5. Llamar a Claude y transmitir la respuesta token a token
      const claudeStream = await askClaude(
        question as string,
        chunks,
        config.maxTokens,
        { templateId: templateId as string | undefined }
      );
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
      const isThrottled =
        error instanceof Error &&
        (error.name === "ThrottlingException" ||
          error.message.includes("throttl"));

      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              error: isThrottled
                ? "Bedrock está saturado. Espera unos segundos e intenta de nuevo."
                : error instanceof Error
                  ? error.message
                  : "Error al generar respuesta",
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

      // Guardar conversación (fire-and-forget)
      const modelUsed =
        process.env.BEDROCK_CLAUDE_MODEL_ID ||
        "us.anthropic.claude-opus-4-6-20250610-v1:0";

      if (fullAnswer) {
        prisma.conversation
          .create({
            data: {
              question: question as string,
              answer: fullAnswer,
              modelUsed,
              templateId: (templateId as string) || null,
              chunksUsed: [],
              configurationId: (configurationId as string) || null,
            },
          })
          .catch((e) => console.error("Error saving conversation:", e));
      }
    }
  })();

  // --- Retornar el Response INMEDIATAMENTE (< 10ms desde la petición) ---
  // X-Accel-Buffering: no  → evita buffering en proxies nginx-style
  // Cache-Control: no-transform → evita que proxies compriman el stream
  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
