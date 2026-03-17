import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/documents/[id]/enrich - Actualizar metadata
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { metadata } = body;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    return NextResponse.json(
      { error: "Documento no encontrado" },
      { status: 404 }
    );
  }

  // Merge metadata existente con nueva
  const currentMetadata =
    typeof document.metadata === "object" && document.metadata !== null
      ? document.metadata
      : {};
  const merged = { ...(currentMetadata as Record<string, unknown>), ...metadata };

  const updated = await prisma.document.update({
    where: { id },
    data: { metadata: merged },
  });

  return NextResponse.json({ document: updated });
}
