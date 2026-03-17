import { NextRequest, NextResponse } from "next/server";
import { generatePresignedUploadUrl } from "@/lib/s3";

// POST /api/documents/presign - Genera una presigned URL para subir un PDF a S3
export async function POST(request: NextRequest) {
  try {
    const { filename, contentType } = await request.json();

    if (!filename) {
      return NextResponse.json(
        { error: "Se requiere el nombre del archivo" },
        { status: 400 }
      );
    }

    const s3Key = `pdfs/${Date.now()}-${filename}`;
    const { url, s3Url } = await generatePresignedUploadUrl(
      s3Key,
      contentType || "application/pdf"
    );

    return NextResponse.json({ url, s3Key, s3Url });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: "Error al generar URL de subida" },
      { status: 500 }
    );
  }
}
