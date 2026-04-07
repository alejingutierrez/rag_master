/**
 * order-questions.mts — Asigna orden logico y temas a preguntas por periodo, categoria y subcategoria.
 *
 * Uso:
 *   npx tsx scripts/order-questions.mts                          # procesa todas las dimensiones
 *   npx tsx scripts/order-questions.mts --dimension periodo      # solo periodos
 *   npx tsx scripts/order-questions.mts --dimension categoria    # solo categorias
 *   npx tsx scripts/order-questions.mts --dimension subcategoria # solo subcategorias
 *   npx tsx scripts/order-questions.mts --dry-run                # muestra grupos sin llamar a Claude
 */

import { PrismaClient } from "@prisma/client";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import "dotenv/config";

// Unbuffered logging (stderr is not buffered, stdout is)
const log = (msg: string) => process.stderr.write(msg + "\n");

// ─── Config ──────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

const awsConfig = {
  region: process.env.AWS_REGION || process.env.APP_AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId:
      process.env.AWS_ACCESS_KEY_ID || process.env.APP_ACCESS_KEY_ID || "",
    secretAccessKey:
      process.env.AWS_SECRET_ACCESS_KEY ||
      process.env.APP_SECRET_ACCESS_KEY ||
      "",
  },
  requestHandler: {
    requestTimeout: 600_000,      // 10 min per request
    connectionTimeout: 15_000,    // 15s to establish connection
  },
};

const bedrock = new BedrockRuntimeClient(awsConfig);

const MODEL_ID =
  process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-6-v1";

const MAX_RETRIES = 5;

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dimIdx = args.indexOf("--dimension");
const dimension = dimIdx >= 0 ? args[dimIdx + 1] : "all";

