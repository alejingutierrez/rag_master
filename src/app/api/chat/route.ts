import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { askClaude } from "@/lib/claude";
import { runRagPipeline } from "@/lib/rag-pipeline";
import { validateAndClean } from "@/lib/citation-validator";
import { getTemplateById, DEFAULT_TEMPLATE_ID } from "@/lib/chat-templates";

// Flag para habilitar validación post-hoc de citas inline `[#N]`.
// Solo aplica si el template usa citas inline (no si usa APA al final).
const ENABLE_CITATION_VALIDATION =
  (process.env.ENABLE_CITATION_VALIDATION ?? "true").toLowerCase() === "true";

// El response HTTP retorna en <2s porque TODO el pipeline (RAG + Claude) corre en after().
// 300s sigue siendo el cap del background work para AppRunner.
export const maxDuration = 300;

// Prefijo que distingue un mensaje de error de una respuesta real.
// DEBE coincidir con el ERROR_PREFIX en /api/chat/[id]/route.ts (el endpoint de polling).
const ERROR_PREFIX = "[[RAG_ERROR]] ";

// POST /api/chat — RAG pipeline: embedding + search, crea registro, Claude corre en after().
// No depende de columnas nuevas: usa answer="" (generando) / respuesta real (listo) / ERROR (fallo).
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  try {
    return await handleChat(body);
  } catch (error) {
    // Aquí solo llegan errores del path síncrono (validación, lookup de config,
    // creación inicial de los registros). El throttle/lentitud de Bedrock ahora
    // vive en after() — el cliente lo recibe como status=ERROR vía polling.
    console.error("POST /api/chat error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// Contexto analítico opcional de una pregunta curada del corpus.
// Cuando el chat se abre desde /questions (drawer), todos estos campos viajan
// del cliente al server para enriquecer el system prompt — el LLM responde
// "sabiendo" qué quería el investigador.
interface QuestionContext {
  periodoCode?: string;
  periodoNombre?: string;
  periodoRango?: string;
  categoriaCode?: string;
  categoriaNombre?: string;
  subcategoriaCode?: string;
  subcategoriaNombre?: string;
  tipoPregunta?: string;
  escalaGeografica?: string;
  clusterTematico?: string;
  hipotesisImplicita?: string;
  justificacion?: string;
  yearPrincipal?: number | null;
  yearsSecondary?: number[];
  entidadesPersonas?: string[];
  entidadesLugares?: string[];
  entidadesConceptos?: string[];
}

function buildContextPreamble(ctx: QuestionContext): string {
  const lines: string[] = [];
  if (ctx.periodoNombre || ctx.periodoCode) {
    lines.push(
      `- Período histórico: ${ctx.periodoNombre ?? ctx.periodoCode}${ctx.periodoRango ? ` (${ctx.periodoRango})` : ""}`
    );
  }
  if (ctx.categoriaNombre || ctx.categoriaCode) {
    const sub = ctx.subcategoriaNombre ? ` · ${ctx.subcategoriaNombre}` : "";
    lines.push(`- Categoría: ${ctx.categoriaNombre ?? ctx.categoriaCode}${sub}`);
  }
  if (ctx.tipoPregunta) {
    lines.push(`- Tipo analítico: ${ctx.tipoPregunta} (orienta el enfoque de la respuesta)`);
  }
  if (ctx.escalaGeografica) {
    lines.push(`- Escala geográfica dominante: ${ctx.escalaGeografica}`);
  }
  if (ctx.yearPrincipal) {
    const sec = ctx.yearsSecondary?.length
      ? `; años secundarios: ${ctx.yearsSecondary.join(", ")}`
      : "";
    lines.push(`- Anclaje temporal: año principal ${ctx.yearPrincipal}${sec}`);
  }
  if (ctx.clusterTematico) {
    lines.push(`- Cluster temático del corpus: "${ctx.clusterTematico}"`);
  }
  const entidades: string[] = [];
  if (ctx.entidadesPersonas?.length) entidades.push(`Personas: ${ctx.entidadesPersonas.join(", ")}`);
  if (ctx.entidadesLugares?.length) entidades.push(`Lugares: ${ctx.entidadesLugares.join(", ")}`);
  if (ctx.entidadesConceptos?.length) entidades.push(`Conceptos: ${ctx.entidadesConceptos.join(", ")}`);
  if (entidades.length > 0) {
    lines.push(`- Entidades clave que la pregunta privilegia:\n    ${entidades.join("\n    ")}`);
  }
  if (ctx.hipotesisImplicita) {
    lines.push(`- Hipótesis implícita (tesis que la pregunta sostiene): ${ctx.hipotesisImplicita}`);
  }
  if (ctx.justificacion) {
    lines.push(`- Justificación curatorial: ${ctx.justificacion}`);
  }
  if (lines.length === 0) return "";
  return [
    "[CONTEXTO ANALÍTICO — esta pregunta viene del corpus curado de historia de Colombia. Úsalo para enmarcar tu respuesta sin repetirlo verbatim al lector.]",
    ...lines,
    "",
    "[PREGUNTA DEL INVESTIGADOR]",
  ].join("\n");
}

async function handleChat(body: Record<string, unknown>) {
  const {
    question,
    topK = 100,
    similarityThreshold = 0.25,
    maxTokens,                 // undefined → askClaude usa template.maxTokens
    documentIds,
    configurationId,
    templateId,
    questionContext,
    questionId,
  } = body as {
    question?: string;
    topK?: number;
    similarityThreshold?: number;
    maxTokens?: number;
    documentIds?: string[];
    configurationId?: string;
    templateId?: string;
    questionContext?: QuestionContext;
    questionId?: string;
  };

  if (!question || typeof question !== "string" || !question.trim()) {
    return Response.json({ error: "Se requiere una pregunta" }, { status: 400 });
  }

  // Validar que la pregunta sea suficientemente específica.
  // Una pregunta como "cuentame la historia" no puede ser respondida sin ambigüedad.
  const wordCount = question.trim().split(/\s+/).filter((w) => w.length >= 2).length;
  if (wordCount < 4) {
    return Response.json(
      {
        error:
          "Tu pregunta es muy general. Por favor incluye el sujeto (persona, evento, concepto) y al menos un detalle adicional. Ejemplo: 'cuentame la historia de Manuel Cepeda Vargas' o '¿qué pasó en el Palacio de Justicia en 1985?'",
      },
      { status: 422 }
    );
  }

  // 1. Resolver configuración. maxTokens undefined → askClaude usa template.
  let config: {
    topK: number;
    similarityThreshold: number;
    maxTokens?: number;
  } = {
    topK: topK as number,
    similarityThreshold: similarityThreshold as number,
    maxTokens,
  };
  if (configurationId) {
    const dbConfig = await prisma.configuration.findUnique({
      where: { id: configurationId as string },
    });
    if (dbConfig) {
      config = {
        topK: dbConfig.topK,
        similarityThreshold: dbConfig.similarityThreshold,
        maxTokens: dbConfig.maxTokens,
      };
    }
  }

  // 2. Crear registros con status RETRIEVING (chunks aún vacíos).
  // El response retorna inmediatamente con el id — el cliente hace polling.
  // TODO el pipeline (RAG + Claude) corre en after() para evitar que AppRunner
  // cancele la conexión a los 120s (causa raíz del 504 que rompía /api/chat).
  const modelUsed =
    process.env.BEDROCK_CLAUDE_MODEL_ID ||
    "us.anthropic.claude-opus-4-6-20250610-v1:0";
  const effectiveTemplateId = (templateId as string) || DEFAULT_TEMPLATE_ID;

  // Linkeo a la pregunta: questionId explícito o el id embebido en questionContext.
  const linkedQuestionId =
    typeof questionId === "string" && questionId
      ? questionId
      : questionContext && typeof (questionContext as { id?: unknown }).id === "string"
        ? (questionContext as { id: string }).id
        : undefined;

  // Resiliencia: ignora un questionId inexistente en vez de fallar con 500.
  let safeQuestionId = linkedQuestionId;
  if (safeQuestionId) {
    const exists = await prisma.question
      .findUnique({ where: { id: safeQuestionId }, select: { id: true } })
      .catch(() => null);
    if (!exists) safeQuestionId = undefined;
  }

  const [conversation, deliverable] = await Promise.all([
    prisma.conversation.create({
      data: {
        question,
        answer: "",
        modelUsed,
        templateId: effectiveTemplateId,
        chunksUsed: [],
        configurationId: (configurationId as string) || null,
      },
    }),
    prisma.deliverable.create({
      data: {
        userQuestion: question,
        templateId: effectiveTemplateId,
        status: "GENERATING",
        answer: "",
        modelUsed,
        chunksUsed: [],
        source: "chat",
        batchId: `chat-${Date.now()}`,
        questionId: safeQuestionId,
      },
    }),
  ]);

  // 3. RAG pipeline + Claude corren en background.
  after(async () => {
    try {
      // 3a. Detectar tablas disponibles
      const v2Available = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
        `SELECT COUNT(*) as c FROM chunks_v2 WHERE embedding IS NOT NULL LIMIT 1`
      ).then((r) => Number(r[0]?.c || 0) > 0).catch(() => false);

      const bm25Available = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
        `SELECT EXISTS(
           SELECT 1 FROM information_schema.columns
           WHERE table_name = '${v2Available ? "chunks_v2" : "chunks"}' AND column_name = 'content_fts'
         ) as exists`
      ).then((r) => r[0]?.exists || false).catch(() => false);

      const effectiveTable = v2Available ? "chunks_v2" : "chunks";

      // 3b. Pipeline RAG (puede tardar 30-120s — ya no bloquea el HTTP response).
      // finalTopK=50 alinea LLM ↔ BD ↔ UI: Claude ve exactamente los 50 que
      // se persisten en chunksUsed y que el panel "Fuentes" muestra. Así
      // toda cita inline [#N] siempre tiene un ChunkCard abrible.
      const ragResult = await runRagPipeline(question, {
        tableName: effectiveTable,
        useBM25: bm25Available,
        useReranker: true,
        useQueryExpansion: true,
        useParentExpansion: v2Available,
        documentIds: documentIds as string[] | undefined,
        finalTopK: 50,
      });

      const chunks = ragResult.chunks;

      if (chunks.length === 0) {
        const msg = "No se encontraron fragmentos relevantes. Intenta reformular la pregunta con más detalles específicos (nombres, fechas, lugares).";
        await Promise.all([
          prisma.conversation.update({
            where: { id: conversation.id },
            data: { answer: ERROR_PREFIX + msg },
          }),
          prisma.deliverable.update({
            where: { id: deliverable.id },
            data: { status: "ERROR", answer: ERROR_PREFIX + msg },
          }),
        ]);
        return;
      }

      // 3c. Persistir chunks para que el polling los muestre antes de la respuesta.
      // No hace falta slice aquí: el pipeline ya devuelve ≤50 (finalTopK).
      const chunksMetadata = chunks.map((c) => ({
        id: c.id,
        documentId: c.documentId,
        documentFilename: c.documentFilename,
        pageNumber: c.pageNumber,
        chunkIndex: c.chunkIndex,
        similarity: c.similarity,
        content: c.content.slice(0, 400) + (c.content.length > 400 ? "…" : ""),
      }));

      await Promise.all([
        prisma.conversation.update({
          where: { id: conversation.id },
          data: { chunksUsed: chunksMetadata },
        }),
        prisma.deliverable.update({
          where: { id: deliverable.id },
          data: { chunksUsed: chunksMetadata },
        }),
      ]);

      // 3d. Claude.
      // Si vino contexto analítico de una pregunta curada, prependemos un
      // preámbulo al texto que ve el LLM. La pregunta persistida en BD
      // permanece intacta (sin contaminar la UI con el preamble).
      const preamble = questionContext ? buildContextPreamble(questionContext) : "";
      const enrichedQuestion = preamble ? `${preamble}\n${question}` : question;

      const claudeStream = await askClaude(
        enrichedQuestion,
        chunks,
        config.maxTokens,
        { templateId: templateId as string | undefined }
      );

      const reader = claudeStream.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (typeof data.text === "string") fullAnswer += data.text;
          } catch { /* líneas no-JSON */ }
        }
      }

      // Validación post-hoc de citas inline [#N].
      // Aplica si el template marca explícitamente usesInlineCitations,
      // o si NO añade APA al final (en cuyo caso el modelo usa [#N] inline por default).
      const tpl = getTemplateById((templateId as string) || DEFAULT_TEMPLATE_ID);
      const usesInlineCitations =
        tpl?.usesInlineCitations === true ||
        (tpl?.appendApaReferences !== true && tpl?.usesInlineCitations !== false);

      let finalAnswer = fullAnswer;
      if (ENABLE_CITATION_VALIDATION && usesInlineCitations && fullAnswer.length > 100) {
        try {
          const validated = await validateAndClean(fullAnswer, chunks);
          if (validated.removedCount > 0) {
            console.log(
              `[chat] Validación: ${validated.removedCount}/${validated.totalSentencesWithCitations} oraciones removidas por citas inválidas (factuality=${(validated.factualityRate * 100).toFixed(0)}%)`
            );
            finalAnswer = validated.cleanedAnswer;
          }
        } catch (e) {
          console.warn("[chat] Validación falló (continuando con respuesta sin validar):", (e as Error).message);
        }
      }

      // La APA del sistema ya viene incrustada al final del stream de askClaude
      // (cuando template.appendApaReferences=true). No la añadimos aquí otra vez
      // — eso era el bug histórico de bibliografía duplicada.
      // Pero el modelo a veces escribe su propia "## Bibliografía" en contra del
      // prompt; el cleanup deja solo la última (la del sistema).
      const { stripDuplicateBibliography } = await import("@/lib/apa-citations");
      const fullWithRefs = stripDuplicateBibliography(finalAnswer);

      await Promise.all([
        prisma.conversation.update({
          where: { id: conversation.id },
          data: { answer: fullWithRefs },
        }),
        prisma.deliverable.update({
          where: { id: deliverable.id },
          data: { answer: fullWithRefs, status: "COMPLETE" },
        }),
      ]);
    } catch (error) {
      console.error("Background Claude error:", error);
      const msg = error instanceof Error ? error.message : "Error al generar respuesta";
      await Promise.all([
        prisma.conversation.update({
          where: { id: conversation.id },
          data: { answer: ERROR_PREFIX + msg },
        }).catch(() => {}),
        prisma.deliverable.update({
          where: { id: deliverable.id },
          data: { status: "ERROR", answer: ERROR_PREFIX + msg },
        }).catch(() => {}),
      ]).catch((e) => console.error("Error saving error state:", e));
    }
  });

  // 4. Devolver en <1s — el cliente entra a fase "searching" y hace polling.
  // chunks vacíos: GET /api/chat/[id] los devuelve cuando RAG termine.
  return Response.json({
    id: conversation.id,
    deliverableId: deliverable.id,
    chunks: [],
    totalChunksUsed: 0,
  });
}
