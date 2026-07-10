/**
 * Generador de producción: tema + TIPO → partitura lista para renderizar/previsualizar.
 * Une el Director (RAG → compose-en-estilo → verify → montaje) con la búsqueda de
 * archivo (según el uso de imagen del tipo). Es lo que la API llamará.
 */
import { runDirector } from "./director";
import { getStyle, imageCapFor } from "./styles";
import { resolveScoreImagesToUrls } from "./scene-images";
import type { TypographicScore } from "./score";

export interface GenerateInput {
  topic: string;
  styleId: string;
  durationSec?: number;
  /** dónde bajar imágenes (local). Sin esto, no se resuelven imágenes (queda puro tipo). */
  destDir?: string;
  onStage?: (stage: string, detail?: string) => void;
}
export interface GenerateResult {
  score: TypographicScore;
  styleId: string;
  styleLabel: string;
  imagesUsed: number;
}

export async function generateVideoScore(input: GenerateInput): Promise<GenerateResult> {
  const style = getStyle(input.styleId);
  const { score } = await runDirector({
    topic: input.topic,
    styleBrief: style.brief,
    durationSec: input.durationSec ?? 30,
    onStage: input.onStage,
  });
  score.meta.personality = style.id as never; // registra el tipo elegido en la partitura

  let imagesUsed = 0;
  const cap = imageCapFor(style.imageUsage);
  if (cap > 0) {
    input.onStage?.("archivo", `buscando imágenes (${style.label}, hasta ${cap})`);
    // URLs de archivo (no descarga) → funcionan en App Runner (Player) y en el render.
    imagesUsed = await resolveScoreImagesToUrls(score, cap, (m) => input.onStage?.("archivo", m));
  } else {
    // sin imágenes: limpia cualquier consulta que el compositor haya dejado
    for (const s of score.scenes as unknown as Array<Record<string, unknown>>) {
      delete s.image;
      delete s.imageFill;
    }
  }
  return { score, styleId: style.id, styleLabel: style.label, imagesUsed };
}
