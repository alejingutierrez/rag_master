import { NextRequest, NextResponse } from "next/server";
import {
  reorderQuestions,
  type ReorderDimension,
} from "@/lib/questions-orderer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VALID_DIMENSIONS: ReorderDimension[] = [
  "periodo",
  "categoria",
  "subcategoria",
  "all",
];

// POST /api/questions/reorder
// Body opcional: { dimension?: "periodo"|"categoria"|"subcategoria"|"all", documentId?: string }
// Recomputa orden* y tema* sin llamar a LLM. Idempotente.
export async function POST(request: NextRequest) {
  try {
    let dimension: ReorderDimension = "all";
    let documentId: string | undefined;

    try {
      const body = await request.json();
      if (body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        if (typeof b.dimension === "string" && VALID_DIMENSIONS.includes(b.dimension as ReorderDimension)) {
          dimension = b.dimension as ReorderDimension;
        }
        if (typeof b.documentId === "string" && b.documentId.length > 0) {
          documentId = b.documentId;
        }
      }
    } catch {
      // No body — usar defaults
    }

    const started = Date.now();
    const results = await reorderQuestions({ dimension, documentId });
    const elapsedMs = Date.now() - started;

    return NextResponse.json({
      dimension,
      documentId: documentId ?? null,
      elapsedMs,
      results,
    });
  } catch (error) {
    console.error("Error reordering questions:", error);
    return NextResponse.json(
      {
        error: "Error al reordenar preguntas",
        detail: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
