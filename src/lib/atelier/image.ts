/**
 * Genera la imagen de portada de una pieza y la guarda en S3 + BD.
 * Compartido por el paso best-effort del Taller (after()) y el botón
 * "Generar/Regenerar imagen" de Producciones.
 *
 * `imageUrl` se guarda como la ruta pública de streaming `/api/public-image/{id}`
 * (no la URL cruda de S3): el bucket es privado y así no dependemos de ACLs.
 */
import { prisma } from "../prisma";
import { uploadToS3 } from "../s3";
import { generateImagePng, isOpenAIConfigured, type ImageSize } from "../openai-image";
import { normalizeStructured } from "../typology-schemas";
import {
  aspectForStructured,
  buildImagePrompt,
  buildEssayImagePrompt,
} from "./image-prompt";

export { isOpenAIConfigured };

export interface ImageResult {
  imageUrl: string;
  imageKey: string;
}

/** Genera + sube + persiste la imagen. Lanza en error (el caller decide). */
export async function generateAndStoreImage(deliverableId: string): Promise<ImageResult> {
  if (!isOpenAIConfigured()) throw new Error("OPENAI_API_KEY no configurado");

  const d = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: {
      id: true,
      answer: true,
      structuredData: true,
      userQuestion: true,
      question: { select: { pregunta: true } },
    },
  });
  if (!d) throw new Error("Entregable no encontrado");

  const structured = normalizeStructured(d.structuredData);
  let prompt: string;
  let size: ImageSize;
  if (structured) {
    prompt = buildImagePrompt(structured);
    size = aspectForStructured(structured);
  } else {
    const title = d.question?.pregunta ?? d.userQuestion ?? "Historia de Colombia";
    const excerpt = (d.answer ?? "").replace(/[#*>]/g, "").trim();
    const essay = buildEssayImagePrompt(title, excerpt);
    prompt = essay.prompt;
    size = essay.size;
  }

  const png = await generateImagePng({ prompt, size });
  const imageKey = `atelier-images/${deliverableId}.png`;
  await uploadToS3(imageKey, png, "image/png");

  // Cache-buster por si se regenera (la ruta es estable, el contenido cambia).
  const imageUrl = `/api/public-image/${deliverableId}?v=${Date.now()}`;

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: { imageKey, imageUrl, imageGeneratedAt: new Date() },
  });

  return { imageUrl, imageKey };
}
