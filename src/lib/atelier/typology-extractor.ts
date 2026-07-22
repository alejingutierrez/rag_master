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

TODAS las tipologías llevan además ANCLAJE GEOGRÁFICO:
  "lugarPrincipal": el sitio más específico y defendible donde la pieza se ancla, y
  "lat" / "lng": sus coordenadas decimales (WGS84, punto decimal, no coma).

Devuelve JSON PURO (sin markdown). Esquema según la tipología elegida (los tres campos geo van en todas):

hecho:    {"typology":"hecho","titulo","resumen","fecha","anioInicio","anioFin","lugares":[],"protagonistas":[],"causas":[],"consecuencias":[],"porQueImporta","lugarPrincipal","lat","lng"}
epoca:    {"typology":"epoca","titulo","resumen","rango","panorama","hitos":[{"year","titulo","detalle"}],"actores":[],"transformaciones":[],"legado","lugarPrincipal","lat","lng"}
entidad:  {"typology":"entidad","titulo","tipo":"Persona|Lugar|Concepto|Institución","resumen","nacimiento","muerte","roles":[],"hitos":[{"year","titulo"}],"relaciones":[],"semblanza","lugarPrincipal","lat","lng"}
pregunta: {"typology":"pregunta","titulo","resumen","pregunta","tesis","debate","temasRelacionados":[],"lugarPrincipal","lat","lng"}

Reglas:
- "titulo": breve y canónico ("El Bogotazo", "Rafael Núñez", "La Regeneración"). En entidad es el nombre.
- "resumen": 1–2 frases; el gancho de la ficha.
- Años como enteros (1948). Deja null lo desconocido; fechas legibles como texto ("9 de abril de 1948").

Reglas del anclaje geográfico:
- Elige el punto MÁS ESPECÍFICO que el texto sustente, y baja de precisión si no lo sustenta:
  sitio exacto (Plaza de Bolívar, Bogotá) > municipio (Ciénaga, Magdalena) > departamento (Chocó) > región (Amazonía).
- hecho: dónde OCURRIÓ. Si se desarrolla en varios sitios, el más definitorio del hecho.
- entidad Lugar: el lugar mismo. entidad Persona: donde transcurre lo esencial de su vida pública
  (no su natalicio si su obra fue en otra parte). entidad Concepto/Institución: su sede o foco geográfico.
- epoca: el centro de gravedad del período (casi siempre la capital o la región que lo define).
- pregunta: el territorio sobre el que la pregunta interroga.
- Casi todo en este archivo ocurre en Colombia: lat entre -4.3 y 13.5; lng entre -82 y -66.8.
  Un punto fuera de Colombia solo es válido si la pieza de verdad ocurre en el exterior
  (Madrid, Panamá tras 1903, Caracas). Si dudas del punto, pon null en lat/lng: es mejor
  no ubicar que ubicar mal.
- Usa null (no 0) cuando no haya un anclaje defendible.
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
