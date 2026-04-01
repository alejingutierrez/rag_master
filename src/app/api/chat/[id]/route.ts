import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({ where: { id } });

  if (!conversation) {
    return Response.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  let { status } = conversation;

  // Auto-recover stuck GENERATING jobs (> 12 minutes = container was recycled)
  if (status === "GENERATING") {
    const ageMs = Date.now() - conversation.createdAt.getTime();
    if (ageMs > 12 * 60 * 1000) {
      status = "ERROR";
      await prisma.conversation
        .update({
          where: { id },
          data: { status: "ERROR", answer: "Tiempo de generación agotado. Intenta de nuevo." },
        })
        .catch(() => {});
    }
  }

  return Response.json({
    id: conversation.id,
    status,
    answer: conversation.answer,
    isDone: status === "COMPLETE" || status === "ERROR",
  });
}
