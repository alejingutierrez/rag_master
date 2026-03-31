import { NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { processQuestionsBatch } from "@/lib/questions-batch-processor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/questions/generate-batch — Conteo de documentos pendientes + progreso
export async function GET() {
  try {
    const [pending, totalWithQuestions, totalReady] = await Promise.all([
      prisma.document.findMany({
        where: { status: "READY", questions: { none: {} } },
        select: { id: true, filename: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.document.count({
        where: { status: "READY", questions: { some: {} } },
      }),
      prisma.document.count({
        where: { status: "READY" },
      }),
    ]);

    return NextResponse.json({
      pendingCount: pending.length,
      completedCount: totalWithQuestions,
      totalReady,
      pendingDocuments: pending,
    });
  } catch (error) {
    console.error("Error fetching pending documents:", error);
    return NextResponse.json(
      { error: "Error al obtener documentos pendientes" },
      { status: 500 }
    );
  }
}

// POST /api/questions/generate-batch — Dispara generación server-side via after()
// Responde inmediatamente. El procesamiento continúa en background.
export async function POST() {
  try {
    const pendingCount = await prisma.document.count({
      where: { status: "READY", questions: { none: {} } },
    });

    if (pendingCount === 0) {
      return NextResponse.json({
        message: "No hay documentos pendientes de generación de preguntas",
        pendingCount: 0,
      });
    }

    // 🚀 Disparar procesamiento en background via after()
    // Continúa ejecutándose aunque el cliente se desconecte
    after(async () => {
      await processQuestionsBatch();
    });

    return NextResponse.json({
      message: `Generación de preguntas iniciada en background para hasta 20 de ${pendingCount} documentos pendientes`,
      pendingCount,
    });
  } catch (error) {
    console.error("Error starting batch question generation:", error);
    return NextResponse.json(
      { error: "Error al iniciar generación de preguntas" },
      { status: 500 }
    );
  }
}
