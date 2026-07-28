import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { ImageSize } from "./openai-image";

const DEFAULT_MODEL = "stability.stable-image-ultra-v1:1";
const DEFAULT_REGION = "us-west-2";

export function bedrockImageModel(): string {
  return process.env.BEDROCK_IMAGE_MODEL_ID || DEFAULT_MODEL;
}

export function isBedrockImageFallbackEnabled(): boolean {
  return process.env.BEDROCK_IMAGE_FALLBACK !== "false";
}

export function aspectRatioForImageSize(
  size: ImageSize,
): "3:2" | "2:3" | "1:1" {
  if (size === "1536x1024") return "3:2";
  if (size === "1024x1536") return "2:3";
  return "1:1";
}

interface GenerateBedrockImageOpts {
  prompt: string;
  size: ImageSize;
  reference?: Buffer;
  seed?: number;
}

interface StableImageResponse {
  images?: string[];
  finish_reasons?: Array<string | null>;
}

/**
 * Respaldo de imagen para el límite duro de OpenAI.
 *
 * Intenta conservar el ancla documental con image-to-image cuando el modelo lo
 * admite. Stable Image Ultra no lo admite en todas sus versiones/regiones; en
 * ese caso vuelve explícitamente a text-to-image.
 */
export async function generateBedrockImagePng(
  opts: GenerateBedrockImageOpts,
): Promise<Buffer> {
  if (!isBedrockImageFallbackEnabled()) {
    throw new Error("Respaldo Bedrock de imágenes desactivado");
  }

  const modelId = bedrockImageModel();
  const client = new BedrockRuntimeClient({
    region: process.env.BEDROCK_IMAGE_REGION || DEFAULT_REGION,
  });
  const payload: Record<string, unknown> = {
    prompt: opts.prompt.slice(0, 10_000),
    negative_prompt:
      "text, letters, captions, subtitles, watermarks, logos, signatures, " +
      "modern anachronisms, distorted faces, extra fingers, duplicated people",
    output_format: "png",
    seed: opts.seed ?? 0,
  };

  if (opts.reference) {
    payload.mode = "image-to-image";
    payload.image = opts.reference.toString("base64");
    payload.strength = 0.35;
  } else {
    payload.mode = "text-to-image";
    payload.aspect_ratio = aspectRatioForImageSize(opts.size);
  }

  const invoke = () =>
    client.send(
      new InvokeModelCommand({
        modelId,
        accept: "application/json",
        contentType: "application/json",
        body: Buffer.from(JSON.stringify(payload)),
      }),
    );

  let response;
  try {
    response = await invoke();
  } catch (error) {
    if (
      opts.reference &&
      error instanceof Error &&
      /does not support image-to-image mode/i.test(error.message)
    ) {
      delete payload.image;
      delete payload.strength;
      payload.mode = "text-to-image";
      payload.aspect_ratio = aspectRatioForImageSize(opts.size);
      response = await invoke();
    } else {
      throw error;
    }
  }
  const decoded = JSON.parse(
    new TextDecoder().decode(response.body),
  ) as StableImageResponse;
  const finishReason = decoded.finish_reasons?.find((value) => value !== null);
  if (finishReason) {
    throw new Error(`Bedrock image filtró la salida: ${finishReason}`);
  }
  const image = decoded.images?.[0];
  if (!image) throw new Error("Bedrock image respondió sin imagen");
  return Buffer.from(image, "base64");
}
