import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { askClaude } from "@/lib/claude";
import { runRagPipeline } from "@/lib/rag-pipeline";
import { validateAndClean } from "@/lib/citation-validator";
import { getTemplateById, DEFAULT_TEMPLATE_ID } from "@/lib/chat-templates";

// Flag para habilitar validación post-hoc de citas inline `[#N]`.
// Solo aplica si el template usa citas inline (no si usa APA al final).
const ENABLE_CITATION_VALIDATION =
  (process.env.ENABLE_CITATION_VALIDATION ?? "true").toLowerCase() === "true";

// Subido de 60 a 300s porque el pipeline con reranker + query expansion puede tomar 30-60s
// en el peor caso (top-100 candidates + Cohere Rerank + Haiku judge + parent expansion).
export const maxDuration = 300;

// Prefijo que distingue un mensaje de error de una respuesta real.
// No usar caracteres especiales que puedan aparecer en respuestas de Claude.
const ERROR_PREFIX = "[[RAG_ERROR]] ";

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
    topK = 100,
    similarityThreshold = 0.25,
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

  // Validar que la pregunta sea suficientemente específica.
  // Una pregunta como "cuentame la historia" no puede ser respondida sin ambigüedad.
  const wordCount = question.trim().split(/\s+/).filter((w) => w.length >= 2).length;
  if (wordCount < 4) {
    return Response.json(
      {
        error:
          "Tu pregunta es muy general. Por favor incluye el sujeto (persona, evento, concepto) y al menos un detalle adicional. Ejemplo: 'cuentame la historia de Manuel Cepeda Vargas' o '¿qué pasó en el Palacio de Justicia en 1985?'",
      },
      { status: 422 }
    );
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

  // 2. Detectar si BM25 / chunks_v2 están disponibles para activar pipeline mejorado
  const v2Available = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*) as c FROM chunks_v2 WHERE embedding IS NOT NULL LIMIT 1`
  ).then((r) => Number(r[0]?.c || 0) > 0).catch(() => false);

  const bm25Available = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS(
       SELECT 1 FROM information_schema.columns
       WHERE table_name = '${v2Available ? "chunks_v2" : "chunks"}' AND column_name = 'content_fts'
     ) as exists`
  ).then((r) => r[0]?.exists || false).catch(() => false);

  const effectiveTable = v2Available ? "chunks_v2" : "chunks";

  // 3. Ejecutar pipeline RAG (con todas las mejoras disponibles).
  // NO especificamos finalTopK aquí: el default del pipeline (80) ya está pensado
  // para Opus 4.7 con 1M tokens de contexto. Opus 4.7 hace la selección final consciente.
  const ragResult = await runRagPipeline(question, {
    tableName: effectiveTable,
    useBM25: bm25Available,
    useReranker: true,
    useQueryExpansion: true,
    useParentExpansion: v2Available, // solo si hay parents en chunks_v2
    documentIds: documentIds as string[] | undefined,
  });

  const chunks = ragResult.chunks;

  if (chunks.length === 0) {
    return Response.json(
      {
        error:
          "No se encontraron fragmentos relevantes. Intenta reformular la pregunta con más detalles específicos (nombres, fechas, lugares).",
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

      // Validación post-hoc de citas inline [#N].
      // Solo aplica si el template usa citas inline. Si el template usa APA al final
      // (appendApaReferences=true), saltamos porque la respuesta no tiene [#N].
      const tpl = getTemplateById((templateId as string) || DEFAULT_TEMPLATE_ID);
      const usesInlineCitations = tpl?.appendApaReferences !== true;

      let finalAnswer = fullAnswer;
      if (ENABLE_CITATION_VALIDATION && usesInlineCitations && fullAnswer.length > 100) {
        try {
          const validated = await validateAndClean(fullAnswer, chunks);
          if (validated.removedCount > 0) {
            console.log(
              `[chat] Validación: ${validated.removedCount}/${validated.totalSentencesWithCitations} oraciones removidas por citas inválidas (factuality=${(validated.factualityRate * 100).toFixed(0)}%)`
            );
            finalAnswer = validated.cleanedAnswer;
          }
        } catch (e) {
          console.warn("[chat] Validación falló (continuando con respuesta sin validar):", (e as Error).message);
        }
      }

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { answer: finalAnswer },
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
