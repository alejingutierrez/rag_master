import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAtelier } from "@/lib/atelier/orchestrator";
import { isValidFormatId, type LongitudId } from "@/lib/atelier-formats";
import type { AtelierMetadata } from "@/lib/atelier/types";

export const dynamic = "force-dynamic";
export const maxDuration = 900; // El Taller en after(), igual que /api/atelier

/**
 * POST /api/preguntas-madre/[id]/produce
 *
 * Produce un entregable a partir de una pregunta-madre vía El Taller. El intent
 * se construye con la pregunta + el problema subyacente + las tesis en tensión,
 * de modo que el entregable SOSTENGA el contraste cross-libro (no lo aplane).
 * Mismo patrón anti-504 que /api/atelier: POST <1s, todo en after().
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const formatId = body?.formatId;
  const longitud = body?.longitud as LongitudId | undefined;

  if (!isValidFormatId(formatId)) {
    return Response.json({ error: "Formato inválido" }, { status: 400 });
  }

  const master = await prisma.masterQuestion.findUnique({
    where: { id },
    select: { id: true, pregunta: true, problemaSubyacente: true, tesisEnTension: true },
  });
  if (!master) return Response.json({ error: "Pregunta-madre no encontrada" }, { status: 404 });

  const tesis = Array.isArray(master.tesisEnTension)
    ? (master.tesisEnTension as Array<{ tesis?: string } | string>)
    : [];
  const tesisTxt = tesis
    .map((t, i) => `${i + 1}) ${typeof t === "string" ? t : t.tesis ?? ""}`)
    .filter((s) => s.trim().length > 3)
    .join("\n");

  const intent =
    `${master.pregunta}\n\nProblema histórico de fondo: ${master.problemaSubyacente}` +
    (tesisTxt ? `\n\nSostén y confronta explícitamente estas tesis en tensión:\n${tesisTxt}` : "");

  const modelUsed = process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-7";
  const batchId = `mq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const initialMetadata: AtelierMetadata = {
    stage: "encuadre",
    message: "Encuadrando el encargo…",
    formatId,
    startedAt: new Date().toISOString(),
  };

  const deliverable = await prisma.deliverable.create({
    data: {
      userQuestion: master.pregunta,
      templateId: formatId,
      status: "GENERATING",
      answer: "",
      modelUsed,
      chunksUsed: [],
      metadata: { atelier: initialMetadata, masterId: master.id } as unknown as object,
      source: "master",
      batchId,
      questionId: null,
    },
  });

  after(async () => {
    const updateMetadata = async (patch: Partial<AtelierMetadata>) => {
      try {
        const cur = await prisma.deliverable.findUnique({
          where: { id: deliverable.id },
          select: { metadata: true },
        });
        const meta = (cur?.metadata as Record<string, unknown> | null) ?? {};
        const curAtelier = (meta.atelier as AtelierMetadata) ?? initialMetadata;
        await prisma.deliverable.update({
          where: { id: deliverable.id },
          data: { metadata: { ...meta, atelier: { ...curAtelier, ...patch }, masterId: master.id } as unknown as object },
        });
      } catch (e) {
        console.warn(`[mq ${deliverable.id}] updateMetadata:`, (e as Error).message);
      }
    };

    try {
      const v2Available = await prisma
        .$queryRawUnsafe<Array<{ c: bigint }>>(
          `SELECT COUNT(*) as c FROM chunks_v2 WHERE embedding IS NOT NULL LIMIT 1`
        )
        .then((r) => Number(r[0]?.c || 0) > 0)
        .catch(() => false);
      const effectiveTable: "chunks" | "chunks_v2" = v2Available ? "chunks_v2" : "chunks";

      const result = await runAtelier(
        { intent, formatId, longitud, tableName: effectiveTable, useParentExpansion: v2Available },
        { onProgress: updateMetadata }
      );

      if (!result.answer.trim()) throw new Error("El Taller devolvió un entregable vacío.");

      const finalMeta: AtelierMetadata = {
        ...initialMetadata,
        stage: "complete",
        message: "Entregable listo.",
        formatId,
        brief: result.brief,
        phases: result.phases,
        confidenceIndex: result.confidenceIndex,
        criticalApparatus: result.criticalApparatus,
        taxonomy: result.taxonomy,
        qualityScore: result.qualityScore,
        docCount: result.confidenceIndex.documentosUnicos,
        wordCount: result.answer.trim().split(/\s+/).length,
        degraded: result.degraded,
        finishedAt: new Date().toISOString(),
      };

      await prisma.deliverable.update({
        where: { id: deliverable.id },
        data: {
          status: "COMPLETE",
          answer: result.answer,
          chunksUsed: result.chunksUsed as unknown as object,
          metadata: { atelier: finalMeta, masterId: master.id } as unknown as object,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      console.error(`[mq ${deliverable.id}] FAILED:`, msg);
      await prisma.deliverable
        .update({
          where: { id: deliverable.id },
          data: {
            status: "ERROR",
            answer: `Error: ${msg}`,
            metadata: { atelier: { ...initialMetadata, stage: "error", message: msg, finishedAt: new Date().toISOString() }, masterId: master.id } as unknown as object,
          },
        })
        .catch(() => {});
    }
  });

  return Response.json({
    deliverableId: deliverable.id,
    status: "GENERATING",
    pollUrl: `/api/deliverables/${deliverable.id}`,
  });
}
