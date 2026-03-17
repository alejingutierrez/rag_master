import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromS3 } from "@/lib/s3";

// GET /api/documents/[id] - Detalle de documento con chunks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      chunks: {
        orderBy: { chunkIndex: "asc" },
        select: {
          id: true,
          content: true,
          pageNumber: true,
          chunkIndex: true,
          chunkSize: true,
          overlap: true,
          strategy: true,
          metadata: true,
          createdAt: true,
        },
      },
    },
  });

  if (!document) {
    return NextResponse.json(
      { error: "Documento no encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json({ document });
}

// DELETE /api/documents/[id] - Eliminar documento
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    return NextResponse.json(
      { error: "Documento no encontrado" },
      { status: 404 }
    );
  }

  // Eliminar de S3
  try {
    await deleteFromS3(document.s3Key);
  } catch (error) {
    console.error("Error deleting from S3:", error);
  }

  // Eliminar de DB (cascada elimina chunks)
  await prisma.document.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
