/**
 * Diagnóstico: lanza UNA llamada a Bedrock para ver el error exacto cuando
 * está throttled. Aisla el problema sin la complejidad del loop.
 */
import { prisma } from "../src/lib/prisma";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "../src/lib/aws-config";

const bedrock = new BedrockRuntimeClient(awsConfig);

async function main() {
  console.log("[test-bedrock] llamada simple a Opus 4.7...");

  const cmd = new ConverseCommand({
    modelId: "us.anthropic.claude-opus-4-7",
    messages: [{ role: "user", content: [{ text: "Di hola en 5 palabras." }] }],
    inferenceConfig: { maxTokens: 50 },
  });

  const start = Date.now();
  try {
    const res = await bedrock.send(cmd);
    const t = ((Date.now() - start) / 1000).toFixed(1);
    const text = res.output?.message?.content?.[0]?.text;
    console.log(`[test-bedrock] ✅ ${t}s: ${text}`);
  } catch (e) {
    const t = ((Date.now() - start) / 1000).toFixed(1);
    const err = e as Error & { name?: string; $metadata?: { httpStatusCode?: number } };
    console.log(
      `[test-bedrock] ❌ ${t}s: name=${err.name} http=${err.$metadata?.httpStatusCode} msg=${err.message}`
    );
  }

  await prisma.$disconnect();
}

main();
