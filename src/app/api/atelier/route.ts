import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAtelier } from "@/lib/atelier/orchestrator";
import { isValidFormatId, type LongitudId } from "@/lib/atelier-formats";
import type { AtelierMetadata } from "@/lib/atelier/types";

export const dynamic = "force-dynamic";
export const maxDuration = 900; // 15 min en after(), independiente del HTTP response

/**
 * El Taller — motor agéntico de entregables pulidos.
 *
 * Mismo patrón anti-504 que deep-research: POST devuelve {deliverableId} en <1s
 * y todo corre en after(), actualizando Deliverable.metadata.atelier para que el
 * cliente lo lea vía polling de /api/deliverables/{id}.
 *
 * Fases: encuadre → acopio (cruce de fuentes) → triangulación → verificación →
 * composición → edición. El cuerpo se entrega limpio; el rigor (índice de
 * confianza + fuentes por sección) vive en metadata, no en el texto.
 */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const intent = typeof body?.intent === "string" ? body.intent.trim() : "";
  const formatId = body?.formatId;
  const longitud = body?.longitud as LongitudId | undefined;

  if (intent.length < 12) {
    return new Response(JSON.stringify({ error: "Intención requerida (≥12 caracteres)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!isValidFormatId(formatId)) {
    return new Response(JSON.stringify({ error: "Formato inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const modelUsed = process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-7";
  const batchId = `at-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const initialMetadata: AtelierMetadata = {
    stage: "encuadre",
    message: "Encuadrando el encargo…",
    formatId,
    startedAt: new Date().toISOString(),
  };

  // 1. Crear Deliverable en GENERATING inmediatamente.
  const deliverable = await prisma.deliverable.create({
    data: {
      userQuestion: intent,
      templateId: formatId,
      status: "GENERATING",
      answer: "",
      modelUsed,
      chunksUsed: [],
      metadata: { atelier: initialMetadata } as unknown as object,
      source: "atelier",
      batchId,
    },
  });

  // 2. Procesamiento en background.
  after(async () => {
    const updateMetadata = async (patch: Partial<AtelierMetadata>) => {
      try {
        const cur = await prisma.deliverable.findUnique({
          where: { id: deliverable.id },
          select: { metadata: true },
        });
        const curMeta =
          ((cur?.metadata as Record<string, unknown> | null)?.atelier as AtelierMetadata) ??
          initialMetadata;
        const newMeta = { ...curMeta, ...patch };
        await prisma.deliverable.update({
          where: { id: deliverable.id },
          data: { metadata: { atelier: newMeta } as unknown as object },
        });
      } catch (e) {
        console.warn(`[atelier ${deliverable.id}] updateMetadata failed:`, (e as Error).message);
      }
    };

    try {
      // Detección de tabla (chunks_v2 vacío en prod ⇒ chunks).
      const v2Available = await prisma
        .$queryRawUnsafe<Array<{ c: bigint }>>(
          `SELECT COUNT(*) as c FROM chunks_v2 WHERE embedding IS NOT NULL LIMIT 1`
        )
        .then((r) => Number(r[0]?.c || 0) > 0)
        .catch(() => false);
      const effectiveTable: "chunks" | "chunks_v2" = v2Available ? "chunks_v2" : "chunks";

      console.log(`[atelier ${deliverable.id}] start · formato=${formatId} · tabla=${effectiveTable}`);

      const result = await runAtelier(
        {
          intent,
          formatId,
          longitud,
          tableName: effectiveTable,
          useParentExpansion: v2Available,
        },
        { onProgress: updateMetadata }
      );

      if (!result.answer.trim()) {
        throw new Error("El Taller devolvió un entregable vacío.");
      }

      const finalMeta: AtelierMetadata = {
        ...initialMetadata,
        stage: "complete",
        message: "Entregable listo.",
        formatId,
        brief: result.brief,
        phases: result.phases,
        confidenceIndex: result.confidenceIndex,
        criticalApparatus: result.criticalApparatus,
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
          metadata: { atelier: finalMeta } as unknown as object,
        },
      });
      console.log(`[atelier ${deliverable.id}] DONE · ${finalMeta.wordCount} palabras · confianza ${result.confidenceIndex.score}`);
    } catch (err) {
      console.error(`[atelier ${deliverable.id}] FAILED:`, err);
      const msg = err instanceof Error ? err.message : "Error desconocido";
      try {
        await prisma.deliverable.update({
          where: { id: deliverable.id },
          data: {
            status: "ERROR",
            answer: `Error: ${msg}`,
            metadata: {
              atelier: {
                ...initialMetadata,
                stage: "error",
                message: msg,
                finishedAt: new Date().toISOString(),
              },
            } as unknown as object,
          },
        });
      } catch (e) {
        console.error(`[atelier ${deliverable.id}] no se pudo marcar ERROR:`, e);
      }
    }
  });

  // 3. Respuesta inmediata.
  return Response.json({
    deliverableId: deliverable.id,
    status: "GENERATING",
    pollUrl: `/api/deliverables/${deliverable.id}`,
  });
}

// GET /api/atelier?id=… — carga un entregable del Taller persistido (paridad).
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
      metadata: true,
      source: true,
      status: true,
      templateId: true,
      createdAt: true,
      updatedAt: true,
      modelUsed: true,
    },
  });
  if (!d || d.source !== "atelier") {
    return new Response(JSON.stringify({ error: "Entregable del Taller no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return Response.json(d);
}
