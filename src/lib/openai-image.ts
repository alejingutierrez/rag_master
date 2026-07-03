/**
 * Cliente mínimo de la Images API de OpenAI (gpt-image). Sin SDK: un POST con
 * fetch, timeout propio (la generación puede tardar 30–120s) y decodificación
 * base64 → Buffer PNG. Aislado del resto para que un fallo aquí nunca tumbe una
 * pieza del Taller.
 *
 * Modelo por env `OPENAI_IMAGE_MODEL` (default gpt-image-2). Tamaños:
 * 1024x1024, 1536x1024 (apaisado), 1024x1536 (retrato).
 */

export type ImageSize = "1536x1024" | "1024x1536" | "1024x1024";

const ENDPOINT = "https://api.openai.com/v1/images/generations";

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export interface GenerateImageOpts {
  prompt: string;
  size: ImageSize;
  /** low | medium | high | auto (gpt-image). Default: medium. */
  quality?: "low" | "medium" | "high" | "auto";
  timeoutMs?: number;
}

/** Genera una imagen y devuelve el PNG como Buffer. Lanza en error. */
export async function generateImagePng(opts: GenerateImageOpts): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY no configurado");
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const quality = opts.quality ?? (process.env.OPENAI_IMAGE_QUALITY as GenerateImageOpts["quality"]) ?? "medium";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 180_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: opts.prompt.slice(0, 32000),
        size: opts.size,
        quality,
        n: 1,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI images ${res.status}: ${text.slice(0, 500)}`);
    }

    const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (b64) return Buffer.from(b64, "base64");

    // Algunos modelos/planes devuelven una URL en vez de base64: descárgala.
    const url = json.data?.[0]?.url;
    if (url) {
      const img = await fetch(url);
      if (!img.ok) throw new Error(`No se pudo descargar la imagen: ${img.status}`);
      return Buffer.from(await img.arrayBuffer());
    }

    throw new Error("Respuesta de OpenAI sin imagen (ni b64_json ni url)");
  } finally {
    clearTimeout(timeout);
  }
}
