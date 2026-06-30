/**
 * Fase 3 — Triangulación (el corazón). Cruza fuentes: agrupa la evidencia en
 * núcleos temáticos y, por núcleo, destila claims atómicos con sus fuentes,
 * su grado de concordancia y sus contradicciones YA RESUELTAS. Sonnet, paralelo
 * por núcleo (Promise.allSettled tolerante a fallos).
 */
import { buildContextBlock } from "../rag-context";
import { callClaudeJson, SONNET_MODEL } from "./bedrock-json";
import { getFormatConfig, type FormatConfig } from "./format-config";
import type { SearchResult } from "../vector-search";
import type {
  AtelierBrief,
  Claim,
  Concordancia,
  Contradiction,
  EvidenceDossier,
  EvidenceSource,
  ThematicCore,
} from "./types";

const NUCLEOS_SYSTEM = `Eres un investigador-archivista organizando evidencia documental sobre historia de Colombia y América Latina, de esos que ven el patrón antes de que el resto vea el montón. Recibes fragmentos numerados [N], cada uno de un documento. Agrúpalos en {MIN_NUCLEOS} a {MAX_NUCLEOS} NÚCLEOS TEMÁTICOS coherentes para el encargo: cada núcleo es un frente por donde la pieza atacará el tema.

ENCARGO: {SCOPE}

Devuelve JSON puro (sin markdown):
{ "nucleos": [ { "titulo": "nombre concreto del núcleo", "resumen": "1 frase", "chunks": [1,3,7] } ] }

Reglas:
- Agrupa por TEMA, no por documento. Cada fragmento relevante va en el núcleo que mejor le corresponda; un buen núcleo CRUZA varios documentos distintos (ahí está la triangulación).
- Privilegia núcleos que junten fragmentos de FUENTES DISTINTAS sobre un mismo asunto: ahí es donde se coteja y se gana confiabilidad.
- Ignora fragmentos irrelevantes al encargo (no los fuerces a un núcleo).
- Entre {MIN_NUCLEOS} y {MAX_NUCLEOS} núcleos.
- NO escribas nada fuera del JSON.`;

const CLAIMS_SYSTEM = `Eres un investigador cotejando fuentes sobre un núcleo temático de historia de Colombia/América Latina — meticuloso, desconfiado de la fuente única, con el ojo puesto en dónde dos documentos dicen lo mismo y dónde se contradicen. Recibes fragmentos numerados [N], cada uno de un documento. Destila AFIRMACIONES atómicas y verificables relevantes al núcleo, y mapea qué fragmentos las respaldan, complementan o contradicen.

NÚCLEO: {TITULO} — {RESUMEN}

Devuelve JSON puro (sin markdown):
{ "claims": [ {
  "texto": "afirmación atómica (un hecho, fecha, relación causal)",
  "fuentes": [1, 4],
  "concordancia": "fuerte|parcial|unica|contradicha",
  "contradiccion": { "conflicto": "qué choca", "versionElegida": "la versión elegida", "razon": "por qué" }
} ] }

Reglas:
- "fuentes": números [N] de ESTE bloque que respaldan la afirmación. NUNCA inventes números. Cuando dos o más fragmentos sostengan el mismo hecho, CÍTALOS TODOS: la corroboración multi-fuente es lo que hace fuerte una afirmación.
- "concordancia": "fuerte" si ≥2 fragmentos coinciden; "unica" si lo sostiene uno solo; "parcial" si se complementan; "contradicha" si chocan.
- Persigue activamente la triangulación: antes de marcar "unica", revisa si otro fragmento del bloque toca el mismo hecho desde otro ángulo y súbelo a "fuerte" o "parcial".
- Si "contradicha", RESUÉLVELA: elige la versión mejor soportada (más fragmentos, fuente más detallada) y explica en "razon". Incluye "contradiccion" SOLO en ese caso. Nunca dejes el conflicto abierto.
- Una afirmación sin respaldo en ningún [N]: NO la incluyas.
- Entre {CLAIMS_MIN} y {CLAIMS_MAX} afirmaciones por núcleo. Densidad > volumen, pero no dejes hechos sustanciales sin destilar.
- NO escribas nada fuera del JSON.`;

interface NucleosRaw {
  nucleos?: Array<{ titulo?: string; resumen?: string; chunks?: unknown }>;
}
interface ClaimsRaw {
  claims?: Array<{
    texto?: string;
    fuentes?: unknown;
    concordancia?: string;
    contradiccion?: { conflicto?: string; versionElegida?: string; razon?: string };
  }>;
}

function asIndices(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "number" ? x : parseInt(String(x).replace(/[^\d]/g, ""), 10)))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function toSource(c: SearchResult): EvidenceSource {
  return {
    chunkId: c.id,
    documentId: c.documentId,
    documentFilename: c.documentFilename,
    pageNumber: c.pageNumber,
  };
}

function normConcordancia(s: unknown): Concordancia {
  return s === "fuerte" || s === "parcial" || s === "contradicha" ? s : "unica";
}

