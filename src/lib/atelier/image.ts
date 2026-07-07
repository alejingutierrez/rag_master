/**
 * Pipeline de imagen de portada del Taller — el estilo de la casa, completo:
 *
 *   1. Director de arte: elige {color, objetivo, encuadre} con significado.
 *   2. Buscador de referencias: busca imágenes reales en muchas fuentes y fija
 *      el NIVEL de ancla — documental (≥5 relevantes), parcial (1-4) o
 *      solo-texto (0). Ya no es todo-o-nada: siempre se intenta la imagen.
 *   3. gpt-image-2 con estilo cerrado (plata B/N + tinta 35% + un acento) y
 *      reintentos ante la moderación estocástica: images/edits cuando hay
 *      referencias; en solo-texto, generación anclada en el texto de la pieza.
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
  generateImagePng,
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
  pieceContextExcerpt,
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
import {
  applyDocumentaryScenePlan,
  buildReferenceBriefs,
  inferDocumentaryScenePlan,
  type DocumentaryScenePlan,
} from "./scene-plan";

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

/** Nivel de anclaje visual conseguido para la imagen.
 *  - documental: ≥5 referencias relevantes reales (ideal, calidad plena).
 *  - parcial: 1-4 referencias (atmósfera) + texto de la pieza en el prompt.
 *  - solo-texto: sin referencias usables; generada desde el texto de la pieza. */
export type ImageAncla = "documental" | "parcial" | "solo-texto";

/** Se persiste en Deliverable.metadata.image — sin migración (metadata es JSONB). */
export interface ImageMeta {
  status: "generando" | "ok" | "sin_referencias" | "error";
  at: string;
  modelo?: string;
  /** Nivel de ancla documental de esta imagen (ausente en registros viejos). */
  ancla?: ImageAncla;
  acento?: {
    color: ArtDirection["accentColor"];
    objetivo: string;
    objetivoEn: string;
    razon?: string;
  };
  encuadre?: EncuadreId;
  /** Escena documental que gobierna la composición, elegida antes del acento. */
  escena?: {
    modo?: string;
    referenciaPrincipal?: ImageMetaReference & { indice: number };
    ancla?: string;
    anclaEn?: string;
    movimientoCreativo?: string;
    restricciones?: string[];
    advertencias?: string[];
  };
  referencias?: ImageMetaReference[];
  /** Diagnóstico del buscador. */
  queries?: string[];
  candidatos?: number;
  relevantes?: number;
  usables?: number;
  intentos?: number;
  error?: string;
}

