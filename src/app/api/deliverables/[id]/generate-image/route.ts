import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateAndStoreImage,
  isOpenAIConfigured,
  persistImageMeta,
  type ImageMeta,
} from "@/lib/atelier/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900; // el trabajo corre en after(); la respuesta HTTP es inmediata

// Una generación se considera colgada (y re-lanzable) pasado este umbral.
const STALE_MS = 12 * 60 * 1000;

/**
 * POST /api/deliverables/[id]/generate-image — genera (o regenera) la portada.
 *
 * PATRÓN ANTI-504 (App Runner corta peticiones largas): responde de inmediato
 * con `{status:"generando"}` y corre el pipeline completo en after() — director
 * de arte → referencias (nivel de ancla) → gpt-image-2 → S3/BD. El cliente hace
 * polling de /api/deliverables/{id} y lee metadata.image.
 * Gateado por el middleware (solo admin: consume créditos de OpenAI/Bedrock).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isOpenAIConfigured()) {
    return NextResponse.json({ error: "OPENAI_API_KEY no configurado" }, { status: 503 });
  }

  const d = await prisma.deliverable.findUnique({
    where: { id },
    select: { id: true, metadata: true },
  });
  if (!d) {
    return NextResponse.json({ error: "Entregable no encontrado" }, { status: 404 });
  }

  // Evita generaciones concurrentes sobre la misma pieza (doble clic, doble pestaña).
  const current = (d.metadata as { image?: ImageMeta } | null)?.image;
  if (current?.status === "generando") {
    const startedAt = current.at ? Date.parse(current.at) : 0;
    if (Date.now() - startedAt < STALE_MS) {
      return NextResponse.json(
        { error: "Ya hay una generación en curso para esta pieza." },
        { status: 409 },
      );
    }
  }

  await persistImageMeta(id, { status: "generando", at: new Date().toISOString() });

  after(async () => {
    try {
      const { imageUrl } = await generateAndStoreImage(id);
      console.log(`[imagen ${id}] lista · ${imageUrl}`);
    } catch (e) {
      // generateAndStoreImage ya persiste el "error" en sus rutas conocidas;
      // esto cubre fallos tempranos para no dejar "generando" colgado.
      const msg = e instanceof Error ? e.message : "Error generando imagen";
      console.warn(`[imagen ${id}] falló:`, msg);
      const fresh = await prisma.deliverable
        .findUnique({ where: { id }, select: { metadata: true } })
        .catch(() => null);
      const meta = (fresh?.metadata as { image?: ImageMeta } | null)?.image;
      if (!meta || meta.status === "generando") {
        await persistImageMeta(id, {
          status: "error",
          at: new Date().toISOString(),
          error: msg.slice(0, 300),
        }).catch(() => {});
      }
    }
  });

  return NextResponse.json({ started: true, status: "generando" }, { status: 202 });
}
