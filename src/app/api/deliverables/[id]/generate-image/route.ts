import { NextRequest, NextResponse } from "next/server";
import { generateAndStoreImage } from "@/lib/atelier/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// El pipeline completo tarda: queries LLM + búsqueda multi-fuente + puntuación +
// descarga de referencias + gpt-image (con reintentos de moderación).
export const maxDuration = 600;

// POST /api/deliverables/[id]/generate-image — genera (o regenera) la portada.
// Gateado por el middleware (solo admin: consume créditos de OpenAI).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await generateAndStoreImage(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error generando imagen";
    console.error("Error generating image:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