if (!["periodo", "categoria", "subcategoria", "all"].includes(dimension)) {
  console.error(
    'Error: --dimension debe ser "periodo", "categoria", "subcategoria" o "all"'
  );
  process.exit(1);
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuestionRow {
  id: string;
  pregunta: string;
  periodoCode: string;
  periodoNombre: string;
  periodoRango: string;
  categoriaCode: string;
  categoriaNombre: string;
  subcategoriaCode: string;
  subcategoriaNombre: string;
}

interface OrderResult {
  questionId: string;
  orden: number;
  tema: string;
}

// ─── Tool use schema ─────────────────────────────────────────────────────────

const ORDER_TOOL_NAME = "assign_question_order";

const ORDER_TOOL_SPEC = {
  name: ORDER_TOOL_NAME,
  description:
    "Asigna un orden logico y un tema descriptivo a cada pregunta dentro de un grupo.",
  inputSchema: {
    json: {
      type: "object" as const,
      required: ["ordenamiento"],
      properties: {
        ordenamiento: {
          type: "array" as const,
          items: {
            type: "object" as const,
            required: ["questionId", "orden", "tema"],
            properties: {
              questionId: { type: "string" as const },
              orden: { type: "integer" as const, minimum: 1 },
              tema: {
                type: "string" as const,
                minLength: 3,
                description:
                  "Etiqueta tematica corta (3-10 palabras) que describe el subtema de esta pregunta dentro del grupo",
              },
            },
          },
        },
      },
    },
  },
};

// ─── Prompts por dimension ───────────────────────────────────────────────────

function buildSystemPrompt(
  dimensionType: "periodo" | "categoria" | "subcategoria",
  groupName: string,
  groupExtra: string
): string {
  const instructions: Record<string, string> = {
    periodo: `Eres un historiador experto en Colombia. Se te presentan preguntas de investigacion que pertenecen al periodo historico "${groupName}" (${groupExtra}).

Tu tarea:
1. ORDENAR las preguntas de 1 a N siguiendo un orden CRONOLOGICO y LOGICO: primero las preguntas sobre eventos o procesos mas tempranos o fundacionales del periodo, luego las que abordan consecuencias o evoluciones posteriores. Si dos preguntas son del mismo momento, la mas general va primero.
2. Asignar un TEMA corto (3-10 palabras en espanol) que capture el subtema especifico de cada pregunta dentro de este periodo.

Los temas deben ser descriptivos y unicos — no repitas el mismo tema para preguntas diferentes a menos que realmente sean sobre exactamente lo mismo.`,

    categoria: `Eres un historiador experto en Colombia. Se te presentan preguntas de investigacion que pertenecen a la categoria "${groupName}".

Tu tarea:
1. ORDENAR las preguntas de 1 a N siguiendo una PROGRESION LOGICA: de lo mas general/fundacional a lo mas especifico/derivado. Las preguntas que establecen marcos conceptuales van primero, las que exploran detalles o consecuencias van despues.
2. Asignar un TEMA corto (3-10 palabras en espanol) que capture el subtema especifico de cada pregunta dentro de esta categoria.

Los temas deben ser descriptivos y unicos.`,

    subcategoria: `Eres un historiador experto en Colombia. Se te presentan preguntas de investigacion que pertenecen a la subcategoria "${groupName}" (${groupExtra}).

Tu tarea:
1. ORDENAR las preguntas de 1 a N siguiendo una PROGRESION CONCEPTUAL: primero las que plantean las cuestiones mas basicas o amplias del subtema, luego las que profundizan en aspectos mas especificos o de nicho.
2. Asignar un TEMA corto (3-10 palabras en espanol) que capture el micro-tema de cada pregunta.

Los temas deben ser descriptivos y unicos.`,
  };

  return instructions[dimensionType]!;
}

function buildUserMessage(questions: QuestionRow[]): string {
  const lines = questions.map(
    (q, i) => `[${i + 1}] ID: ${q.id}\nPregunta: ${q.pregunta}`
  );
  return `Analiza y ordena las siguientes ${questions.length} preguntas:\n\n${lines.join("\n\n")}`;
}

// ─── Bedrock call with retry ─────────────────────────────────────────────────

async function callClaude(
  systemPrompt: string,
  userMessage: string
): Promise<OrderResult[]> {
  const command = new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: "user",
        content: [{ text: userMessage }],
      },
    ],
    toolConfig: {
      tools: [{ toolSpec: ORDER_TOOL_SPEC }],
      toolChoice: { tool: { name: ORDER_TOOL_NAME } },
    },
    inferenceConfig: {
      maxTokens: 16000,
      temperature: 0.3,
    },
  });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await bedrock.send(command);

      const toolUseBlock = response.output?.message?.content?.find(
        (block) => block.toolUse?.name === ORDER_TOOL_NAME
      );

      if (!toolUseBlock?.toolUse?.input) {
        throw new Error("Claude no retorno el tool use con el ordenamiento");
      }

      const input = toolUseBlock.toolUse.input as Record<string, unknown>;
      const ordenamiento = input.ordenamiento as OrderResult[];

      if (!Array.isArray(ordenamiento) || ordenamiento.length === 0) {
        throw new Error("El tool use no contiene ordenamiento valido");
      }

      return ordenamiento;
    } catch (err) {
      const isRetryable =
        err instanceof Error &&
        (err.name === "ThrottlingException" ||
          err.name === "ModelStreamErrorException" ||
          err.name === "ModelTimeoutException" ||
          err.name === "ServiceUnavailableException" ||
          err.name === "InternalServerException" ||
          err.message.includes("throttl") ||
          err.message.includes("Too many requests") ||
          err.message.includes("timeout") ||
          err.message.includes("ECONNRESET") ||
          err.message.includes("socket hang up"));

      if (!isRetryable || attempt === MAX_RETRIES) throw err;

      const delay = Math.min(5000 * Math.pow(2, attempt), 60000);
      const jitter = Math.random() * 3000;
      log(
        `  Throttled (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${Math.round(delay + jitter)}ms...`
      );
      await new Promise((r) => setTimeout(r, delay + jitter));
    }
  }

  throw new Error("No response from Bedrock after retries");
}

