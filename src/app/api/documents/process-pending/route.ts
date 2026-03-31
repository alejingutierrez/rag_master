import { NextResponse } from "next/server";
import { after } from "next/server";
import { processAllEmbeddings, processAllPendingDocuments } from "@/lib/embedding-processor";

export const dynamic = "force-dynamic";

// Dar tiempo suficiente para iniciar el procesamiento (after() hereda el maxDuration)
export const maxDuration = 300;

// POST /api/documents/process-pending - Recuperar todos los documentos atascados en PROCESSING
// Responde inmediatamente con la lista de documentos encontrados y dispara
// el procesamiento en background para cada uno (secuencial para no sobrecargar Bedrock).
export async function POST() {
  try {
    const { triggered, alreadyReady } = await processAllPendingDocuments();

    if (triggered.length === 0 && alreadyReady.length === 0) {
      return NextResponse.json({
        message: "No hay documentos pendientes de procesamiento",
        triggered: [],
        alreadyReady: [],
      });
    }

    // Procesar cada documento atascado en background — secuencial para
    // evitar sobrecargar Bedrock con demasiadas solicitudes concurrentes
    if (triggered.length > 0) {
      after(async () => {
        for (const docId of triggered) {
          console.log(`[process-pending] Processing stuck document ${docId}`);
          await processAllEmbeddings(docId);
        }
        console.log(`[process-pending] All ${triggered.length} stuck documents processed`);
      });
    }

    return NextResponse.json({
      message: `Procesamiento iniciado para ${triggered.length} documentos en background`,
      triggered,
      alreadyReady,
    });
  } catch (error) {
    console.error("[process-pending] Error:", error);
    return NextResponse.json(
      { error: "Error al buscar documentos pendientes" },
      { status: 500 }
    );
  }
}
