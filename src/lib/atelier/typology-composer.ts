/**
 * Compositor de FICHAS — el paso que convierte la evidencia verificada del
 * Taller en la ficha estructurada COMPLETA de una tipología.
 *
 * Diferencia con typology-extractor (best-effort para ensayos):
 *   - La tipología viene FORZADA por el formato elegido (ficha-hecho ⇒ hecho).
 *   - Recibe más material: el artículo entero + las afirmaciones verificadas
 *     (con sus fechas y datos), no un extracto de 10k.
 *   - Exige COMPLETITUD: cada campo que la página pública renderiza debe venir
 *     lleno si el material lo permite. Hay una ronda de reparación dirigida a
 *     los campos faltantes antes de rendirse.
 *
 * Si aun así no se puede construir una ficha válida, lanza: el orquestador
 * decide la degradación (extractor best-effort + nota).
 */
import { callClaudeJson, SONNET_MODEL } from "./bedrock-json";
import {
  normalizeStructured,
  type StructuredData,
  type TypologyKind,
} from "../typology-schemas";
import type { AtelierBrief, VerifiedDossier } from "./types";
import type { DeliverableTaxonomy } from "../taxonomy";

// ── Esquemas y exigencias por tipología ──────────────────────────────

const SCHEMA_LINES: Record<TypologyKind, string> = {
  hecho:
    '{"typology":"hecho","titulo","resumen","fecha","anioInicio","anioFin","lugares":[],"protagonistas":[],"causas":[],"consecuencias":[],"porQueImporta"}',
  epoca:
    '{"typology":"epoca","titulo","resumen","rango","panorama","hitos":[{"year","titulo","detalle"}],"actores":[],"transformaciones":[],"legado"}',
  entidad:
    '{"typology":"entidad","titulo","tipo":"Persona|Lugar|Concepto|Institución","resumen","nacimiento","muerte","roles":[],"hitos":[{"year","titulo","detalle"}],"relaciones":[],"semblanza"}',
  pregunta:
    '{"typology":"pregunta","titulo","resumen","pregunta","tesis","debate","temasRelacionados":[]}',
};

const EXIGENCIAS: Record<TypologyKind, string> = {
  hecho: `- "fecha" legible y "anioInicio" numérico (y "anioFin" si fue un proceso).
- "lugares": todos los del material (mínimo 1).
- "protagonistas": personas e instituciones centrales (mínimo 2 si el material las da).
- "causas": mínimo 2, cada una una frase con sustancia (estructurales y detonantes).
- "consecuencias": mínimo 2 (inmediatas y de largo plazo).
- "porQueImporta": 1–3 frases con juicio, no un eslogan.`,
  epoca: `- "rango" con años ("1863–1885") y "panorama" de 2–4 frases.
- "hitos": mínimo 4, con "year" numérico y "detalle" corto — repartidos por TODO el período, no solo su inicio.
- "actores": mínimo 3 (personas e instituciones).
- "transformaciones": mínimo 2 (qué cambió de verdad: economía, poder, sociedad, territorio).
- "legado": 1–3 frases.`,
  entidad: `- "tipo" correcto (Persona/Lugar/Concepto/Institución).
- Si es Persona: "nacimiento" y "muerte" si el material los da; "roles" con sus cargos u oficios (mínimo 1).
- "hitos": mínimo 3, fechados, cubriendo la trayectoria completa.
- "relaciones": mínimo 2 (personas, lugares o conceptos entretejidos).
- "semblanza": 3–5 frases con sustancia, DISTINTA del resumen.`,
  pregunta: `- "pregunta" formulada con precisión (termina en ?).
- "tesis": la respuesta que el material mejor sostiene, 2–4 frases claras.
- "debate": la tensión historiográfica real, no un genérico "hay debate".
- "temasRelacionados": mínimo 2 ejes.`,
};

const SYSTEM_TEMPLATE = `Eres el archivista mayor de un archivo de historia de Colombia. A partir del ARTÍCULO terminado y de las AFIRMACIONES VERIFICADAS de la investigación, compones la ficha estructurada DEFINITIVA de una pieza de tipología {KIND}.

La tipología ya está decidida: {KIND}. NO la cambies.

Esquema EXACTO (JSON puro, sin markdown):
{SCHEMA}

EXIGENCIAS de esta tipología (la página pública renderiza cada campo; un campo vacío es un hueco visible):
{EXIGENCIAS}

Reglas generales:
- Extrae FIELMENTE del material; no inventes fechas, nombres ni cifras. Si el material de verdad no da para un campo, déjalo vacío ([] o "" o null) — pero agota el material antes.
- "titulo": breve y canónico ("El Bogotazo", "Rafael Núñez", "La Regeneración").
- "resumen": 1–2 frases; el gancho de la ficha.
- Años como enteros (1948); fechas legibles como texto ("9 de abril de 1948").
- NO escribas nada fuera del JSON.`;

