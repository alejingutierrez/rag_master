/**
 * Guard de relevancia. Tras el acopio, juzga si la evidencia recuperada permite
 * realmente escribir sobre el encargo. Evita el "drift temático": cuando el corpus
 * es pobre en el tema pedido, el retrieval trae material adyacente y el Taller
 * derivaría hacia otro tema. Si la cobertura es nula, el orquestador aborta con un
 * mensaje honesto en vez de componer una pieza desviada.
 */
import { buildContextBlock } from "../chat-templates";
import { callClaudeJson, SONNET_MODEL } from "./bedrock-json";
import type { SearchResult } from "../vector-search";
import type { AtelierBrief } from "./types";

export type Cobertura = "suficiente" | "parcial" | "nula";

export interface RelevanceVerdict {
  cobertura: Cobertura;
  razon: string;
}

const RELEVANCE_SYSTEM = `Eres un archivista que evalúa si un conjunto de fragmentos documentales permite escribir una pieza sobre un encargo concreto. Sé estricto pero justo.

Devuelve JSON puro (sin markdown):
{ "cobertura": "suficiente" | "parcial" | "nula", "razon": "1 frase: qué tratan realmente los fragmentos frente a lo pedido" }

Criterio:
- "suficiente": los fragmentos tratan DIRECTAMENTE el tema del encargo (personajes, época, lugares, conceptos que pide).
- "parcial": rozan el tema o cubren solo una parte; se puede escribir algo, con lagunas.
- "nula": los fragmentos tratan de OTROS temas o épocas; no permiten escribir sobre lo pedido sin inventar o desviarse hacia otro asunto.

NO escribas nada fuera del JSON.`;

export async function assessRelevance(
  brief: AtelierBrief,
  chunks: SearchResult[]
): Promise<RelevanceVerdict> {
  if (chunks.length === 0) {
    return { cobertura: "nula", razon: "No se recuperó evidencia del corpus." };
  }
  const context = buildContextBlock(chunks.slice(0, 12));
  const user = `ENCARGO
Tesis/ángulo: ${brief.tesisTentativa}
Alcance: ${brief.scope}
Ejes: ${brief.ejes.join("; ")}

FRAGMENTOS RECUPERADOS:

${context}

JSON:`;

  try {
    const raw = await callClaudeJson<{ cobertura?: string; razon?: string }>({
      model: SONNET_MODEL,
      system: RELEVANCE_SYSTEM,
      user,
      maxTokens: 500,
      validate: (p) => (p && typeof p === "object" ? (p as { cobertura?: string; razon?: string }) : {}),
    });
    const c = raw.cobertura;
    // Solo se aborta ante un "nula" explícito; cualquier ambigüedad → "parcial".
    const cobertura: Cobertura = c === "suficiente" || c === "nula" ? c : "parcial";
    return { cobertura, razon: typeof raw.razon === "string" ? raw.razon : "" };
  } catch {
    // Si el juez falla, NO bloquear (evita falsos positivos): asumir parcial.
    return { cobertura: "parcial", razon: "" };
  }
}
