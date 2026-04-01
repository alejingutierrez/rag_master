import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

// Debe coincidir con el prefijo en route.ts
const ERROR_PREFIX = "\u0000ERROR:";

// Tiempo máximo para considerar una generación como "stuck" (container reciclado mid-generation)
const MAX_GENERATING_MS = 12 * 60 * 1000; // 12 minutos

// GET /api/chat/[id] — endpoint de polling.
// Deriva el estado desde los campos existentes (sin columnas nuevas):
//   answer=""   + age < 12min  → GENERATING
//   answer=""   + age ≥ 12min  → ERROR (container reciclado)
//   answer=ERROR_PREFIX+msg    → ERROR
//   cualquier otro answer      → COMPLETE
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

    const { answer, createdAt } = conversation;
    const ageMs = Date.now() - createdAt.getTime();

    let status: "GENERATING" | "COMPLETE" | "ERROR";
    let responseAnswer = answer;

    if (answer === "") {
      // Todavía generando, o el container fue reciclado mid-generation
      if (ageMs > MAX_GENERATING_MS) {
        status = "ERROR";
        responseAnswer = "Tiempo de generación agotado. Intenta de nuevo.";
      } else {
        status = "GENERATING";
        responseAnswer = "";
      }
    } else if (answer.startsWith(ERROR_PREFIX)) {
      status = "ERROR";
      responseAnswer = answer.slice(ERROR_PREFIX.length);
    } else {
      status = "COMPLETE";
    }

    return Response.json({
      id: conversation.id,
      status,
      answer: responseAnswer,
      isDone: status !== "GENERATING",
    });
  } catch (error) {
    console.error("GET /api/chat/[id] error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