// ─── Process a single group ──────────────────────────────────────────────────

async function processGroup(
  dimensionType: "periodo" | "categoria" | "subcategoria",
  groupCode: string,
  groupName: string,
  groupExtra: string,
  questions: QuestionRow[]
): Promise<number> {
  const n = questions.length;

  if (n === 0) return 0;

  // Single question — no need for Claude
  if (n === 1) {
    const q = questions[0];
    const updateField =
      dimensionType === "periodo"
        ? { ordenPeriodo: 1, temaPeriodo: groupName }
        : dimensionType === "categoria"
          ? { ordenCategoria: 1, temaCategoria: groupName }
          : { ordenSubcategoria: 1, temaSubcategoria: groupName };

    await prisma.question.update({
      where: { id: q.id },
      data: updateField,
    });

    log(`  ${groupCode} (${groupName}): 1 pregunta — asignada directamente`);
    return 1;
  }

  // Batch large groups to avoid Bedrock timeouts (50 questions per batch)
  const BATCH_SIZE = 50;
  const systemPrompt = buildSystemPrompt(dimensionType, groupName, groupExtra);
  const batches: QuestionRow[][] = [];
  for (let i = 0; i < n; i += BATCH_SIZE) {
    batches.push(questions.slice(i, i + BATCH_SIZE));
  }

  log(
    `  ${groupCode} (${groupName}): ${n} preguntas${batches.length > 1 ? ` (${batches.length} batches)` : ""} — llamando a Claude...`
  );

  const allResults: OrderResult[] = [];
  let orderOffset = 0;

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    if (batches.length > 1) {
      log(`    batch ${bi + 1}/${batches.length} (${batch.length} preguntas)...`);
    }
    const userMessage = buildUserMessage(batch);
    const batchResults = await callClaude(systemPrompt, userMessage);
    for (const r of batchResults) {
      allResults.push({ questionId: r.questionId, orden: r.orden + orderOffset, tema: r.tema });
    }
    orderOffset += batch.length;
  }

  const results = allResults;

  // Validate all questions are accounted for
  const questionIds = new Set(questions.map((q) => q.id));
  const resultIds = new Set(results.map((r) => r.questionId));
  const missing = [...questionIds].filter((id) => !resultIds.has(id));

  if (missing.length > 0) {
    log(
      `  ADVERTENCIA: ${missing.length} preguntas no fueron incluidas en el resultado de Claude. Asignando orden al final.`
    );
    let maxOrden = Math.max(...results.map((r) => r.orden), 0);
    for (const id of missing) {
      results.push({ questionId: id, orden: ++maxOrden, tema: groupName });
    }
  }

  // Save results
  const fieldMap = {
    periodo: (r: OrderResult) => ({
      ordenPeriodo: r.orden,
      temaPeriodo: r.tema,
    }),
    categoria: (r: OrderResult) => ({
      ordenCategoria: r.orden,
      temaCategoria: r.tema,
    }),
    subcategoria: (r: OrderResult) => ({
      ordenSubcategoria: r.orden,
      temaSubcategoria: r.tema,
    }),
  };

  const toData = fieldMap[dimensionType];

  for (const result of results) {
    if (!questionIds.has(result.questionId)) continue; // skip unknown IDs
    await prisma.question.update({
      where: { id: result.questionId },
      data: toData(result),
    });
  }

  log(`  ${groupCode}: ${results.length} preguntas ordenadas`);
  return results.length;
}

