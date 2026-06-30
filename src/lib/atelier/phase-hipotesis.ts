/**
 * Fase de Hipótesis — entre verificación y composición. Fija la espina
 * argumental de la pieza ANTES de redactar: tesis / antítesis / síntesis,
 * fundadas en el material ya verificado. Absorbe la lógica de la vieja
 * superficie /hypothesis (evidencia a favor / en contra) como un paso interno
 * del Taller. Sonnet (síntesis analítica corta).
 */
import { callClaudeJson, SONNET_MODEL } from "./bedrock-json";
import { packVerifiedContext } from "./phase5-composicion";
import { getFormatConfig } from "./format-config";
import type { AtelierBrief, AtelierHipotesis, VerifiedDossier } from "./types";

const HIPOTESIS_SYSTEM = `Eres un historiador que, antes de redactar, fija la espina argumental de la pieza — y que no se conforma con la primera lectura cómoda de la evidencia. Recibes el ENCARGO y el MATERIAL VERIFICADO (hechos ya cotejados contra las fuentes). Trabajas en dos tiempos.

PRIMERO, mina {N_CANDIDATAS} TESIS CANDIDATAS distintas que el material pueda sostener: lecturas rivales del mismo proceso (p. ej. una que ponga el peso en lo estructural y otra en la contingencia; una que dé la agencia a las élites y otra a los de abajo; una causal y otra que la discuta). Cada candidata, concreta y sustantiva, anclada en hechos del material — nunca genérica ("fue un proceso complejo").

LUEGO, decide y articula con honestidad ante la evidencia:

1. TESIS: la candidata que el material MEJOR sostiene (la más respaldada y específica), en 1-2 frases.
2. ANTÍTESIS: el contraargumento o la tensión más fuerte que el propio material revela contra esa tesis (1-2 frases). Apóyate en las otras candidatas: la más sólida en contra es tu antítesis. Si la evidencia no ofrece un contrapeso fuerte, dilo y nombra la principal tensión.
3. SÍNTESIS: la posición matizada —ni tibia ni maniquea— que la pieza debe sostener integrando tesis y antítesis (1-2 frases).
4. TESIS_ALTERNAS: las demás candidatas que sobrevivan como tensiones legítimas a tejer en la prosa (lista breve; vacía si solo había una lectura defendible).

Funda todo en la evidencia, no en lugares comunes.

Devuelve JSON puro: {"tesis": "...", "antitesis": "...", "sintesis": "...", "tesisAlternas": ["...", "..."]}. Sin texto antes ni después.`;

interface HipotesisRaw {
  tesis?: string;
  antitesis?: string;
  sintesis?: string;
  tesisAlternas?: unknown;
}

export async function formularHipotesis(args: {
  brief: AtelierBrief;
  verified: VerifiedDossier;
}): Promise<AtelierHipotesis> {
  const material = packVerifiedContext(args.verified, args.brief);
  const cfg = getFormatConfig(args.brief.ficha.formato);
  const encargo = [
    args.brief.tesisTentativa ? `Ángulo que vertebra: ${args.brief.tesisTentativa}` : "",
    args.brief.scope ? `Alcance: ${args.brief.scope}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await callClaudeJson<HipotesisRaw>({
    model: SONNET_MODEL,
    system: HIPOTESIS_SYSTEM.replace("{N_CANDIDATAS}", String(cfg.hipotesisCandidatas)),
    user: `ENCARGO:\n${encargo}\n\nMATERIAL VERIFICADO:\n${material}\n\nJSON:`,
    maxTokens: 3200,
    validate: (p) => {
      if (!p || typeof p !== "object") throw new Error("hipótesis no es objeto");
      return p as HipotesisRaw;
    },
  });

  const tesisAlternas = Array.isArray(raw.tesisAlternas)
    ? raw.tesisAlternas
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim())
        .slice(0, 4)
    : [];

  return {
    tesis: (raw.tesis ?? "").trim(),
    antitesis: (raw.antitesis ?? "").trim(),
    sintesis: (raw.sintesis ?? "").trim(),
    ...(tesisAlternas.length ? { tesisAlternas } : {}),
  };
}
