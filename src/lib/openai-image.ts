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
const EDITS_ENDPOINT = "https://api.openai.com/v1/images/edits";

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Error de moderación de salida de OpenAI: estocástico, casi siempre pasa al reintentar. */
export function isModerationBlocked(err: unknown): boolean {
  return err instanceof Error && /moderation_blocked|safety system/i.test(err.message);
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

// ── images/edits: generación CON imágenes de referencia ─────────────

export interface ReferenceImageInput {
  buffer: Buffer;
  /** Nombre de archivo para el multipart (p. ej. "ref-1.jpg"). */
  name: string;
  /** MIME; por defecto image/jpeg. */
  mime?: string;
}

export interface EditImageOpts extends GenerateImageOpts {
  /** Referencias reales que anclan la generación (gpt-image acepta varias). */
  refs: ReferenceImageInput[];
}

/**
 * Genera una imagen ANCLADA en referencias reales vía POST /v1/images/edits
 * (multipart con `image[]`). Es el modo por defecto del Taller: el salto de
 * credibilidad histórica frente a `generations` se validó en el laboratorio.
 * Devuelve el PNG como Buffer. Lanza en error (el caller decide reintentos).
 */
export async function editImagePng(opts: EditImageOpts): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY no configurado");
  if (opts.refs.length === 0) throw new Error("editImagePng requiere al menos una referencia");
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const quality = opts.quality ?? (process.env.OPENAI_IMAGE_QUALITY as GenerateImageOpts["quality"]) ?? "medium";

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", opts.prompt.slice(0, 32000));
  form.append("size", opts.size);
  form.append("quality", quality);
  form.append("n", "1");
  for (const ref of opts.refs) {
    form.append(
      "image[]",
      new Blob([new Uint8Array(ref.buffer)], { type: ref.mime ?? "image/jpeg" }),
      ref.name
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 240_000);
  try {
    const res = await fetch(EDITS_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI images/edits ${res.status}: ${text.slice(0, 500)}`);
    }

    const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (b64) return Buffer.from(b64, "base64");
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