// ── Completitud ──────────────────────────────────────────────────────

/** Campos exigidos que faltan en una ficha ya normalizada. */
export function missingFields(s: StructuredData): string[] {
  const missing: string[] = [];
  if (!s.resumen) missing.push("resumen");
  switch (s.typology) {
    case "hecho":
      if (!s.fecha && s.anioInicio == null) missing.push("fecha/anioInicio");
      if (s.lugares.length < 1) missing.push("lugares");
      if (s.protagonistas.length < 1) missing.push("protagonistas");
      if (s.causas.length < 2) missing.push("causas (≥2)");
      if (s.consecuencias.length < 2) missing.push("consecuencias (≥2)");
      if (!s.porQueImporta) missing.push("porQueImporta");
      break;
    case "epoca":
      if (!s.rango) missing.push("rango");
      if (!s.panorama) missing.push("panorama");
      if (s.hitos.length < 4) missing.push("hitos (≥4)");
      if (s.actores.length < 3) missing.push("actores (≥3)");
      if (s.transformaciones.length < 2) missing.push("transformaciones (≥2)");
      if (!s.legado) missing.push("legado");
      break;
    case "entidad":
      if (s.roles.length < 1) missing.push("roles");
      if (s.hitos.length < 3) missing.push("hitos (≥3)");
      if (s.relaciones.length < 2) missing.push("relaciones (≥2)");
      if (!s.semblanza) missing.push("semblanza");
      break;
    case "pregunta":
      if (!s.pregunta) missing.push("pregunta");
      if (!s.tesis) missing.push("tesis");
      if (!s.debate) missing.push("debate");
      if (s.temasRelacionados.length < 2) missing.push("temasRelacionados (≥2)");
      break;
  }
  return missing;
}

// ── Composición ──────────────────────────────────────────────────────

function packClaims(verified: VerifiedDossier, maxClaims: number): string {
  return verified.claims
    .slice(0, maxClaims)
    .map((c) => `- ${c.texto.slice(0, 300)}`)
    .join("\n");
}

export interface ComposeTypologyArgs {
  kind: TypologyKind;
  intent: string;
  answer: string;
  brief: AtelierBrief;
  verified: VerifiedDossier;
  taxonomy?: DeliverableTaxonomy;
}

export async function composeTypology(args: ComposeTypologyArgs): Promise<StructuredData> {
  const system = SYSTEM_TEMPLATE.replace(/\{KIND\}/g, args.kind)
    .replace("{SCHEMA}", SCHEMA_LINES[args.kind])
    .replace("{EXIGENCIAS}", EXIGENCIAS[args.kind]);

  const claims = packClaims(args.verified, 40);
  const tx = args.taxonomy;
  const entLine = tx
    ? `ENTIDADES DETECTADAS — personas: ${tx.entidadesPersonas.join(", ")} · lugares: ${tx.entidadesLugares.join(", ")} · conceptos: ${tx.entidadesConceptos.join(", ")}\n`
    : "";
  const user = `ENCARGO: ${args.intent}\n${entLine}
AFIRMACIONES VERIFICADAS (datos cotejados; tu fuente más fiable para fechas y cifras):
${claims}

ARTÍCULO TERMINADO:
${args.answer.slice(0, 14000)}

JSON:`;

  const normalize = (raw: Record<string, unknown>): StructuredData | null => {
    // La tipología viene forzada por el formato: se impone sobre lo que diga el LLM.
    raw.typology = args.kind;
    return normalizeStructured(raw, {
      fallbackPeriodoCode: tx?.periodoCode ?? null,
      fallbackTitulo: args.intent,
    });
  };

  const first = await callClaudeJson<Record<string, unknown>>({
    model: SONNET_MODEL,
    system,
    user,
    maxTokens: 3500,
    validate: (p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}),
  });
  let structured = normalize(first);
  if (!structured) throw new Error("El compositor de ficha no produjo una ficha válida");

  // Ronda de reparación dirigida a los campos faltantes.
  const missing = missingFields(structured);
  if (missing.length > 0) {
    try {
      const repairUser = `${user}

TU FICHA ANTERIOR (incompleta):
${JSON.stringify(first)}

CAMPOS FALTANTES O INSUFICIENTES: ${missing.join(" · ")}.
Devuelve la ficha COMPLETA de nuevo (JSON puro), conservando lo bueno y llenando esos campos desde el material. Si el material de verdad no los da, déjalos vacíos.`;
      const repaired = await callClaudeJson<Record<string, unknown>>({
        model: SONNET_MODEL,
        system,
        user: repairUser,
        maxTokens: 3500,
        validate: (p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}),
      });
      const rs = normalize(repaired);
      // Solo se adopta la reparación si mejora (menos faltantes que antes).
      if (rs && missingFields(rs).length < missing.length) structured = rs;
    } catch (e) {
      console.warn(`[atelier] reparación de ficha falló: ${(e as Error).message}`);
    }
  }

  return structured;
}
