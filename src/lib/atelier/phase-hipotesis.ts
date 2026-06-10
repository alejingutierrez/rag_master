/**
 * Fase de Hipótesis — entre verificación y composición. Fija la espina
 * argumental de la pieza ANTES de redactar: tesis / antítesis / síntesis,
 * fundadas en el material ya verificado. Absorbe la lógica de la vieja
 * superficie /hypothesis (evidencia a favor / en contra) como un paso interno
 * del Taller. Sonnet (síntesis analítica corta).
 */
import { callClaudeJson, SONNET_MODEL } from "./bedrock-json";
import { packVerifiedContext } from "./phase5-composicion";
import type { AtelierBrief, AtelierHipotesis, VerifiedDossier } from "./types";

const HIPOTESIS_SYSTEM = `Eres un historiador que, antes de redactar, fija la espina argumental de la pieza. Recibes el ENCARGO y el MATERIAL VERIFICADO (hechos ya cotejados contra las fuentes). Articula, con honestidad ante la evidencia:

1. TESIS: la afirmación central que el material mejor sostiene. Concreta y sustantiva (1-2 frases), nunca genérica ("fue un proceso complejo").
2. ANTÍTESIS: el contraargumento o la tensión más fuerte que el propio material revela contra esa tesis (1-2 frases). Si hay tesis en disputa, recoge la más sólida en contra. Si la evidencia no ofrece un contrapeso fuerte, dilo y nombra la principal tensión.
3. SÍNTESIS: la posición matizada —ni tibia ni maniquea— que la pieza debe sostener integrando tesis y antítesis (1-2 frases).

Funda todo en la evidencia, no en lugares comunes.

Devuelve JSON puro: {"tesis": "...", "antitesis": "...", "sintesis": "..."}. Sin texto antes ni después.`;

interface HipotesisRaw {
  tesis?: string;
  antitesis?: string;
  sintesis?: string;
}

export async function formularHipotesis(args: {
  brief: AtelierBrief;
  verified: VerifiedDossier;
}): Promise<AtelierHipotesis> {
  const material = packVerifiedContext(args.verified, args.brief);
  const encargo = [
    args.brief.tesisTentativa ? `Ángulo que vertebra: ${args.brief.tesisTentativa}` : "",
    args.brief.scope ? `Alcance: ${args.brief.scope}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await callClaudeJson<HipotesisRaw>({
    model: SONNET_MODEL,
    system: HIPOTESIS_SYSTEM,
    user: `ENCARGO:\n${encargo}\n\nMATERIAL VERIFICADO:\n${material}\n\nJSON:`,
    maxTokens: 1500,
    validate: (p) => {
      if (!p || typeof p !== "object") throw new Error("hipótesis no es objeto");
      return p as HipotesisRaw;
    },
  });

  return {
    tesis: (raw.tesis ?? "").trim(),
    antitesis: (raw.antitesis ?? "").trim(),
    sintesis: (raw.sintesis ?? "").trim(),
  };
}
