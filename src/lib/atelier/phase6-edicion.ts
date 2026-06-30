/**
 * Fase 6 — Edición y control de calidad. Pule estilo/ritmo y des-roboriza con
 * Opus; un crítico Sonnet puntúa 0-10; si no alcanza el umbral y hay presupuesto,
 * una revisión dirigida. Nunca bloquea: devuelve la mejor versión disponible.
 */
import { callClaudeJson, SONNET_MODEL } from "./bedrock-json";
import { askClaudeAtelier } from "./phase5-composicion";
import { getFormatConfig } from "./format-config";
import type { AtelierFormat } from "./formats";
import type { AtelierBrief } from "./types";

const EDIT_SYSTEM_BASE = `Eres un editor literario riguroso, de los que leen con el lápiz afilado y devuelven el texto más limpio y más vivo de lo que llegó, sin tocar un solo hecho. Recibes una pieza terminada y la mejoras SIN cambiar su contenido factual.

Reglas:
- NO añadas ni elimines hechos (fechas, cifras, nombres, lugares, atribuciones). Solo mejoras la forma.
- Elimina muletillas y tics de escritura automática: "es importante destacar", "cabe resaltar", "en conclusión", "en resumen", enumeraciones mecánicas, adjetivación vacía.
- Elimina CUALQUIER cita inline (\`[#N]\`, números de fuente, "(p. X)") y CUALQUIER andamiaje historiográfico ("las fuentes indican", "según el corpus", "los documentos disponibles", "no se puede saber") que se haya colado.
- Conserva el título \`#\`, la voz y la extensión objetivo.
- Markdown limpio.

Devuelve ÚNICAMENTE el texto final en markdown, sin comentarios ni explicaciones.`;

const PULIDO_INSTR =
  "Pule esta pieza: afina ritmo y transiciones, recorta lo flojo, asegúrate de que la voz sea consistente y de que NO queden citas inline ni andamiaje.";

async function editPass(
  texto: string,
  brief: AtelierBrief,
  format: AtelierFormat,
  instrucciones: string
): Promise<string> {
  const system = `${EDIT_SYSTEM_BASE}\n\nVOZ DE LA PIEZA: ${brief.ficha.voz}\nEXTENSIÓN OBJETIVO: ~${brief.ficha.extensionTarget} palabras.`;
  const user = `${instrucciones}\n\nTEXTO A EDITAR:\n\n${texto}`;
  const out = await askClaudeAtelier({ system, user, maxTokens: format.maxTokens });
  return out.trim() ? out : texto;
}

const CRITIC_SYSTEM = `Eres un editor jefe evaluando una pieza terminada. Puntúa de 0 a 10 con criterio exigente.

Dimensiones:
- fidelidadFormato: ¿cumple la forma del formato indicado (estructura, extensión aproximada, registro)?
- calidadProsa: ¿es buena prosa — ritmo, voz, ausencia de muletillas y tics de escritura automática?
- limpieza: ¿está libre de citas inline (\`[#N]\`, números de fuente), de bibliografía y de andamiaje historiográfico ("las fuentes", "según el corpus", "no se puede saber")? 10 = totalmente limpia.

Devuelve JSON puro (sin markdown):
{ "fidelidadFormato": 0, "calidadProsa": 0, "limpieza": 0, "scoreGlobal": 0, "problemas": ["lista accionable, vacía si todo bien"], "veredicto": "ok" }

NO escribas nada fuera del JSON.`;

interface CritRaw {
  fidelidadFormato?: number;
  calidadProsa?: number;
  limpieza?: number;
  scoreGlobal?: number;
  problemas?: unknown;
  veredicto?: string;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(10, v)) : fallback;
}

async function criticar(
  texto: string,
  format: AtelierFormat,
  extensionTarget: number,
  threshold: number
): Promise<{ scoreGlobal: number; problemas: string[] }> {
  try {
    const raw = await callClaudeJson<CritRaw>({
      model: SONNET_MODEL,
      system: CRITIC_SYSTEM,
      user: `FORMATO: ${format.name}\nEXTENSIÓN OBJETIVO: ~${extensionTarget} palabras\n\nPIEZA:\n\n${texto}\n\nJSON:`,
      maxTokens: 1500,
      validate: (p) => p as CritRaw,
    });
    const sub = [
      num(raw.fidelidadFormato, 7),
      num(raw.calidadProsa, 7),
      num(raw.limpieza, 7),
    ];
    const avg = sub.reduce((a, b) => a + b, 0) / sub.length;
    const scoreGlobal = num(raw.scoreGlobal, avg);
    const problemas = Array.isArray(raw.problemas)
      ? raw.problemas.filter((x): x is string => typeof x === "string")
      : [];
    return { scoreGlobal, problemas };
  } catch {
    // Si el crítico falla, no bloquear: aceptar la pieza con score neutro.
    return { scoreGlobal: threshold, problemas: [] };
  }
}

export async function pulirYControlar(args: {
  texto: string;
  brief: AtelierBrief;
  format: AtelierFormat;
  allowRevision: boolean;
}): Promise<{ texto: string; qualityScore: number }> {
  // Exigencia por formato: el capítulo se mide más duro; todos pasan hasta dos
  // revisiones dirigidas si no alcanzan el umbral (ver format-config.ts).
  const { qualityThreshold, maxRevisions } = getFormatConfig(args.format.id);

  let texto = await editPass(args.texto, args.brief, args.format, PULIDO_INSTR);
  let crit = await criticar(texto, args.format, args.brief.ficha.extensionTarget, qualityThreshold);

  let revisions = 0;
  while (
    crit.scoreGlobal < qualityThreshold &&
    args.allowRevision &&
    revisions < maxRevisions &&
    crit.problemas.length > 0
  ) {
    const fixes = `Corrige específicamente estos problemas, sin alterar el resto ni cambiar los hechos:\n- ${crit.problemas.join("\n- ")}`;
    texto = await editPass(texto, args.brief, args.format, fixes);
    crit = await criticar(texto, args.format, args.brief.ficha.extensionTarget, qualityThreshold);
    revisions++;
  }

  return { texto, qualityScore: crit.scoreGlobal };
}
