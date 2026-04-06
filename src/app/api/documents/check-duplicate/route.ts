import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/documents/check-duplicate - Verificar si un documento ya existe por hash
export async function POST(request: NextRequest) {
  try {
    const { fileHash, filename } = await request.json();

    if (!fileHash) {
      return NextResponse.json(
        { error: "Se requiere fileHash" },
        { status: 400 }
      );
    }

    // Buscar por hash (contenido idéntico)
    const existing = await prisma.document.findFirst({
      where: {
        fileHash,
        status: { not: "ERROR" },
      },
      select: {
        id: true,
        filename: true,
        createdAt: true,
        status: true,
      },
    });

    if (existing) {
      return NextResponse.json({
        isDuplicate: true,
        existingId: existing.id,
        existingFilename: existing.filename,
        createdAt: existing.createdAt,
        status: existing.status,
      });
    }

    return NextResponse.json({ isDuplicate: false });
  } catch (error) {
    console.error("Error checking duplicate:", error);
    // En caso de error, permitir la carga (no bloquear)
    return NextResponse.json({ isDuplicate: false });
  }
}
