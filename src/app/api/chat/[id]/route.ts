import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

// DEBE coincidir con el ERROR_PREFIX en /api/chat/route.ts (el endpoint POST).
const ERROR_PREFIX = "[[RAG_ERROR]] ";

// Tiempo máximo para considerar una generación como "stuck" (container reciclado mid-generation)
const MAX_GENERATING_MS = 12 * 60 * 1000; // 12 minutos

// GET /api/chat/[id] — endpoint de polling.
// Estados derivados de los campos existentes (sin columnas nuevas):
//   chunks=[]   + answer=""   + age < 12min → RETRIEVING  (RAG pipeline aún corriendo)
//   chunks=[]   + answer=""   + age ≥ 12min → ERROR       (container reciclado)
//   chunks≠[]   + answer=""   + age < 12min → GENERATING  (Claude redactando)
//   chunks≠[]   + answer=""   + age ≥ 12min → ERROR
//   answer=ERROR_PREFIX+msg                 → ERROR
//   answer no vacío y sin prefijo           → COMPLETE
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const conversation = await prisma.conversation.findUnique({ where: { id } });

    if (!conversation) {
      return Response.json({ error: "Conversación no encontrada" }, { status: 404 });
    }

    const { answer, createdAt, chunksUsed } = conversation;
    const ageMs = Date.now() - createdAt.getTime();
    const chunks = Array.isArray(chunksUsed) ? chunksUsed : [];

    let status: "RETRIEVING" | "GENERATING" | "COMPLETE" | "ERROR";
    let responseAnswer = answer;

    if (answer.startsWith(ERROR_PREFIX)) {
      status = "ERROR";
      responseAnswer = answer.slice(ERROR_PREFIX.length);
    } else if (answer === "") {
      if (ageMs > MAX_GENERATING_MS) {
        status = "ERROR";
        responseAnswer = "Tiempo de generación agotado. Intenta de nuevo.";
      } else {
        status = chunks.length === 0 ? "RETRIEVING" : "GENERATING";
        responseAnswer = "";
      }
    } else {
      status = "COMPLETE";
    }

    return Response.json({
      id: conversation.id,
      status,
      answer: responseAnswer,
      chunks,
      isDone: status === "COMPLETE" || status === "ERROR",
    });
  } catch (error) {
    console.error("GET /api/chat/[id] error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
