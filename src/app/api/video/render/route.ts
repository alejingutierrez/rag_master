import { NextRequest } from "next/server";
import type { AwsRegion } from "@remotion/lambda/client";

export const dynamic = "force-dynamic";
// POST (dispara) y GET (progreso) son rápidos: el render pesado corre en Lambda.
export const maxDuration = 60;

/**
 * Render de la partitura a MP4 en @remotion/lambda. El render pesado (Chromium)
 * corre en la función Lambda desplegada, NO en App Runner. Flujo asíncrono:
 *   POST { score }                 → { renderId, bucketName }   (dispara)
 *   GET  ?renderId=&bucketName=    → { done, progress, url? }   (polling)
 * El MP4 de salida queda público en el bucket remotionlambda-* y se descarga
 * directo desde su URL de S3.
 *
 * Config por env con defaults del despliegue (identificadores, no secretos):
 *   REMOTION_LAMBDA_FUNCTION · REMOTION_LAMBDA_SERVE_URL · REMOTION_LAMBDA_REGION
 */
const REGION = (process.env.REMOTION_LAMBDA_REGION ||
  process.env.AWS_REGION ||
  "us-east-1") as AwsRegion;
const FUNCTION =
  process.env.REMOTION_LAMBDA_FUNCTION ||
  "remotion-render-4-0-487-mem2048mb-disk2048mb-240sec";
const SERVE_URL =
  process.env.REMOTION_LAMBDA_SERVE_URL ||
  "https://remotionlambda-useast1-4vn52i09vl.s3.us-east-1.amazonaws.com/sites/historia-video/index.html";
const COMPOSITION = "TypographicVideo";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function configured(): boolean {
  return Boolean(FUNCTION && SERVE_URL);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const score = body?.score;
  if (!score?.meta || !Array.isArray(score?.scenes)) {
    return json({ error: "Partitura requerida" }, 400);
  }
  if (!configured()) {
    return json({ error: "Render en la nube no configurado (falta la función Lambda)." }, 501);
  }
  try {
    const { renderMediaOnLambda } = await import("@remotion/lambda/client");
    const fileName = `video-${score.meta.periodCode ?? "hc"}-${score.meta.durationInFrames}.mp4`;
    const { renderId, bucketName } = await renderMediaOnLambda({
      region: REGION,
      functionName: FUNCTION,
      serveUrl: SERVE_URL,
      composition: COMPOSITION,
      inputProps: score,
      codec: "h264",
      privacy: "public",
      downloadBehavior: { type: "download", fileName },
    });
    return json({ renderId, bucketName });
  } catch (e) {
    return json({ error: "No se pudo iniciar el render: " + (e as Error).message.slice(0, 200) }, 500);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const renderId = searchParams.get("renderId");
  const bucketName = searchParams.get("bucketName");
  if (!renderId || !bucketName) {
    return json({ error: "renderId y bucketName requeridos" }, 400);
  }
  if (!configured()) {
    return json({ error: "Render en la nube no configurado." }, 501);
  }
  try {
    const { getRenderProgress } = await import("@remotion/lambda/client");
    const p = await getRenderProgress({
      renderId,
      bucketName,
      functionName: FUNCTION,
      region: REGION,
    });
    if (p.fatalErrorEncountered) {
      return json({ error: p.errors?.[0]?.message ?? "El render falló en Lambda." }, 500);
    }
    if (p.done) {
      return json({ done: true, progress: 1, url: p.outputFile });
    }
    return json({ done: false, progress: p.overallProgress ?? 0 });
  } catch (e) {
    return json({ error: "No se pudo consultar el progreso: " + (e as Error).message.slice(0, 200) }, 500);
  }
}
