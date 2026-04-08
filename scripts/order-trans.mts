/**
 * order-trans.mts — Ordena TRANS (912 preguntas) dividido en 2 mitades.
 *
 * Mitad 1 (0-455): ordenes 1-456
 * Mitad 2 (456-911): ordenes 457-912
 *
 * Ademas asigna una metrica de ubicacion (1-100) como percentil
 * que permite desempatar el orden global entre mitades.
 * Ubicacion = (orden_dentro_del_grupo / total_grupo) * 100
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

const ORDER_TOOL = {
  name: "assign_order",
  description: "Asigna orden numerico y ubicacion percentil a cada pregunta",
  inputSchema: {
    json: {
      type: "object" as const,
      required: ["ordenamiento"],
      properties: {
        ordenamiento: {
          type: "array" as const,
          items: {
            type: "object" as const,
            required: ["id", "orden", "ubicacion"],
            properties: {
              id: { type: "string" as const },
              orden: { type: "integer" as const, minimum: 1 },
              ubicacion: { type: "integer" as const, minimum: 1, maximum: 100, description: "Percentil de ubicacion temporal: 1=inicio del periodo, 50=mitad, 100=final. Sirve para desempatar el orden global." },
            },
          },
        },
      },
    },
  },
};

async function callClaude(systemPrompt: string, userMsg: string, maxTokens: number) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await bedrock.send(new ConverseCommand({
        modelId: MODEL,
        system: [{ text: systemPrompt }],
        messages: [{ role: "user", content: [{ text: userMsg }] }],
        toolConfig: {
          tools: [{ toolSpec: ORDER_TOOL }],
          toolChoice: { tool: { name: ORDER_TOOL.name } },
        },
        inferenceConfig: { maxTokens, temperature: 0.3 },
      }));
      const block = res.output?.message?.content?.find((b) => b.toolUse?.name === ORDER_TOOL.name);
      if (!block?.toolUse?.input) throw new Error("No tool use block");
      return (block.toolUse.input as Record<string, unknown>).ordenamiento as { id: string; orden: number; ubicacion: number }[];
    } catch (err) {
      const e = err as Error;
      const retryable = e.name === "ThrottlingException" || e.message.includes("throttl") || e.message.includes("timeout") || e.message.includes("Too many") || e.message.includes("ECONNRESET");
      if (!retryable || attempt === MAX_RETRIES) throw err;
      const delay = Math.min(5000 * Math.pow(2, attempt), 60000) + Math.random() * 3000;
      log(`  Retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay)}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Exhausted retries");
}

// Fetch all TRANS questions
const questions = await prisma.question.findMany({
  where: { periodoCode: "TRANS" },
  select: { id: true, pregunta: true },
});
log(`TRANS: ${questions.length} preguntas total`);

const mid = Math.ceil(questions.length / 2);
const half1 = questions.slice(0, mid);
const half2 = questions.slice(mid);

const systemPrompt = `Eres un historiador experto en Colombia. Se te dan preguntas del periodo "Transversal / Larga Duracion" (que abarca 3+ periodos historicos).

Asigna:
1. ORDEN: de 1 a N cronologico/logico — preguntas sobre procesos mas tempranos primero, fundacionales antes de derivadas.
2. UBICACION: percentil de 1 a 100 que indica donde cae la pregunta en el arco temporal. 1=preguntas sobre los inicios/origenes, 50=mitad del arco, 100=epoca mas reciente/contemporanea. Esta metrica sirve para desempatar entre grupos.

Responde SOLO con la herramienta.`;

// Process half 1
log(`\nMitad 1: ${half1.length} preguntas`);
const lines1 = half1.map((q) => `${q.id} | ${q.pregunta.length > 80 ? q.pregunta.substring(0, 80) + "..." : q.pregunta}`);
const msg1 = `Ordena de 1 a ${half1.length}:\n\n${lines1.join("\n")}`;
const maxTokens1 = Math.max(half1.length * 40, 4000);
log(`Llamando a Claude (maxTokens: ${maxTokens1})...`);
const results1 = await callClaude(systemPrompt, msg1, maxTokens1);
log(`Got ${results1.length} orderings`);

// Save with retry
async function saveWithRetry(id: string, data: Record<string, unknown>, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      await prisma.question.update({ where: { id }, data });
      return true;
    } catch {
      if (i === retries) return false;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  return false;
}

const idSet = new Set(questions.map((q) => q.id));
let saved = 0;
for (const r of results1) {
  if (!idSet.has(r.id)) continue;
  if (await saveWithRetry(r.id, { ordenPeriodo: r.orden, temaPeriodo: `ubicacion:${r.ubicacion}` })) saved++;
}
log(`Mitad 1: ${saved} saved`);

// Process half 2
log(`\nMitad 2: ${half2.length} preguntas`);
const lines2 = half2.map((q) => `${q.id} | ${q.pregunta.length > 80 ? q.pregunta.substring(0, 80) + "..." : q.pregunta}`);
const msg2 = `Ordena de 1 a ${half2.length}:\n\n${lines2.join("\n")}`;
const maxTokens2 = Math.max(half2.length * 40, 4000);
log(`Llamando a Claude (maxTokens: ${maxTokens2})...`);
const results2 = await callClaude(systemPrompt, msg2, maxTokens2);
log(`Got ${results2.length} orderings`);

// Save half 2 (ordenes offset by half1.length)
let saved2 = 0;
for (const r of results2) {
  if (!idSet.has(r.id)) continue;
  if (await saveWithRetry(r.id, { ordenPeriodo: r.orden + half1.length, temaPeriodo: `ubicacion:${r.ubicacion}` })) saved2++;
}
log(`Mitad 2: ${saved2} saved`);

log(`\nDone: ${saved + saved2} total`);
await prisma.$disconnect();
