/**
 * order-split.mts — Ordena un grupo grande dividido en 2 mitades con ubicacion.
 * Uso: npx tsx scripts/order-split.mts <dimension> <code>
 */
import { PrismaClient } from "@prisma/client";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import "dotenv/config";

const prisma = new PrismaClient();
const bedrock = new BedrockRuntimeClient({
  region: "us-east-1",
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID!, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY! },
});
const MODEL = process.env.BEDROCK_CLAUDE_MODEL_ID || "us.anthropic.claude-opus-4-6-v1";
const MAX_RETRIES = 5;
const log = (msg: string) => process.stderr.write(msg + "\n");

const dim = process.argv[2] as "periodo" | "categoria" | "subcategoria";
const code = process.argv[3];
if (!dim || !code) { log("Usage: npx tsx scripts/order-split.mts <dim> <code>"); process.exit(1); }

const whereKey = dim === "periodo" ? "periodoCode" : dim === "categoria" ? "categoriaCode" : "subcategoriaCode";
const orderField = dim === "periodo" ? "ordenPeriodo" : dim === "categoria" ? "ordenCategoria" : "ordenSubcategoria";
const themeField = dim === "periodo" ? "temaPeriodo" : dim === "categoria" ? "temaCategoria" : "temaSubcategoria";

const ORDER_TOOL = {
  name: "assign_order",
  description: "Asigna orden y ubicacion",
  inputSchema: { json: { type: "object" as const, required: ["ordenamiento"], properties: {
    ordenamiento: { type: "array" as const, items: { type: "object" as const, required: ["id", "orden", "ubicacion"], properties: {
      id: { type: "string" as const }, orden: { type: "integer" as const, minimum: 1 },
      ubicacion: { type: "integer" as const, minimum: 1, maximum: 100 },
    }}}
  }}}
};

async function saveRetry(id: string, data: Record<string, unknown>, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try { await prisma.question.update({ where: { id }, data }); return true; }
    catch { if (i === retries) return false; await new Promise(r => setTimeout(r, 2000 * (i + 1))); }
  }
  return false;
}

async function callClaude(sys: string, msg: string, maxTok: number) {
  for (let a = 0; a <= MAX_RETRIES; a++) {
    try {
      const res = await bedrock.send(new ConverseCommand({
        modelId: MODEL, system: [{ text: sys }], messages: [{ role: "user", content: [{ text: msg }] }],
        toolConfig: { tools: [{ toolSpec: ORDER_TOOL }], toolChoice: { tool: { name: "assign_order" } } },
        inferenceConfig: { maxTokens: maxTok, temperature: 0.3 },
      }));
      const block = res.output?.message?.content?.find(b => b.toolUse?.name === "assign_order");
      if (!block?.toolUse?.input) throw new Error("No tool use");
      return (block.toolUse.input as Record<string, unknown>).ordenamiento as { id: string; orden: number; ubicacion: number }[];
    } catch (err) {
      const e = err as Error;
      const retry = e.message.includes("throttl") || e.message.includes("timeout") || e.message.includes("Too many") || e.message.includes("ECONNRESET");
      if (!retry || a === MAX_RETRIES) throw err;
      await new Promise(r => setTimeout(r, 5000 * Math.pow(2, a) + Math.random() * 3000));
    }
  }
  throw new Error("Exhausted");
}

const questions = await prisma.question.findMany({ where: { [whereKey]: code }, select: { id: true, pregunta: true, categoriaNombre: true, subcategoriaNombre: true, periodoNombre: true } });
const name = dim === "categoria" ? questions[0]?.categoriaNombre : dim === "subcategoria" ? questions[0]?.subcategoriaNombre : questions[0]?.periodoNombre;
log(`${code} (${name}): ${questions.length} preguntas — dividiendo en 2`);

const sysPrompt = dim === "periodo"
  ? `Historiador experto. Ordena cronologicamente de 1 a N. Asigna ubicacion 1-100 (percentil temporal).`
  : dim === "categoria"
    ? `Historiador experto. Ordena de general a especifico de 1 a N. Asigna ubicacion 1-100 (1=mas general, 100=mas especifico).`
    : `Historiador experto. Ordena por progresion conceptual de 1 a N. Asigna ubicacion 1-100.`;

const mid = Math.ceil(questions.length / 2);
const halves = [questions.slice(0, mid), questions.slice(mid)];
const idSet = new Set(questions.map(q => q.id));
let totalSaved = 0;

for (let h = 0; h < 2; h++) {
  const half = halves[h];
  const lines = half.map(q => `${q.id} | ${q.pregunta.length > 80 ? q.pregunta.substring(0, 80) + "..." : q.pregunta}`);
  const msg = `Ordena de 1 a ${half.length}:\n\n${lines.join("\n")}`;
  log(`Mitad ${h + 1}: ${half.length} preguntas...`);
  const results = await callClaude(sysPrompt, msg, Math.max(half.length * 40, 4000));
  log(`  Got ${results.length}`);
  const offset = h === 0 ? 0 : halves[0].length;
  for (const r of results) {
    if (!idSet.has(r.id)) continue;
    if (await saveRetry(r.id, { [orderField]: r.orden + offset, [themeField]: `ubicacion:${r.ubicacion}` })) totalSaved++;
  }
}
log(`Done: ${totalSaved}`);
await prisma.$disconnect();
