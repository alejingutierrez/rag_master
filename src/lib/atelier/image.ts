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
  isBillingHardLimit,
  isModerationBlocked,
  isOpenAIConfigured,
  type ImageSize,
} from "../openai-image";
import {
  bedrockImageModel,
  generateBedrockImagePng,
  isBedrockImageFallbackEnabled,
} from "../bedrock-image";
import { normalizeStructured, type StructuredData } from "../typology-schemas";
import { periodInfo } from "../design-tokens";
import {
  aspectForStructured,
  buildStyledPrompt,
  essaySubject,
  historicalNonLikenessSubject,
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
import { shouldUseHistoricalNonLikeness } from "./person-image-policy";

export { isOpenAIConfigured };

const GENERATION_ATTEMPTS = 3;

export interface ImageResult {
  imageUrl: string;
  imageKey: string;
}

export interface GenerateImageOptions {
  /**
   * Permite el respaldo de Bedrock cuando OpenAI no puede generar. El flujo
   * editorial ordinario conserva su configuración por env; las campañas que
   * exigen procedencia OpenAI pueden desactivarlo de forma explícita.
   */
  allowBedrockFallback?: boolean;
  /**
   * En una regeneración, conserva metadata.image y la portada vigente si
   * OpenAI falla. El error sigue llegando al caller para su bitácora, pero una
   * prueba de facturación o moderación no degrada un activo ya persistido.
   */
  preserveExistingOnError?: boolean;
  /** Exige una decisión válida del director de arte; no admite dirección neutra. */
  requireArtDirection?: boolean;
  /**
   * Permite una escena histórica explícitamente SIN semejanza facial cuando no
   * sobrevive un retrato verificable. Solo se activa de forma curada para
   * figuras pre-fotográficas; el gate de retratos ordinarios permanece intacto.
   */
  allowHistoricalNonLikeness?: boolean;
  /** Fuerza la no-semejanza aunque una búsqueda nominal encuentre una imagen. */
  forceHistoricalNonLikeness?: boolean;
}

/** Referencia registrada en metadata.image (auditable desde Producciones). */
export interface ImageMetaReference {
  titulo: string;
  url: string;
  pagina?: string;
  fuente: string;
  score: number;
  identidadVerificada?: boolean;
  razonIdentidad?: string;
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
  identidadVerificada?: number;
  identidadRequerida?: number;
  /** Tratamiento honesto de la identidad de una persona en la portada. */
  personaModo?: "retrato-identitario" | "escena-documental-sin-semejanza";
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
    identidadVerificada: r.meta.identityVerified,
    razonIdentidad: r.meta.identityReason,
  }));
}

