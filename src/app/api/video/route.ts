import { NextRequest, after } from "next/server";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { generateVideoScore } from "@/lib/video/generate";
import { VIDEO_STYLES, getStyle } from "@/lib/video/styles";

export const dynamic = "force-dynamic";
export const maxDuration = 3600; // el Director + búsqueda de archivo puede tardar en after()

/**
 * Generador de video tipográfico. Mismo patrón anti-504 del Taller: POST crea un
 * Deliverable (source="video") en GENERATING y devuelve {deliverableId} en <1s;
 * todo corre en after(), guardando la partitura en metadata.video para que el
 * cliente la lea por polling de /api/deliverables/{id} y la previsualice con
 * @remotion/player (sin renderizar).
 */
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  const styleId = typeof body?.styleId === "string" ? body.styleId : "hueso-y-ceniza";
  const durationSec = Math.min(90, Math.max(15, Number(body?.durationSec) || 30));

  if (topic.length < 3) return json({ error: "Tema requerido (≥3 caracteres)" }, 400);
  if (!VIDEO_STYLES.some((s) => s.id === styleId)) return json({ error: "Tipo inválido" }, 400);

  const style = getStyle(styleId);
  const initial = {
    stage: "iniciando",
    message: "Preparando…",
    topic, styleId, styleLabel: style.label, durationSec,
    startedAt: new Date().toISOString(),
  };

  const deliverable = await prisma.deliverable.create({
    data: {
      userQuestion: topic,
      templateId: styleId,
      status: "GENERATING",
      answer: "",
      modelUsed: process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-8",
      chunksUsed: [],
      metadata: { video: initial } as unknown as object,
      source: "video",
      batchId: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
  });

  after(async () => {
    const patch = async (p: Record<string, unknown>) => {
      try {
        const cur = await prisma.deliverable.findUnique({ where: { id: deliverable.id }, select: { metadata: true } });
        const curMeta = (cur?.metadata as Record<string, unknown> | null) ?? {};
        const curVideo = (curMeta.video as Record<string, unknown>) ?? initial;
        await prisma.deliverable.update({
          where: { id: deliverable.id },
          data: { metadata: { ...curMeta, video: { ...curVideo, ...p } } as unknown as object },
        });
      } catch { /* resiliente */ }
    };
    try {
      const { score, styleLabel, imagesUsed } = await generateVideoScore({
        topic, styleId, durationSec,
        destDir: join(process.cwd(), "public", "img"),
        onStage: (s, d) => patch({ stage: s, message: d ?? s }),
      });
      await prisma.deliverable.update({
        where: { id: deliverable.id },
        data: {
          status: "COMPLETE",
          answer: score.meta.title,
          metadata: {
            video: { stage: "listo", topic, styleId, styleLabel, durationSec, imagesUsed, score, finishedAt: new Date().toISOString() },
          } as unknown as object,
        },
      });
    } catch (e) {
      await patch({ stage: "error", error: (e as Error).message });
      await prisma.deliverable.update({ where: { id: deliverable.id }, data: { status: "ERROR" } }).catch(() => {});
    }
  });

  return json({ deliverableId: deliverable.id, pollUrl: `/api/deliverables/${deliverable.id}` });
}
