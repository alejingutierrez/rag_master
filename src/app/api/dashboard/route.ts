import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      documentCount,
      chunkCount,
      questionCount,
      conversationCount,
      recentDocuments,
    ] = await Promise.all([
      prisma.document.count(),
      prisma.chunk.count(),
      prisma.question.count(),
      prisma.conversation.count(),
      prisma.document.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          filename: true,
          status: true,
          pageCount: true,
          createdAt: true,
          _count: { select: { chunks: true } },
        },
      }),
    ]);

    return NextResponse.json({
      stats: {
        documents: documentCount,
        chunks: chunkCount,
        questions: questionCount,
        conversations: conversationCount,
      },
      recentDocuments,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Error al obtener estadisticas" },
      { status: 500 }
    );
  }
}
