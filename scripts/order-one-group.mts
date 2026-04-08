/**
 * order-one-group.mts — Ordena un grupo de preguntas con un SOLO call a Claude.
 *
 * Envia TODAS las preguntas (texto truncado) y pide solo ID + orden.
 * Claude ve el panorama completo y asigna un orden global 1..N.
 *
 * Uso: npx tsx scripts/order-one-group.mts <dimension> <groupCode>
 * Ejemplo: npx tsx scripts/order-one-group.mts periodo TRANS
 */
import { PrismaClient } from "@prisma/client";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import "dotenv/config";

const prisma = new PrismaClient();
const bedrock = new BedrockRuntimeClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const MODEL = process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-6-v1";
const MAX_RETRIES = 5;
const log = (msg: string) => process.stderr.write(msg + "\n");

const dim = process.argv[2] as "periodo" | "categoria" | "subcategoria";
const code = process.argv[3];

if (!dim || !code) {
  log("Usage: npx tsx scripts/order-one-group.mts <periodo|categoria|subcategoria> <code>");
  process.exit(1);
}

// ─── Tool spec: solo ID + orden ──────────────────────────────────────────────

const ORDER_TOOL = {
  name: "assign_order",
  description: "Asigna orden numerico a cada pregunta",
  inputSchema: {
    json: {
      type: "object" as const,
      required: ["ordenamiento"],
      properties: {
        ordenamiento: {
          type: "array" as const,
          items: {
            type: "object" as const,
            required: ["id", "orden"],
            properties: {
              id: { type: "string" as const },
              orden: { type: "integer" as const, minimum: 1 },
            },
          },
        },
      },
    },
  },
};

// ─── DB field mapping ────────────────────────────────────────────────────────

const whereKey = dim === "periodo" ? "periodoCode" : dim === "categoria" ? "categoriaCode" : "subcategoriaCode";
const orderField = dim === "periodo" ? "ordenPeriodo" : dim === "categoria" ? "ordenCategoria" : "ordenSubcategoria";

// ─── Fetch questions ─────────────────────────────────────────────────────────

const questions = await prisma.question.findMany({
  where: { [whereKey]: code },
  select: { id: true, pregunta: true, periodoNombre: true, periodoRango: true, categoriaNombre: true, subcategoriaNombre: true },
});

const groupName = dim === "periodo" ? questions[0]?.periodoNombre
  : dim === "categoria" ? questions[0]?.categoriaNombre
  : questions[0]?.subcategoriaNombre;
const groupExtra = dim === "periodo" ? (questions[0]?.periodoRango || "") : "";

log(`${code} (${groupName}): ${questions.length} preguntas`);

if (questions.length === 0) {
  await prisma.$disconnect();
  process.exit(0);
}

if (questions.length === 1) {
  await prisma.question.update({ where: { id: questions[0].id }, data: { [orderField]: 1 } });
  log("1 pregunta — orden 1");
  await prisma.$disconnect();
  process.exit(0);
}

// ─── Build prompt with truncated questions ───────────────────────────────────

const instructions: Record<string, string> = {
  periodo: `Eres un historiador experto en Colombia. Se te dan ${questions.length} preguntas del periodo "${groupName}" (${groupExtra}). Asigna un ORDEN UNICO de 1 a ${questions.length}. Criterio: orden cronologico/logico — eventos tempranos primero, preguntas fundacionales antes de derivadas. Responde SOLO con la herramienta, sin texto adicional.`,
  categoria: `Eres un historiador experto. ${questions.length} preguntas de categoria "${groupName}". Asigna orden 1 a ${questions.length}: de lo general/fundacional a lo especifico. Responde SOLO con la herramienta.`,
  subcategoria: `Eres un historiador experto. ${questions.length} preguntas de subcategoria "${groupName}". Asigna orden 1 a ${questions.length} por progresion conceptual. Responde SOLO con la herramienta.`,
};

// Truncate to ~80 chars per question to minimize input tokens
const lines = questions.map((q, i) =>
  `${q.id} | ${q.pregunta.length > 80 ? q.pregunta.substring(0, 80) + "..." : q.pregunta}`
);
const userMsg = `Ordena de 1 a ${questions.length}:\n\n${lines.join("\n")}`;

// maxTokens: each result is ~25 tokens ({"id":"xxx","orden":N}), so N*25 + overhead
const maxTokens = Math.min(Math.max(questions.length * 30, 4000), 120000);

log(`Llamando a Claude (maxTokens: ${maxTokens})...`);

// ─── Call Claude with retry ──────────────────────────────────────────────────

for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  try {
    const res = await bedrock.send(new ConverseCommand({
      modelId: MODEL,
      system: [{ text: instructions[dim] }],
      messages: [{ role: "user", content: [{ text: userMsg }] }],
      toolConfig: {
        tools: [{ toolSpec: ORDER_TOOL }],
        toolChoice: { tool: { name: ORDER_TOOL.name } },
      },
      inferenceConfig: { maxTokens, temperature: 0.3 },
    }));

    const block = res.output?.message?.content?.find((b) => b.toolUse?.name === ORDER_TOOL.name);
    if (!block?.toolUse?.input) throw new Error("No tool use block");

    const data = block.toolUse.input as Record<string, unknown>;
    const orderings = data.ordenamiento as { id: string; orden: number }[];
    log(`Got ${orderings.length} orderings`);

    // Save to DB
    const idSet = new Set(questions.map((q) => q.id));
    let saved = 0;
    for (const o of orderings) {
      if (!idSet.has(o.id)) continue;
      await prisma.question.update({ where: { id: o.id }, data: { [orderField]: o.orden } });
      saved++;
    }

    // Fill missing
    const orderedIds = new Set(orderings.map((o) => o.id));
    let maxOrd = Math.max(...orderings.map((o) => o.orden), 0);
    for (const q of questions) {
      if (!orderedIds.has(q.id)) {
        await prisma.question.update({ where: { id: q.id }, data: { [orderField]: ++maxOrd } });
        saved++;
      }
    }

    log(`Done: ${saved} saved`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    const e = err as Error;
    const retryable = e.name === "ThrottlingException" || e.message.includes("throttl") ||
      e.message.includes("timeout") || e.message.includes("Too many") ||
      e.message.includes("ECONNRESET") || e.message.includes("socket hang up");
    if (!retryable || attempt === MAX_RETRIES) {
      log(`ERROR: ${e.name} - ${e.message}`);
      await prisma.$disconnect();
      process.exit(1);
    }
    const delay = Math.min(5000 * Math.pow(2, attempt), 60000) + Math.random() * 3000;
    log(`Retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay)}ms...`);
    await new Promise((r) => setTimeout(r, delay));
  }
}
