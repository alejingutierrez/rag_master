import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runRagPipeline } from "@/lib/rag-pipeline";
import { consultaDeltas } from "@/lib/consulta-stream";
import {
  buildContextPreamble,
  type QuestionContext,
} from "@/lib/question-context";

export const dynamic = "force-dynamic";
// Consultar streamea en vivo: el HTTP response queda abierto durante toda la
// generación (con heartbeats). App Runner sí sostiene SSE — el 504 histórico era
// por un response síncrono SILENCIOSO, no por una conexión activa.
export const maxDuration = 600;

// POST /api/chat/stream — Consultar ligero, respuesta en streaming SSE real.
//
// Protocolo de eventos (cada uno una línea `data: {json}\n\n`):
//   { type: "meta",   id }                     → id de la conversación (para historial)
//   { type: "chunks", chunks: [...] }          → pasajes recuperados (panel "Fuentes")
//   { type: "delta",  text }                   → token(s) de la respuesta
//   { type: "done" }                           → fin
//   { type: "error",  message }                → fallo
// Más comentarios `: heartbeat\n\n` cada 5s para mantener viva la conexión.
//
// A diferencia de /api/chat (JSON + after() + polling), aquí NO se escribe un
// Deliverable: Consultar es efímero/consulta. Solo persiste un Conversation para
// el historial.
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const { question, documentIds, questionContext } = body as {
    question?: string;
    documentIds?: string[];
    questionContext?: QuestionContext;
  };

  if (!question || typeof question !== "string" || !question.trim()) {
    return Response.json({ error: "Se requiere una pregunta" }, { status: 400 });
  }

  // Una pregunta como "cuentame la historia" no puede responderse sin ambigüedad.
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

  const modelUsed =
    process.env.BEDROCK_CHAT_LIGHT_MODEL_ID ||
    process.env.BEDROCK_ANNEX_MODEL_ID ||
    "us.anthropic.claude-sonnet-4-6";

  // Crear el registro de historial al inicio; se completa al final del stream.
  // (Conversation no linkea a Question — eso era del Deliverable, que Consultar
  // ya no escribe; el contexto curado viaja solo al prompt vía questionContext.)
  const conversation = await prisma.conversation.create({
    data: {
      question,
      answer: "",
      modelUsed,
      templateId: "consulta",
      chunksUsed: [],
    },
  });

  const encoder = new TextEncoder();
  const reqStart = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const heartbeat = setInterval(() => {
        if (closed) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          closed = true;
          clearInterval(heartbeat);
        }
      }, 5_000);

      const finish = () => {
        clearInterval(heartbeat);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      };

      try {
        send({ type: "meta", id: conversation.id });

        // 1. Detectar tablas disponibles (chunks_v2 vacío en prod → cae a chunks).
        const v2Available = await prisma
          .$queryRawUnsafe<Array<{ c: bigint }>>(
            `SELECT COUNT(*) as c FROM chunks_v2 WHERE embedding IS NOT NULL LIMIT 1`
          )
          .then((r) => Number(r[0]?.c || 0) > 0)
          .catch(() => false);
        const effectiveTable = v2Available ? "chunks_v2" : "chunks";
        const bm25Available = await prisma
          .$queryRawUnsafe<Array<{ exists: boolean }>>(
            `SELECT EXISTS(
               SELECT 1 FROM information_schema.columns
               WHERE table_name = '${effectiveTable}' AND column_name = 'content_fts'
             ) as exists`
          )
          .then((r) => r[0]?.exists || false)
          .catch(() => false);

        // 2. Pipeline RAG recortado: sin query-expansion (ahorra ~1 LLM + 4
        //    embeds/búsquedas), sin parent-expansion, topK bajo. Buscador con RAG.
        const ragResult = await runRagPipeline(question, {
          tableName: effectiveTable,
          useBM25: bm25Available,
          useQueryExpansion: false,
          useReranker: true,
          useParentExpansion: false,
          documentIds: documentIds,
          retrievalCandidates: 100,
          rerankTopN: 40,
          finalTopK: 12,
        });

        const chunks = ragResult.chunks;
        if (chunks.length === 0) {
          const msg =
            "No se encontraron fragmentos relevantes. Intenta reformular la pregunta con más detalles específicos (nombres, fechas, lugares).";
          send({ type: "error", message: msg });
          await prisma.conversation
            .update({
              where: { id: conversation.id },
              data: { answer: `[[RAG_ERROR]] ${msg}` },
            })
            .catch(() => {});
          finish();
          return;
        }

        const chunksMetadata = chunks.map((c) => ({
          id: c.id,
          documentId: c.documentId,
          documentFilename: c.documentFilename,
          pageNumber: c.pageNumber,
          chunkIndex: c.chunkIndex,
          similarity: c.similarity,
          content: c.content.slice(0, 400) + (c.content.length > 400 ? "…" : ""),
        }));
        send({ type: "chunks", chunks: chunksMetadata });

        // 3. Generación en streaming. Si vino contexto de pregunta curada, lo
        //    prependemos solo al texto que ve el LLM (la BD guarda la pregunta limpia).
        const preamble = questionContext ? buildContextPreamble(questionContext) : "";
        const enriched = preamble ? `${preamble}\n${question}` : question;

        let full = "";
        for await (const delta of consultaDeltas(enriched, chunks)) {
          full += delta;
          send({ type: "delta", text: delta });
        }

        // 4. Persistir respuesta + pasajes para el historial.
        await prisma.conversation
          .update({
            where: { id: conversation.id },
            data: { answer: full, chunksUsed: chunksMetadata },
          })
          .catch(() => {});

        send({ type: "done" });
        console.log(
          `[chat/stream] ✅ ${conversation.id.slice(-6)} en ${((Date.now() - reqStart) / 1000).toFixed(1)}s, ${chunks.length} pasajes`
        );
        finish();
      } catch (error) {
        console.error("[chat/stream] error:", error);
        const msg = error instanceof Error ? error.message : "Error al generar respuesta";
        send({ type: "error", message: msg });
        await prisma.conversation
          .update({
            where: { id: conversation.id },
            data: { answer: `[[RAG_ERROR]] ${msg}` },
          })
          .catch(() => {});
        finish();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