/** Paso 3a: agrupa los chunks en núcleos temáticos. */
async function identifyCores(
  chunks: SearchResult[],
  brief: AtelierBrief,
  cfg: FormatConfig
): Promise<ThematicCore[]> {
  // Para AGRUPAR en núcleos basta el tema de cada fragmento, no su texto íntegro:
  // usamos snippets cortos y un presupuesto amplio para que el POOL ENTERO entre
  // a la mesa (con pools grandes, el texto completo dejaría fuera la cola).
  const context = buildContextBlock(chunks, { maxChunkChars: 900, maxContextChars: 600_000 }); // numera [1..N]
  const raw = await callClaudeJson<NucleosRaw>({
    model: SONNET_MODEL,
    system: NUCLEOS_SYSTEM.replace("{SCOPE}", brief.scope || brief.ejes.join(" · "))
      .replace(/\{MIN_NUCLEOS\}/g, String(cfg.minNucleos))
      .replace(/\{MAX_NUCLEOS\}/g, String(cfg.maxNucleos)),
    user: `FRAGMENTOS:\n\n${context}\n\nJSON:`,
    maxTokens: 8000,
    validate: (p) => p as NucleosRaw,
  });

  const cores: ThematicCore[] = [];
  const list = Array.isArray(raw.nucleos) ? raw.nucleos.slice(0, cfg.maxNucleos) : [];
  list.forEach((n, i) => {
    const idxs = asIndices(n.chunks).filter((idx) => idx >= 1 && idx <= chunks.length);
    const chunkIds = idxs.map((idx) => chunks[idx - 1].id);
    if (chunkIds.length === 0) return;
    cores.push({
      id: `n${i + 1}`,
      titulo: n.titulo?.trim() || `Núcleo ${i + 1}`,
      resumen: n.resumen?.trim() || "",
      chunkIds,
    });
  });

  // Degradación: si el modelo no produjo núcleos usables, un único núcleo con todo.
  if (cores.length === 0) {
    cores.push({
      id: "n1",
      titulo: brief.ficha.formato,
      resumen: brief.scope,
      chunkIds: chunks.map((c) => c.id),
    });
  }
  return cores;
}

/** Paso 3b: destila claims de un núcleo. */
async function distillClaims(
  core: ThematicCore,
  chunkMap: Map<string, SearchResult>,
  startIndex: number,
  cfg: FormatConfig
): Promise<Claim[]> {
  const coreChunks = core.chunkIds
    .map((id) => chunkMap.get(id))
    .filter((c): c is SearchResult => Boolean(c));
  if (coreChunks.length === 0) return [];

  const context = buildContextBlock(coreChunks); // renumera [1..k] localmente
  const raw = await callClaudeJson<ClaimsRaw>({
    model: SONNET_MODEL,
    system: CLAIMS_SYSTEM.replace("{TITULO}", core.titulo)
      .replace("{RESUMEN}", core.resumen)
      .replace(/\{CLAIMS_MIN\}/g, String(cfg.claimsMin))
      .replace(/\{CLAIMS_MAX\}/g, String(cfg.claimsMax)),
    user: `FRAGMENTOS:\n\n${context}\n\nJSON:`,
    maxTokens: 16000,
    validate: (p) => p as ClaimsRaw,
  });

  const claims: Claim[] = [];
  const list = Array.isArray(raw.claims) ? raw.claims : [];
  let n = startIndex;
  for (const r of list) {
    if (!r.texto || typeof r.texto !== "string") continue;
    const localIdxs = asIndices(r.fuentes).filter((i) => i >= 1 && i <= coreChunks.length);
    const fuentes = localIdxs.map((i) => toSource(coreChunks[i - 1]));
    if (fuentes.length === 0) continue; // sin respaldo válido → descartar
    const concordancia = normConcordancia(r.concordancia);
    let contradiccion: Contradiction | undefined;
    if (concordancia === "contradicha" && r.contradiccion?.versionElegida) {
      contradiccion = {
        conflicto: r.contradiccion.conflicto ?? "",
        versionElegida: r.contradiccion.versionElegida,
        razon: r.contradiccion.razon ?? "",
      };
    }
    claims.push({
      id: `c${n++}`,
      nucleo: core.titulo,
      texto: r.texto.trim(),
      fuentes,
      concordancia,
      contradiccion,
    });
  }
  return claims;
}

export async function triangular(
  chunks: SearchResult[],
  chunkMap: Map<string, SearchResult>,
  brief: AtelierBrief
): Promise<EvidenceDossier> {
  if (chunks.length === 0) return { nucleos: [], claims: [] };

  const cfg = getFormatConfig(brief.ficha.formato);
  const nucleos = await identifyCores(chunks, brief, cfg);

  // Destilar claims por núcleo en paralelo (tolerante a fallos).
  // Asignamos rangos de id disjuntos para evitar colisiones aunque corran a la vez.
  const settled = await Promise.allSettled(
    nucleos.map((core, i) => distillClaims(core, chunkMap, i * 1000 + 1, cfg))
  );

  const claims: Claim[] = [];
  settled.forEach((s) => {
    if (s.status === "fulfilled") claims.push(...s.value);
  });

  // Renumerar ids de forma compacta y estable (c1..cN).
  claims.forEach((c, i) => {
    c.id = `c${i + 1}`;
  });

  return { nucleos, claims };
}
