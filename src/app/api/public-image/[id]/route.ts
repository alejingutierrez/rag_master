import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFromS3 } from "@/lib/s3";

export const runtime = "nodejs";

/**
 * GET /api/public-image/[id] — sirve (stream) la imagen de una pieza desde S3.
 * Pública (el bucket es privado; esto evita depender de ACLs públicas). El id es
 * un cuid no adivinable. Cache agresivo: el contenido es inmutable por versión
 * (la URL lleva ?v=timestamp que cambia al regenerar).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const d = await prisma.deliverable.findUnique({
      where: { id },
      select: { imageKey: true },
    });
    if (!d?.imageKey) {
      return new NextResponse("Not found", { status: 404 });
    }
    const buf = await getFromS3(d.imageKey);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving public image:", error);
    return new NextResponse("Error", { status: 500 });
  }
}
