import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { getFromS3 } from "@/lib/s3";

export const runtime = "nodejs";

/**
 * GET /api/public-image/[id] — sirve la imagen de una pieza desde S3, redimensionada
 * y en formato moderno. Pública (el bucket es privado; esto evita ACLs públicas).
 * El id es un cuid no adivinable.
 *
 * El original de gpt-image es un PNG de ~3,7 MB. Servirlo tal cual hacía que una
 * rejilla de 34 retratos pesara más de 100 MB. Aquí se reduce al ancho pedido y se
 * entrega AVIF o WebP según lo que acepte el navegador: el mismo retrato baja a
 * decenas de kilobytes.
 *
 *   ?w=<px>  ancho deseado (se ajusta a un escalón para no fragmentar la caché)
 *
 * El contenido es inmutable por versión (la URL lleva ?v=timestamp, que cambia al
 * regenerar la portada), así que se cachea un año y se memoiza en proceso.
 */

/** Anchos permitidos. Fijarlos evita que cada ?w=<arbitrario> genere una variante. */
const WIDTHS = [160, 320, 480, 640, 960, 1400] as const;
const DEFAULT_WIDTH = 960;

function snapWidth(raw: string | null): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_WIDTH;
  return WIDTHS.find((w) => w >= n) ?? WIDTHS[WIDTHS.length - 1];
}

/** El original vive en S3 y no cambia: memoizar evita ir a buscarlo en cada variante. */
const KEY_TTL_MS = 10 * 60 * 1000;
const keyCache = new Map<string, { key: string | null; at: number }>();

async function imageKeyOf(id: string): Promise<string | null> {
  const hit = keyCache.get(id);
  if (hit && Date.now() - hit.at < KEY_TTL_MS) return hit.key;
  const d = await prisma.deliverable.findUnique({
    where: { id },
    select: { imageKey: true },
  });
  const key = d?.imageKey ?? null;
  keyCache.set(id, { key, at: Date.now() });
  return key;
}

/** Caché de variantes ya transformadas. Acotada: sharp sobre un PNG de 3,7 MB cuesta. */
const VARIANT_LIMIT = 240;
const variantCache = new Map<string, { body: Buffer; type: string }>();

function rememberVariant(cacheKey: string, value: { body: Buffer; type: string }) {
  // Map conserva el orden de inserción: el primero es el usado menos recientemente.
  if (variantCache.size >= VARIANT_LIMIT) {
    const oldest = variantCache.keys().next().value;
    if (oldest !== undefined) variantCache.delete(oldest);
  }
  variantCache.set(cacheKey, value);
}

// UN SOLO formato: WebP. Antes se negociaba por `Accept` (AVIF/WebP/JPEG), y eso
// tenía dos costes: (1) obligaba a un `Vary: Accept` que multiplica las entradas
// de caché del CDN por navegador, y (2) AVIF cuesta ~2x más CPU de codificar que
// WebP, y App Runner tiene poca. WebP lo entienden todos los navegadores desde
// 2020 y ya deja las portadas en decenas de KB. Una URL = un objeto = el CDN lo
// cachea de verdad para todos los visitantes.
const MIME = "image/webp";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const width = snapWidth(req.nextUrl.searchParams.get("w"));

    const cacheKey = `${id}:${width}`;
    const cached = variantCache.get(cacheKey);
    if (cached) {
      // Reinserta para que la entrada usada vuelva al final de la cola de descarte.
      variantCache.delete(cacheKey);
      variantCache.set(cacheKey, cached);
      return imageResponse(cached.body, "hit");
    }

    const key = await imageKeyOf(id);
    if (!key) return new NextResponse("Not found", { status: 404 });

    const original = await getFromS3(key);
    const body = await sharp(original)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78, effort: 3 })
      .toBuffer();

    rememberVariant(cacheKey, { body, type: MIME });
    return imageResponse(body, "miss");
  } catch (error) {
    console.error("Error serving public image:", error);
    return new NextResponse("Error", { status: 500 });
  }
}

function imageResponse(body: Buffer, cache: string): NextResponse {
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": MIME,
      // Inmutable por versión (la URL lleva ?v=timestamp). Sin `Vary`: un solo
      // formato para todos, así CloudFront cachea la URL una vez y la reparte.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Image-Cache": cache,
    },
  });
}
