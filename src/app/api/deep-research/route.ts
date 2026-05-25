import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runRagPipeline } from "@/lib/rag-pipeline";
import { askClaude } from "@/lib/claude";
import { planResearch } from "@/lib/deep-research-planner";
import { generateAnnexes } from "@/lib/deep-research-annexes";
import { stripDuplicateBibliography } from "@/lib/apa-citations";
import type { SearchResult } from "@/lib/vector-search";

export const dynamic = "force-dynamic";
export const maxDuration = 600; // 10 min: plan + 6 RAGs + síntesis + 3 anexos en paralelo

/**
 * Deep Research v2 — pipeline agéntico para investigación histórica seria.
 *
 *   Pregunta del usuario
 *     → Planner (Claude Opus): descompone en 6-8 sub-preguntas concretas + scope + entidades
 *     → Para cada sub-pregunta: runRagPipeline completo (expansion + BM25 + RRF + rerank)
 *     → Fusión RRF entre sub-preguntas → top 100 chunks únicos
 *     → Síntesis principal (Opus + paper-academico, 5000-7000 palabras, citas inline)
 *     → Anexos en paralelo (Sonnet):
 *        - Cronología
 *        - Tabla de actores
 *        - Vacíos del corpus
 *     → Persistencia como Deliverable (source="deep_research")
 *
 * Devuelve SSE con eventos: step, plan, subquery_start, subquery_done, answer_delta,
 * annex_done, complete, error.
 */