function historicalNonLikenessReferenceContext(
  structured: StructuredData,
  base: ReferenceContext,
): ReferenceContext {
  if (structured.typology !== "entidad" || structured.tipo !== "Persona") {
    return base;
  }
  const anchors = [
    ...structured.roles,
    ...structured.relaciones,
    ...structured.hitos.map((hito) => hito.titulo),
    structured.lugarPrincipal ?? "",
    base.periodoLabel ?? "",
  ].filter(Boolean);
  return {
    titulo: `${structured.titulo}: contexto y cultura material`,
    resumen: `${structured.resumen} Busca cultura material, textiles, adornos, arquitectura, paisaje y escenas públicas verificables del pueblo, territorio y período; no un retrato de la persona.`,
    typology: "contexto histórico de persona sin retrato",
    periodoLabel: base.periodoLabel,
    entidades: [...structured.roles, ...structured.relaciones],
    lugares: structured.lugarPrincipal ? [structured.lugarPrincipal] : [],
    visualIntent: "hecho-documental",
    visualAnchors: anchors.slice(0, 14),
  };
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
export async function generateAndStoreImage(
  deliverableId: string,
  options: GenerateImageOptions = {},
): Promise<ImageResult> {
  if (!isOpenAIConfigured()) throw new Error("OPENAI_API_KEY no configurado");
  const allowBedrockFallback =
    options.allowBedrockFallback ?? isBedrockImageFallbackEnabled();

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
  let search = await searchReferences(refCtx);
  const identitySearch = search;
  const esPersona = structured?.typology === "entidad" && structured.tipo === "Persona";
  const historicalNonLikeness = shouldUseHistoricalNonLikeness({
    isPerson: esPersona,
    allow: options.allowHistoricalNonLikeness,
    force: options.forceHistoricalNonLikeness,
    identityVerified: identitySearch.identityVerified,
    identityRequired: identitySearch.identityRequired,
  });
  let sceneRefCtx = refCtx;
  if (historicalNonLikeness && structured) {
    sceneRefCtx = historicalNonLikenessReferenceContext(structured, refCtx);
    const contextual = await searchReferences(sceneRefCtx);
    search = {
      ...contextual,
      considered: identitySearch.considered + contextual.considered,
      relevant: contextual.relevant,
      usable: contextual.usable,
      queries: [...new Set([...identitySearch.queries, ...contextual.queries])],
      identityVerified: identitySearch.identityVerified,
      identityRequired: 0,
    };
  }
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
  const referenceBriefs = buildReferenceBriefs(search.refs, sceneRefCtx);
  const scenePlan = structured
    ? inferDocumentaryScenePlan(structured, sceneRefCtx, referenceBriefs)
    : null;
  const avoidAccentTargets = await siblingAccentTargets(deliverableId, structured);

  // Una referencia contextual no prueba un rostro. Para personas reales se
  // detiene la generación antes de inventar un parecido aproximado. La única
  // excepción es la escena histórica de no-semejanza, curada explícitamente:
  // representa el papel y el contexto sin afirmar que el rostro sea auténtico.
  if (
    esPersona &&
    !historicalNonLikeness &&
    identitySearch.identityVerified < identitySearch.identityRequired
  ) {
    const message = `No se encontró una referencia facial verificable de ${refCtx.titulo}; el retrato no se generó.`;
    await persistImageMeta(deliverableId, {
      status: "sin_referencias",
      at: new Date().toISOString(),
      modelo: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      ancla: "solo-texto",
      referencias: refsToMeta(identitySearch),
      queries: identitySearch.queries,
      candidatos: identitySearch.considered,
      relevantes: identitySearch.relevant,
      usables: identitySearch.usable,
      identidadVerificada: identitySearch.identityVerified,
      identidadRequerida: identitySearch.identityRequired,
      error: message,
    }).catch(() => {});
    throw new Error(message);
  }
  if (historicalNonLikeness && structured) {
    subject = historicalNonLikenessSubject(structured);
  }

  // 2. Director de arte (con respaldo neutro si el LLM falla). Corre DESPUÉS
  //    de la búsqueda para que el acento pueda salir de referentes reales y no
  //    de símbolos obvios repetidos (oro/banderas/uniformes).
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
    if (options.requireArtDirection) {
      throw new Error(
        `Dirección de arte obligatoria falló: ${(e as Error).message}`,
      );
    }
    direction = fallbackDirection({ esPersona });
  }
  direction = applyDocumentaryScenePlan(direction, scenePlan, structured?.typology) as ArtDirection;
  if (historicalNonLikeness) {
    const nonLikenessConstraint =
      "Do not claim or invent a facial likeness: keep the principal figure from behind, in obscured profile, or at medium distance without identifiable facial features.";
    direction = {
      ...direction,
      encuadre: "plano-medio",
      sceneMode: "public-scene",
      primaryReferenceIndex: undefined,
      sceneAnchor: `An evidence-led public scene about ${refCtx.titulo}, centered on documented role, territory and material culture rather than an invented face.`,
      sceneAnchorEs: `Escena pública documentada sobre ${refCtx.titulo}, centrada en su papel, territorio y cultura material, sin inventar un rostro.`,
      creativeMove:
        "A vertical medium-distance composition with the principal figure turned away or facially obscured, surrounded by historically grounded action and setting.",
      historicalConstraints: [
        ...(direction.historicalConstraints ?? []),
        nonLikenessConstraint,
        "For Muisca subjects, use woven cotton mantas, woven caps or restrained diadems and evidence-based gold ornaments; absolutely no Plains-style warbonnets, giant feather crowns, stereotyped pan-Indigenous costume or invented heraldry.",
      ],
      warnings: [
        ...(direction.warnings ?? []),
        "Sin retrato verificable: se usa escena documental de no-semejanza.",
      ],
    };
  }

  // Diagnóstico común del buscador para persistir en cualquier salida.
  const searchDiag = {
    queries: search.queries,
    candidatos: search.considered,
    relevantes: search.relevant,
    usables: search.usable,
    identidadVerificada: search.identityVerified,
    identidadRequerida: historicalNonLikeness ? 0 : search.identityRequired,
    personaModo: historicalNonLikeness
      ? "escena-documental-sin-semejanza" as const
      : esPersona
        ? "retrato-identitario" as const
        : undefined,
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
    identityName: esPersona && !historicalNonLikeness ? refCtx.titulo : undefined,
  });
  const primaryIndex =
    direction.primaryReferenceIndex ?? scenePlan?.primaryReferenceIndex ?? 1;
  const primaryReference =
    search.refs[primaryIndex - 1]?.buffer ?? search.refs[0]?.buffer;
  const configuredTimeout = Number(process.env.OPENAI_IMAGE_TIMEOUT_MS ?? "");
  const openAIImageTimeoutMs =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : undefined;
  const safeModerationPrompt =
    "Documentary editorial still life in a quiet late-twentieth-century " +
    "Colombian historical archive: an analog radio, sealed evidence boxes, " +
    "a courthouse blueprint, a city map and a manual typewriter on a worn " +
    "wooden table, connected by one muted crimson thread. Silver-gelatin " +
    "black-and-white photography with restrained ink texture and one subtle " +
    "color accent. No people, no weapons, no injuries, no explosions, no " +
    "visible text, no captions, no logos, no watermark.";
  const generateWithBedrock = async () => {
    try {
      return await generateBedrockImagePng({
        prompt,
        size,
        reference: primaryReference,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        /filtró la salida: Filter reason: prompt/i.test(error.message)
      ) {
        console.warn(
          `[imagen ${deliverableId}] Bedrock filtró el prompt; usando composición documental segura`,
        );
        return generateBedrockImagePng({
          prompt: safeModerationPrompt,
          size,
        });
      }
      throw error;
    }
  };
  let model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  let png: Buffer | null = null;
  let attempts = 0;
  let lastErr: Error | null = null;
  let useSafeOpenAIPrompt = false;
  const previousImage = (
    d.metadata && typeof d.metadata === "object"
      ? (d.metadata as { image?: ImageMeta }).image
      : undefined
  );
  if (
    previousImage?.error &&
    /moderation_blocked|safety system/i.test(previousImage.error) &&
    allowBedrockFallback
  ) {
    console.warn(
      `[imagen ${deliverableId}] moderación previa agotada; usando respaldo Bedrock ${bedrockImageModel()}`,
    );
    try {
      attempts = 1;
      png = await generateWithBedrock();
      model = bedrockImageModel();
    } catch (fallbackError) {
      lastErr = fallbackError as Error;
      console.warn(
        `[imagen ${deliverableId}] respaldo Bedrock falló: ${lastErr.message.slice(0, 200)}`,
      );
    }
  }
  for (let i = 1; i <= GENERATION_ATTEMPTS && !png; i++) {
    attempts = i;
    try {
      // Si una composición sensible fue bloqueada, el siguiente intento se
      // mantiene en OpenAI pero pasa a una naturaleza muerta documental sin
      // personas ni referencias visuales potencialmente problemáticas. Para
      // retratos no se aplica: la identidad verificada sigue siendo obligatoria.
      png = useSafeOpenAIPrompt && !esPersona
        ? await generateImagePng({
            prompt: safeModerationPrompt,
            size,
            timeoutMs: openAIImageTimeoutMs,
          })
        : hasRefs
        ? await editImagePng({
            prompt,
            size,
          quality: esPersona ? "high" : undefined,
          timeoutMs: openAIImageTimeoutMs,
          refs: search.refs.map((r) => ({ buffer: r.buffer, name: r.name })),
        })
        : await generateImagePng({
            prompt,
            size,
            quality: esPersona ? "high" : undefined,
            timeoutMs: openAIImageTimeoutMs,
          });
      break;
    } catch (e) {
      lastErr = e as Error;
      if (isBillingHardLimit(e)) {
        if (allowBedrockFallback) {
          console.warn(
            `[imagen ${deliverableId}] límite de OpenAI; usando respaldo Bedrock ${bedrockImageModel()}`,
          );
          try {
            png = await generateWithBedrock();
            model = bedrockImageModel();
          } catch (fallbackError) {
            lastErr = fallbackError as Error;
            console.warn(
              `[imagen ${deliverableId}] respaldo Bedrock falló: ${lastErr.message.slice(0, 200)}`,
            );
          }
        }
        // Un límite de facturación no cambia entre reintentos inmediatos.
        break;
      }
      const moderated = isModerationBlocked(e);
      if (moderated && !esPersona) useSafeOpenAIPrompt = true;
      console.warn(
        `[imagen ${deliverableId}] intento ${i}/${GENERATION_ATTEMPTS} falló${moderated ? " (moderación)" : ""}: ${lastErr.message.slice(0, 200)}`,
      );
    }
  }
  if (
    !png &&
    lastErr &&
    isModerationBlocked(lastErr) &&
    allowBedrockFallback
  ) {
    console.warn(
      `[imagen ${deliverableId}] moderación agotada; usando respaldo Bedrock ${bedrockImageModel()}`,
    );
    try {
      png = await generateWithBedrock();
      model = bedrockImageModel();
    } catch (fallbackError) {
      lastErr = fallbackError as Error;
      console.warn(
        `[imagen ${deliverableId}] respaldo Bedrock falló: ${lastErr.message.slice(0, 200)}`,
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
    if (!options.preserveExistingOnError || previousImage?.status !== "ok") {
      await persistImageMeta(deliverableId, meta).catch(() => {});
    }
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