/** Merge no destructivo de metadata.image (preserva metadata.atelier y demás). */
export async function persistImageMeta(deliverableId: string, image: ImageMeta): Promise<void> {
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

function sceneToMeta(
  direction: ArtDirection,
  search: ReferenceSearchResult,
  fallbackPlan: DocumentaryScenePlan | null
): ImageMeta["escena"] | undefined {
  const index = direction.primaryReferenceIndex ?? fallbackPlan?.primaryReferenceIndex;
  const ref = index ? search.refs[index - 1] : undefined;
  const ancla = direction.sceneAnchorEs ?? fallbackPlan?.anchorEs;
  const anclaEn = direction.sceneAnchor ?? fallbackPlan?.anchorEn;
  if (!direction.sceneMode && !ancla && !ref) return undefined;
  return {
    modo: direction.sceneMode ?? fallbackPlan?.mode,
    referenciaPrincipal: ref
      ? {
          indice: index!,
          titulo: ref.meta.title,
          url: ref.meta.url,
          pagina: ref.meta.page,
          fuente: ref.meta.provider,
          score: ref.meta.score,
        }
      : undefined,
    ancla,
    anclaEn,
    movimientoCreativo: direction.creativeMove ?? fallbackPlan?.creativeMove,
    restricciones:
      direction.historicalConstraints && direction.historicalConstraints.length
        ? direction.historicalConstraints
        : fallbackPlan?.constraints,
    advertencias: direction.warnings?.length ? direction.warnings : undefined,
  };
}

function existingAccentTarget(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const image = (metadata as { image?: { acento?: { objetivo?: unknown } } }).image;
  const target = image?.acento?.objetivo;
  return typeof target === "string" && target.trim() ? target.trim() : null;
}

async function siblingAccentTargets(deliverableId: string, structured: ReturnType<typeof normalizeStructured>): Promise<string[]> {
  if (!structured) return [];
  const rows = await prisma.deliverable.findMany({
    where: {
      id: { not: deliverableId },
      status: "COMPLETE",
      publishedAt: { not: null },
    },
    select: {
      structuredData: true,
      metadata: true,
      imageGeneratedAt: true,
      updatedAt: true,
    },
    orderBy: [{ imageGeneratedAt: "desc" }, { updatedAt: "desc" }],
    take: 50,
  });
  const seen = new Set<string>();
  const targets: string[] = [];
  for (const row of rows) {
    const sibling = normalizeStructured(row.structuredData);
    if (!sibling || sibling.typology !== structured.typology) continue;
    const target = existingAccentTarget(row.metadata);
    if (!target) continue;
    const key = target.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(target);
    if (targets.length >= 10) break;
  }
  return targets;
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
      metadata: true,
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
    refCtx = referenceContextFromStructured(structured, { metadata: d.metadata });
  } else {
    subject = essaySubject(titleFallback, excerpt);
    size = "1536x1024";
    refCtx = { titulo: titleFallback, resumen: excerpt.slice(0, 300) };
  }

  // 1. Referencias reales (mejor esfuerzo) + NIVEL de anclaje.
  //    Piso editorial en 3 niveles, no todo-o-nada: si no se junta el ideal de
  //    ≥5 relevantes, NO se abandona la imagen — se degrada con transparencia y
  //    se apoya en el texto de la pieza dentro del prompt (proyecto, 2026-07).
  const search = await searchReferences(refCtx);
  const hasRefs = search.refs.length > 0;
  const ancla: ImageAncla = search.ok ? "documental" : hasRefs ? "parcial" : "solo-texto";
  const degraded = ancla !== "documental";
  if (degraded) {
    console.warn(
      `[imagen ${deliverableId}] ancla ${ancla}: ${search.relevant}/${MIN_RELEVANT_REFS} relevantes, ${search.refs.length} adjuntas (de ${search.considered} candidatas). Se genera con apoyo del texto de la pieza.`
    );
  }
  const referenceHints = search.refs.map(
    (r) => `${r.meta.title || "referencia visual"} — ${r.meta.provider}, score ${r.meta.score}`
  );
  const referenceBriefs = buildReferenceBriefs(search.refs, refCtx);
  const scenePlan = structured ? inferDocumentaryScenePlan(structured, refCtx, referenceBriefs) : null;
  const avoidAccentTargets = await siblingAccentTargets(deliverableId, structured);

  // 2. Director de arte (con respaldo neutro si el LLM falla). Corre DESPUÉS
  //    de la búsqueda para que el acento pueda salir de referentes reales y no
  //    de símbolos obvios repetidos (oro/banderas/uniformes).
  const esPersona = structured?.typology === "entidad" && structured.tipo === "Persona";
  let direction: ArtDirection;
  try {
    direction = structured
      ? await directArt(
          artDirectorArgsFromStructured(
            structured,
            subject,
            periodoLabel,
            referenceHints,
            referenceBriefs,
            avoidAccentTargets
          )
        )
      : await directArt({
          titulo: refCtx.titulo,
          resumen: refCtx.resumen,
          subjectText: subject,
          referenceHints,
          referenceBriefs,
          avoidAccentTargets,
        });
  } catch (e) {
    console.warn(`[imagen ${deliverableId}] director de arte falló: ${(e as Error).message}`);
    direction = fallbackDirection({ esPersona });
  }
  direction = applyDocumentaryScenePlan(direction, scenePlan, structured?.typology) as ArtDirection;

  // Diagnóstico común del buscador para persistir en cualquier salida.
  const searchDiag = {
    queries: search.queries,
    candidatos: search.considered,
    relevantes: search.relevant,
    usables: search.usable,
  };
  const acentoMeta = {
    color: direction.accentColor,
    objetivo: direction.accentTargetEs,
    objetivoEn: direction.accentTarget,
    razon: direction.razon,
  };
  const escenaMeta = sceneToMeta(direction, search, scenePlan);

  // 3. Generación con reintentos (la moderación es estocástica). Con referencias
  //    → images/edits; sin ninguna usable → generación anclada solo en el texto.
  const contextText = degraded ? pieceContextExcerpt(d.answer) : undefined;
  const prompt = buildStyledPrompt({
    subject,
    direction,
    withReferences: hasRefs,
    contextText,
    referenceNotes: referenceHints,
  });
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  let png: Buffer | null = null;
  let attempts = 0;
  let lastErr: Error | null = null;
  for (let i = 1; i <= GENERATION_ATTEMPTS; i++) {
    attempts = i;
    try {
      png = hasRefs
        ? await editImagePng({
            prompt,
            size,
            refs: search.refs.map((r) => ({ buffer: r.buffer, name: r.name })),
          })
        : await generateImagePng({ prompt, size });
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
      ancla,
      acento: acentoMeta,
      encuadre: direction.encuadre,
      escena: escenaMeta,
      referencias: refsToMeta(search),
      ...searchDiag,
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
    ancla,
    acento: acentoMeta,
    encuadre: direction.encuadre,
    escena: escenaMeta,
    referencias: refsToMeta(search),
    ...searchDiag,
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
