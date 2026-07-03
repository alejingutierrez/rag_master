/**
 * Extractor de TIPOLOGÍA: convierte una pieza ya escrita del Taller en una ficha
 * estructurada (hecho / época / entidad / pregunta) para su página pública.
 *
 * Una llamada Sonnet + normalización pura (typology-schemas). Best-effort: si
 * falla o el corpus no da para una ficha, devuelve null y la pieza sigue siendo
 * un ensayo normal. NUNCA lanza — no debe tumbar el entregable.
 */
import { callClaudeJson, SONNET_MODEL } from "./bedrock-json";
import { normalizeStructured, type StructuredData } from "../typology-schemas";
import type { AtelierBrief } from "./types";
import type { DeliverableTaxonomy } from "../taxonomy";

const SYSTEM = `Eres un archivista que convierte una pieza de historia de Colombia en una FICHA estructurada para su página pública.

PRIMERO decide la TIPOLOGÍA según el SUJETO central de la pieza:
- "hecho": un acontecimiento o proceso concreto (una batalla, un magnicidio, una constitución, una guerra).
- "epoca": un PERÍODO histórico entero (la Regeneración, el Frente Nacional, los Estados Unidos de Colombia).
- "entidad": una PERSONA, LUGAR, CONCEPTO o INSTITUCIÓN (una semblanza; el perfil de un lugar o una idea).
- "pregunta": la pieza responde a una PREGUNTA histórica explícita (¿qué cambió…?, ¿por qué…?).

LUEGO llena SOLO los campos de esa tipología, extraídos FIELMENTE del texto. No inventes: deja vacío ([] o "") lo que el texto no sustente.

Devuelve JSON PURO (sin markdown). Esquema según la tipología elegida:

hecho:    {"typology":"hecho","titulo","resumen","fecha","anioInicio","anioFin","lugares":[],"protagonistas":[],"causas":[],"consecuencias":[],"porQueImporta"}
epoca:    {"typology":"epoca","titulo","resumen","rango","panorama","hitos":[{"year","titulo","detalle"}],"actores":[],"transformaciones":[],"legado"}
entidad:  {"typology":"entidad","titulo","tipo":"Persona|Lugar|Concepto|Institución","resumen","nacimiento","muerte","roles":[],"hitos":[{"year","titulo"}],"relaciones":[],"semblanza"}
pregunta: {"typology":"pregunta","titulo","resumen","pregunta","tesis","debate","temasRelacionados":[]}

Reglas:
- "titulo": breve y canónico ("El Bogotazo", "Rafael Núñez", "La Regeneración"). En entidad es el nombre.
- "resumen": 1–2 frases; el gancho de la ficha.
- Años como enteros (1948). Deja null lo desconocido; fechas legibles como texto ("9 de abril de 1948").
- NO escribas nada fuera del JSON.`;

export async function extractTypology(args: {
  answer: string;
  intent: string;
  taxonomy?: DeliverableTaxonomy;
  brief?: AtelierBrief;
}): Promise<StructuredData | null> {
  const extracto = args.answer.slice(0, 10000);
  const tx = args.taxonomy;
  const entLine = tx
    ? `ENTIDADES DETECTADAS — personas: ${tx.entidadesPersonas.join(", ")} · lugares: ${tx.entidadesLugares.join(", ")} · conceptos: ${tx.entidadesConceptos.join(", ")}\n`
    : "";
  const user = `ENCARGO: ${args.intent}\n${entLine}\nPIEZA (extracto):\n${extracto}\n\nJSON:`;

  try {
    const raw = await callClaudeJson<Record<string, unknown>>({
      model: SONNET_MODEL,
      system: SYSTEM,
      user,
      maxTokens: 2200,
      validate: (p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}),
    });
    return normalizeStructured(raw, { fallbackPeriodoCode: tx?.periodoCode ?? null });
  } catch (e) {
    console.warn(`[atelier] extracción de tipología falló: ${(e as Error).message}`);
    return null;
  }
}
