/**
 * Pipeline de imagen de portada del Taller — el estilo de la casa, completo:
 *
 *   1. Director de arte: elige {color, objetivo, encuadre} con significado.
 *   2. Buscador de referencias: ≥5 imágenes reales de internet en general
 *      (piso editorial duro: sin 5 relevantes NO se genera).
 *   3. gpt-image-2 vía images/edits con las referencias adjuntas, estilo
 *      cerrado (plata B/N + tinta 35% + un acento), reintentos ante la
 *      moderación estocástica de OpenAI.
 *   4. S3 + BD, con la decisión completa persistida en metadata.image
 *      (visible y auditable desde Producciones).
 *
 * Compartido por el paso best-effort del Taller (after()) y el botón
 * "Generar/Regenerar imagen" de Producciones. `imageUrl` es la ruta pública
 * de streaming `/api/public-image/{id}` (bucket privado, sin ACLs).
 */
import { prisma } from "../prisma";
import { uploadToS3 } from "../s3";
import {
  editImagePng,
  isModerationBlocked,
  isOpenAIConfigured,
  type ImageSize,
} from "../openai-image";
import { normalizeStructured } from "../typology-schemas";
import { periodInfo } from "../design-tokens";
import {
  aspectForStructured,
  buildStyledPrompt,
  essaySubject,
  subjectFor,
} from "./image-prompt";
import {
  directArt,
  fallbackDirection,
  artDirectorArgsFromStructured,
  type ArtDirection,
  type EncuadreId,
} from "./art-director";
import {
  searchReferences,
  referenceContextFromStructured,
  MIN_RELEVANT_REFS,
  type ReferenceContext,
  type ReferenceSearchResult,
} from "./reference-search";

export { isOpenAIConfigured };

const GENERATION_ATTEMPTS = 3;

export interface ImageResult {
  imageUrl: string;
  imageKey: string;
}

/** Referencia registrada en metadata.image (auditable desde Producciones). */
export interface ImageMetaReference {
  titulo: string;
  url: string;
  pagina?: string;
  fuente: string;
  score: number;
}

/** Se persiste en Deliverable.metadata.image — sin migración (metadata es JSONB). */
export interface ImageMeta {
  status: "ok" | "sin_referencias" | "error";
  at: string;
  modelo?: string;
  acento?: {
    color: ArtDirection["accentColor"];
    objetivo: string;
    objetivoEn: string;
    razon?: string;
  };
  encuadre?: EncuadreId;
  referencias?: ImageMetaReference[];
  /** Diagnóstico del buscador. */
  queries?: string[];
  candidatos?: number;
  relevantes?: number;
  intentos?: number;
  error?: string;
}

/** Merge no destructivo de metadata.image (preserva metadata.atelier y demás). */
async function persistImageMeta(deliverableId: string, image: ImageMeta): Promise<void> {
  const cur = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: { metadata: true },
  });
  const metadata = { ...((cur?.metadata as Record<string, unknown> | null) ?? {}), image };
  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: { metadata: metadata as unknown as object },
  });
}

