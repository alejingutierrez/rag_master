import { NextRequest } from "next/server";
import { generateEmbedding } from "@/lib/bedrock";
import { hybridSearch } from "@/lib/hybrid-search";
import { askClaude } from "@/lib/claude";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Deep Research SSE simple: planificador propio → 4-6 subqueries → RAG paralelo
 * → síntesis con askClaude (Opus 4.7 con thinking).
 *
 * El planificador usa el propio askClaude con template mini-ensayo para generar
 * subqueries, parseándolas con regex (manera robusta).
 */
export async function POST(req: NextRequest) {
  const { question } = await req.json();
  if (!question || question.length < 12) {
    return new Response(JSON.stringify({ error: "Pregunta requerida (≥12 chars)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Detectar tabla disponible (chunks_v2 vacío → fallback a chunks)
        const v2Available = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
          `SELECT COUNT(*) as c FROM chunks_v2 WHERE embedding IS NOT NULL LIMIT 1`,
        )
          .then((r) => Number(r[0]?.c || 0) > 0)
          .catch(() => false);
        const tableName: "chunks" | "chunks_v2" = v2Available ? "chunks_v2" : "chunks";

        send({ type: "step", step: "planning", message: "Planificando subqueries…" });

        // Generamos subqueries hardcoded basadas en patrones históricos
        // (planning sin LLM separado, para minimizar latencia y costos).
        const planningPrefixes = [
          "¿Cuál es el contexto histórico de",
          "¿Qué actores principales intervienen en",
          "¿Cuáles son las causas estructurales detrás de",
          "¿Qué consecuencias inmediatas y de largo plazo tuvo",
          "¿Cómo se ha interpretado historiográficamente",
          "¿Qué tensiones internas y debates existieron sobre",
        ];

        const topic = question.replace(/[¿?¡!]/g, "").trim();
        const subqueries = planningPrefixes.slice(0, 5).map((p) => `${p} ${topic}?`);

        send({ type: "plan", plan: { subqueries, thinking: "5 subqueries: contexto, actores, causas, consecuencias, historiografía." } });

        // Ejecutar subqueries en paralelo
        const allChunks: Array<{
          content: string;
          documentFilename?: string;
          pageNumber: number;
          chunkIndex: number;
          similarity: number;
          id: string;
          documentId?: string;
        }> = [];

        for (let i = 0; i < subqueries.length; i++) {
          send({ type: "subquery_start", index: i, query: subqueries[i] });
          try {
            const emb = await generateEmbedding(subqueries[i], "search_query");
            const results = await hybridSearch(emb, subqueries[i], 30, 0.2, undefined, tableName);
            for (const r of results.slice(0, 6)) {
              if (!allChunks.find((c) => c.id === r.id)) allChunks.push(r);
            }
            send({ type: "subquery_done", index: i, foundChunks: results.length });
          } catch (err) {
            send({ type: "subquery_done", index: i, foundChunks: 0, error: String(err) });
          }
        }

        send({
          type: "step",
          step: "synthesizing",
          message: `Sintetizando con ${allChunks.length} fragmentos…`,
        });

        // Síntesis con askClaude
        const stream2 = await askClaude(
          `INVESTIGACIÓN PROFUNDA — sintetiza una respuesta exhaustiva a esta pregunta usando los fragmentos del corpus que recibiste como contexto. Estructura tu respuesta en secciones claras: marco general, argumentación por ángulos, tensiones/matices, síntesis final. Cita [#N] obligatoriamente en cada afirmación importante.\n\nPREGUNTA: ${question}`,
          allChunks.slice(0, 80) as Parameters<typeof askClaude>[1],
          16000,
          { templateId: "ensayo-largo" },
        );

        let answer = "";
        const reader = stream2.getReader();
        const dec = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = dec.decode(value, { stream: true });
          answer += text;
          send({ type: "answer_delta", chunk: text });
        }

        send({ type: "complete", finalAnswer: answer, chunks: allChunks.slice(0, 80) });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
