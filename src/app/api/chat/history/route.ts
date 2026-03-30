import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Forzar renderizado dinámico (no intentar conectar a DB en build time)
export const dynamic = "force-dynamic";

// GET /api/chat/history - Historial de conversaciones
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.conversation.count(),
  ]);

  return NextResponse.json({
    conversations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
