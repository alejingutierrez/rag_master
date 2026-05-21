import "../eval/load-env";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

async function tryModel(id: string) {
  const runtime = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  try {
    const cmd = new ConverseCommand({
      modelId: id,
      messages: [{ role: "user", content: [{ text: "Hola, ¿quién eres? Responde en 1 línea." }] }],
      inferenceConfig: { maxTokens: 100 },
    });
    const r = await runtime.send(cmd);
    const txt = r.output?.message?.content?.[0]?.text || "";
    console.log(`✅ ${id}: "${txt.substring(0, 100)}"`);
    return true;
  } catch (e) {
    console.log(`❌ ${id}: ${(e as Error).message.substring(0, 150)}`);
    return false;
  }
}

async function main() {
  for (const id of [
    "us.anthropic.claude-opus-4-7-v1:0",
    "us.anthropic.claude-opus-4-7",
    "anthropic.claude-opus-4-7-v1:0",
    "us.anthropic.claude-opus-4-7-20251201-v1:0",
    "us.anthropic.claude-opus-4-7-20250930-v1:0",
    // Variante 1M context
    "us.anthropic.claude-opus-4-7-1m-v1:0",
    "us.anthropic.claude-opus-4-7:1m",
    // Conocidos que funcionan (control)
    "us.anthropic.claude-opus-4-6-v1",
  ]) {
    await tryModel(id);
  }
}
main().catch(console.error);