function refsToMeta(search: ReferenceSearchResult): ImageMetaReference[] {
  return search.refs.map((r) => ({
    titulo: r.meta.title,
    url: r.meta.url,
    pagina: r.meta.page,
    fuente: r.meta.provider,
    score: r.meta.score,
  }));
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
  const titleFallback = d.question?.pregunta ?? d.userQuestion ?? "Historia de Colombia";
  const excerpt = (d.answer ?? "").replace(/[#*>]/g, "").trim();

  // Sujeto + aspecto por tipología.
  let subject: string;
  let size: ImageSize;
  let refCtx: ReferenceContext;
  let periodoLabel = "";
  if (structured) {
    periodoLabel = structured.periodoCode ? (periodInfo(structured.periodoCode)?.label ?? "") : "";
    subject = subjectFor(structured);
    size = aspectForStructured(structured);
    refCtx = referenceContextFromStructured(structured);
  } else {
    subject = essaySubject(titleFallback, excerpt);
    size = "1536x1024";
    refCtx = { titulo: titleFallback, resumen: excerpt.slice(0, 300) };
  }

  // 1. Director de arte (con respaldo neutro si el LLM falla).
  const esPersona = structured?.typology === "entidad" && structured.tipo === "Persona";
  let direction: ArtDirection;
  try {
    direction = structured
      ? await directArt(artDirectorArgsFromStructured(structured, subject, periodoLabel))
      : await directArt({ titulo: refCtx.titulo, resumen: refCtx.resumen, subjectText: subject });
  } catch (e) {
    console.warn(`[imagen ${deliverableId}] director de arte falló: ${(e as Error).message}`);
    direction = fallbackDirection({ esPersona });
  }

  // 2. Referencias reales (piso editorial: ≥5 relevantes o no hay imagen).
  const search = await searchReferences(refCtx);
  if (!search.ok) {
    const meta: ImageMeta = {
      status: "sin_referencias",
      at: new Date().toISOString(),
      acento: {
        color: direction.accentColor,
        objetivo: direction.accentTargetEs,
        objetivoEn: direction.accentTarget,
        razon: direction.razon,
      },
      encuadre: direction.encuadre,
      queries: search.queries,
      candidatos: search.considered,
      relevantes: search.relevant,
    };
    await persistImageMeta(deliverableId, meta).catch(() => {});
    throw new Error(
      `Referencias insuficientes: ${search.relevant}/${MIN_RELEVANT_REFS} relevantes (de ${search.considered} candidatas). Sin ancla documental no se genera imagen.`
    );
  }

  // 3. Generación con referencias + reintentos (la moderación es estocástica).
  const prompt = buildStyledPrompt({ subject, direction, withReferences: true });
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  let png: Buffer | null = null;
  let attempts = 0;
  let lastErr: Error | null = null;
  for (let i = 1; i <= GENERATION_ATTEMPTS; i++) {
    attempts = i;
    try {
      png = await editImagePng({
        prompt,
        size,
        refs: search.refs.map((r) => ({ buffer: r.buffer, name: r.name })),
      });
      break;
    } catch (e) {
      lastErr = e as Error;
      const moderated = isModerationBlocked(e);
      console.warn(
        `[imagen ${deliverableId}] intento ${i}/${GENERATION_ATTEMPTS} falló${moderated ? " (moderación)" : ""}: ${lastErr.message.slice(0, 200)}`
      );
    }
  }
  if (!png) {
    const meta: ImageMeta = {
      status: "error",
      at: new Date().toISOString(),
      modelo: model,
      acento: {
        color: direction.accentColor,
        objetivo: direction.accentTargetEs,
        objetivoEn: direction.accentTarget,
        razon: direction.razon,
      },
      encuadre: direction.encuadre,
      referencias: refsToMeta(search),
      queries: search.queries,
      candidatos: search.considered,
      relevantes: search.relevant,
      intentos: attempts,
      error: lastErr?.message.slice(0, 300),
    };
    await persistImageMeta(deliverableId, meta).catch(() => {});
    throw lastErr ?? new Error("Generación de imagen falló");
  }

  // 4. S3 + BD + metadata auditable.
  const imageKey = `atelier-images/${deliverableId}.png`;
  await uploadToS3(imageKey, png, "image/png");
  const imageUrl = `/api/public-image/${deliverableId}?v=${Date.now()}`;

  const cur = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: { metadata: true },
  });
  const imageMeta: ImageMeta = {
    status: "ok",
    at: new Date().toISOString(),
    modelo: model,
    acento: {
      color: direction.accentColor,
      objetivo: direction.accentTargetEs,
      objetivoEn: direction.accentTarget,
      razon: direction.razon,
    },
    encuadre: direction.encuadre,
    referencias: refsToMeta(search),
    queries: search.queries,
    candidatos: search.considered,
    relevantes: search.relevant,
    intentos: attempts,
  };
  const metadata = {
    ...((cur?.metadata as Record<string, unknown> | null) ?? {}),
    image: imageMeta,
  };

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: {
      imageKey,
      imageUrl,
      imageGeneratedAt: new Date(),
      metadata: metadata as unknown as object,
    },
  });

  return { imageUrl, imageKey };
}
