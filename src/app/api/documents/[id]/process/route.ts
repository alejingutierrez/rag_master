import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { processAllEmbeddings } from "@/lib/embedding-processor";

export const dynamic = "force-dynamic";

// Extender a 300s para que after() tenga tiempo de procesar todos los chunks
export const maxDuration = 300;

// GET /api/documents/[id]/process - Consultar progreso (solo lectura)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    return NextResponse.json(
      { error: "Documento no encontrado" },
      { status: 404 }
    );
  }

  const [totalChunks, pendingResult] = await Promise.all([
    prisma.chunk.count({ where: { documentId } }),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM chunks WHERE "documentId" = $1 AND embedding IS NULL`,
      documentId
    ),
  ]);

  const pending = Number(pendingResult[0]?.count ?? 0);

  return NextResponse.json({
    status: document.status,
    totalChunks,
    processedChunks: totalChunks - pending,
    pendingChunks: pending,
  });
}

// POST /api/documents/[id]/process - Dispara procesamiento server-side completo
// Responde inmediatamente y continúa procesando via after()
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    return NextResponse.json(
      { error: "Documento no encontrado" },
      { status: 404 }
    );
  }

  // Si ya está READY, retornar sin hacer nada
  if (document.status === "READY") {
    const totalChunks = await prisma.chunk.count({ where: { documentId } });
    return NextResponse.json({
      status: "READY",
      totalChunks,
      processedChunks: totalChunks,
      pendingChunks: 0,
    });
  }

  // Contar progreso actual
  const [totalChunks, pendingResult] = await Promise.all([
    prisma.chunk.count({ where: { documentId } }),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM chunks WHERE "documentId" = $1 AND embedding IS NULL`,
      documentId
    ),
  ]);

  const pending = Number(pendingResult[0]?.count ?? 0);

  // Si no quedan pendientes, marcar como READY
  if (pending === 0) {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "READY" },
    });
    return NextResponse.json({
      status: "READY",
      totalChunks,
      processedChunks: totalChunks,
      pendingChunks: 0,
    });
  }

  // 🚀 Disparar procesamiento completo en background via after()
  // Esto continúa ejecutándose DESPUÉS de enviar la respuesta al cliente,
  // y NO depende de que el cliente mantenga la conexión abierta.
  after(async () => {
    await processAllEmbeddings(documentId);
  });

  return NextResponse.json({
    status: "PROCESSING",
    totalChunks,
    processedChunks: totalChunks - pending,
    pendingChunks: pending,
    message: "Procesamiento iniciado en background — continuará aunque cierre el navegador",
  });
}
