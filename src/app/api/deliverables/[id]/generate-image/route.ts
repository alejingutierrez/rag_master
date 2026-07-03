import { NextRequest, NextResponse } from "next/server";
import { generateAndStoreImage } from "@/lib/atelier/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // gpt-image puede tardar

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