export async function POST(req: NextRequest) {
  const { question } = await req.json();
  if (!question || typeof question !== "string" || question.length < 12) {
    return new Response(
      JSON.stringify({ error: "Pregunta requerida (≥12 chars)" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
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
          controller.enqueue(encoder.encode(`: hb\n\n`));
        } catch {
          closed = true;
          clearInterval(heartbeat);
        }
      }, 5000);

      try {
        // ── 0. Detectar tabla (chunks_v2 o chunks) ─────────────────────────
        const v2Available = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
          `SELECT COUNT(*) as c FROM chunks_v2 WHERE embedding IS NOT NULL LIMIT 1`
        )
          .then((r) => Number(r[0]?.c || 0) > 0)
          .catch(() => false);
        const effectiveTable: "chunks" | "chunks_v2" = v2Available ? "chunks_v2" : "chunks";

        // ── 1. Planificación con Claude Opus ───────────────────────────────
        send({ type: "step", step: "planning", message: "Descomponiendo la pregunta en sub-investigaciones…" });
        const plan = await planResearch(question);
        send({
          type: "plan",
          plan: {
            thinking: plan.thinking,
            scope: plan.scope,
            entities: plan.entities,
            subqueries: plan.subqueries,
          },
        });

        // ── 2. Retrieval por sub-pregunta (concurrencia 2 para no saturar) ─
        send({ type: "step", step: "executing", message: `Recuperando evidencia para ${plan.subqueries.length} ángulos…` });

        const SUBQUERY_CONCURRENCY = 2;
        const allResults: SearchResult[][] = new Array(plan.subqueries.length).fill(null).map(() => []);

        for (let i = 0; i < plan.subqueries.length; i += SUBQUERY_CONCURRENCY) {
          const batch = plan.subqueries.slice(i, i + SUBQUERY_CONCURRENCY);
          const batchIndices = batch.map((_, j) => i + j);

          // Emitir start de cada subquery en el batch
          for (const idx of batchIndices) {
            send({ type: "subquery_start", index: idx, query: plan.subqueries[idx] });
          }

          const batchResults = await Promise.all(
            batch.map(async (sq, j) => {
              const localIdx = i + j;
              try {
                const r = await runRagPipeline(sq, {
                  tableName: effectiveTable,
                  useParentExpansion: v2Available,
                  // Para subqueries usamos menos candidates por ser más eficientes;
                  // la fusión RRF posterior dedupe los mejores.
                  retrievalCandidates: 100,
                  finalTopK: 40,
                });
                send({
                  type: "subquery_done",
                  index: localIdx,
                  foundChunks: r.chunks.length,
                  metrics: r.metrics,
                });
                return r.chunks;
              } catch (err) {
                send({
                  type: "subquery_done",
                  index: localIdx,
                  foundChunks: 0,
                  error: err instanceof Error ? err.message : String(err),
                });
                return [];
              }
            })
          );

          for (let j = 0; j < batchIndices.length; j++) {
            allResults[batchIndices[j]] = batchResults[j];
          }
        }

        // ── 3. Fusión RRF entre sub-preguntas → top 100 chunks únicos ──────
        send({ type: "step", step: "fusing", message: "Fusionando evidencia de todas las sub-preguntas…" });
        const RRF_K = 60;
        const fused = new Map<string, { chunk: SearchResult; score: number }>();
        for (const results of allResults) {
          for (let rank = 0; rank < results.length; rank++) {
            const c = results[rank];
            const score = 1 / (RRF_K + rank + 1);
            const existing = fused.get(c.id);
            if (existing) existing.score += score;
            else fused.set(c.id, { chunk: c, score });
          }
        }
        const fusedChunks = Array.from(fused.values())
          .sort((a, b) => b.score - a.score)
          .map((x) => x.chunk)
          .slice(0, 100);

        if (fusedChunks.length === 0) {
          send({ type: "error", message: "No se encontró evidencia en el corpus para ninguna sub-pregunta." });
          clearInterval(heartbeat);
          if (!closed) controller.close();
          return;
        }

        send({
          type: "fusion_done",
          totalUniqueChunks: fusedChunks.length,
          subqueriesWithResults: allResults.filter((r) => r.length > 0).length,
        });

        // ── 4. Síntesis principal con template paper-academico ─────────────
        send({ type: "step", step: "synthesizing", message: `Redactando paper con ${fusedChunks.length} fragmentos…` });

        const claudeStream = await askClaude(
          question,
          fusedChunks.slice(0, 80),
          40000,
          { templateId: "paper-academico" }
        );

        let paperText = "";
        const reader = claudeStream.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          for (const line of text.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
              if (typeof data.text === "string") {
                paperText += data.text;
                send({ type: "answer_delta", chunk: data.text });
              }
              if (typeof data.error === "string") {
                throw new Error(`Claude stream error: ${data.error}`);
              }
            } catch (e) {
              if (e instanceof Error && e.message.startsWith("Claude stream error:")) throw e;
            }
          }
        }

        if (!paperText.trim()) {
          throw new Error("La síntesis devolvió texto vacío.");
        }

        // ── 5. Anexos en paralelo (Sonnet) ─────────────────────────────────
        send({ type: "step", step: "annexes", message: "Generando cronología, tabla de actores y vacíos…" });

        const annexes = await generateAnnexes(question, fusedChunks);
        send({ type: "annex_done", annex: "cronologia", text: annexes.cronologia });
        send({ type: "annex_done", annex: "actores", text: annexes.actores });
        send({ type: "annex_done", annex: "vacios", text: annexes.vacios });

        // ── 6. Componer texto final: paper + anexos + (APA del sistema ya viene en paperText)
        // La APA del sistema viene incrustada al final del stream de askClaude porque
        // paper-academico tiene appendApaReferences=true. Insertamos los anexos JUSTO
        // ANTES de la sección de referencias para que el orden sea:
        //   [paper] → [cronología] → [actores] → [vacíos] → [APA]
        const cleanPaper = stripDuplicateBibliography(paperText);
        const referencesMatch = cleanPaper.match(/\n+---\n+## Referencias[\s\S]*$/);
        const paperBody = referencesMatch
          ? cleanPaper.slice(0, referencesMatch.index!)
          : cleanPaper;
        const referencesBlock = referencesMatch ? referencesMatch[0] : "";

        const annexBlock = [
          annexes.cronologia,
          annexes.actores,
          annexes.vacios,
        ]
          .filter(Boolean)
          .join("\n\n---\n\n");

        const finalAnswer = [
          paperBody.trimEnd(),
          annexBlock ? `\n\n---\n\n${annexBlock}` : "",
          referencesBlock,
        ]
          .join("")
          .trim() + "\n";

        // ── 7. Persistir como Deliverable con source="deep_research" ───────
        send({ type: "step", step: "persisting", message: "Guardando producción…" });

        const chunksMetadata = fusedChunks.slice(0, 80).map((c) => ({
          id: c.id,
          similarity: c.similarity,
          documentFilename: c.documentFilename,
          pageNumber: c.pageNumber,
          content: c.content.slice(0, 400) + (c.content.length > 400 ? "…" : ""),
        }));

        const modelUsed =
          process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-7";

        const deliverable = await prisma.deliverable.create({
          data: {
            userQuestion: question,
            templateId: "paper-academico",
            status: "COMPLETE",
            answer: finalAnswer,
            modelUsed,
            chunksUsed: chunksMetadata,
            source: "deep_research",
            batchId: `dr-${Date.now()}`,
          },
        });

        send({
          type: "complete",
          deliverableId: deliverable.id,
          finalAnswer,
          chunksCount: chunksMetadata.length,
          plan: {
            thinking: plan.thinking,
            scope: plan.scope,
            entities: plan.entities,
            subqueries: plan.subqueries,
          },
        });
      } catch (err) {
        console.error("[deep-research] error:", err);
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Error desconocido",
        });
      } finally {
        clearInterval(heartbeat);
        if (!closed) {
          try {
            controller.close();
          } catch { /* ya cerrado */ }
        }
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

// GET /api/deep-research?id=… — carga un deep-research previo persistido
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "id requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const d = await prisma.deliverable.findUnique({
    where: { id },
    select: {
      id: true,
      userQuestion: true,
      answer: true,
      chunksUsed: true,
      source: true,
      createdAt: true,
      modelUsed: true,
    },
  });
  if (!d || d.source !== "deep_research") {
    return new Response(JSON.stringify({ error: "Deep research no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return Response.json(d);
}