// ─── Group questions by dimension ────────────────────────────────────────────

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log("=== Ordenamiento Inteligente de Preguntas ===\n");
  log(`Modelo: ${MODEL_ID}`);
  log(`Dimension: ${dimension}`);
  log(`Dry run: ${dryRun}\n`);

  // Fetch all questions
  const questions = await prisma.question.findMany({
    select: {
      id: true,
      pregunta: true,
      periodoCode: true,
      periodoNombre: true,
      periodoRango: true,
      categoriaCode: true,
      categoriaNombre: true,
      subcategoriaCode: true,
      subcategoriaNombre: true,
    },
  });

  log(`Total de preguntas: ${questions.length}\n`);

  if (questions.length === 0) {
    log("No hay preguntas para ordenar.");
    return;
  }

  let totalProcessed = 0;
  let totalCalls = 0;

  // ─── Periodos ────────────────────────────────────────────────────────

  if (dimension === "all" || dimension === "periodo") {
    log("--- ORDENAMIENTO POR PERIODO ---\n");
    const groups = groupBy(questions, (q) => q.periodoCode);
    log(`Grupos: ${groups.size}`);

    if (dryRun) {
      for (const [code, qs] of groups) {
        log(`  ${code} (${qs[0].periodoNombre}): ${qs.length} preguntas`);
      }
    } else {
      let i = 0;
      for (const [code, qs] of groups) {
        i++;
        log(`[${i}/${groups.size}]`);
        try {
          const count = await processGroup(
            "periodo",
            code,
            qs[0].periodoNombre,
            qs[0].periodoRango,
            qs
          );
          totalProcessed += count;
          if (qs.length > 1) totalCalls++;
        } catch (err) {
          log(`  ERROR en ${code}: ${(err as Error).message}`);
        }
      }
    }
    log("");
  }

  // ─── Categorias ──────────────────────────────────────────────────────

  if (dimension === "all" || dimension === "categoria") {
    log("--- ORDENAMIENTO POR CATEGORIA ---\n");
    const groups = groupBy(questions, (q) => q.categoriaCode);
    log(`Grupos: ${groups.size}`);

    if (dryRun) {
      for (const [code, qs] of groups) {
        log(`  ${code} (${qs[0].categoriaNombre}): ${qs.length} preguntas`);
      }
    } else {
      let i = 0;
      for (const [code, qs] of groups) {
        i++;
        log(`[${i}/${groups.size}]`);
        try {
          const count = await processGroup(
            "categoria",
            code,
            qs[0].categoriaNombre,
            "",
            qs
          );
          totalProcessed += count;
          if (qs.length > 1) totalCalls++;
        } catch (err) {
          log(`  ERROR en ${code}: ${(err as Error).message}`);
        }
      }
    }
    log("");
  }

  // ─── Subcategorias ───────────────────────────────────────────────────

  if (dimension === "all" || dimension === "subcategoria") {
    log("--- ORDENAMIENTO POR SUBCATEGORIA ---\n");
    const groups = groupBy(questions, (q) => q.subcategoriaCode);
    log(`Grupos: ${groups.size}`);

    if (dryRun) {
      for (const [code, qs] of groups) {
        log(`  ${code} (${qs[0].subcategoriaNombre}): ${qs.length} preguntas`);
      }
    } else {
      let i = 0;
      for (const [code, qs] of groups) {
        i++;
        log(`[${i}/${groups.size}]`);
        try {
          const count = await processGroup(
            "subcategoria",
            code,
            qs[0].subcategoriaNombre,
            qs[0].categoriaCode,
            qs
          );
          totalProcessed += count;
          if (qs.length > 1) totalCalls++;
        } catch (err) {
          log(`  ERROR en ${code}: ${(err as Error).message}`);
        }
      }
    }
    log("");
  }

  // ─── Summary ─────────────────────────────────────────────────────────

  if (!dryRun) {
    log("=== RESUMEN ===");
    log(`Preguntas procesadas: ${totalProcessed}`);
    log(`Llamadas a Claude: ${totalCalls}`);
  }

  log("\nHecho.");
}

main()
  .catch((e) => {
    log("Error fatal: " + String(e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
