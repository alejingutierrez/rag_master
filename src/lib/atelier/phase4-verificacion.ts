/**
 * Fase 4 — Contraste adversarial. Un verificador escéptico revisa cada claim
 * contra el texto literal de SUS fuentes e intenta refutarlo. Los no soportados
 * se descartan; los sobre-afirmados se atenúan. Sonnet, por lotes en paralelo.
 * Aquí se gana la confiabilidad.
 */
import { callClaudeJson, SONNET_MODEL } from "./bedrock-json";
import type { SearchResult } from "../vector-search";
import type { Claim, Veredicto, VerifiedClaim, VerifiedDossier } from "./types";

const BATCH_SIZE = Number(process.env.ATELIER_VERIFY_BATCH ?? "8");
const SNIPPET = 600;

const VERIFY_SYSTEM = `Eres un verificador escéptico de afirmaciones históricas. Para cada AFIRMACIÓN te doy SUS fuentes (texto literal de los fragmentos que supuestamente la respaldan). Tu trabajo es intentar REFUTARLA: ¿las fuentes la sostienen de verdad, o la afirmación extrapola, infiere o exagera?

Devuelve JSON puro (sin markdown):
{ "verificaciones": [ {
  "id": "c1",
  "veredicto": "soportado" | "atenuar" | "descartar",
  "confianza": 0.0,
  "nota": "qué falla, si atenuar o descartar",
  "textoAtenuado": "reescritura prudente, SOLO si veredicto=atenuar"
} ] }

Criterio:
- "soportado": las fuentes afirman la afirmación de forma directa y explícita.
- "atenuar": el núcleo es correcto pero la afirmación sobre-afirma (en precisión, alcance o causalidad). Devuelve "textoAtenuado" más prudente, conservando lo defendible.
- "descartar": las fuentes NO la sostienen (no aparece, o la contradicen).
- "confianza" (0.0–1.0): qué tan respaldada está por SUS fuentes.
- Responde una entrada por cada afirmación recibida, con su mismo "id".
- NO escribas nada fuera del JSON.`;

interface VerifyRaw {
  verificaciones?: Array<{
    id?: string;
    veredicto?: string;
    confianza?: number;
    nota?: string;
    textoAtenuado?: string;
  }>;
}

interface Verdict {
  veredicto: Veredicto;
  confianza: number;
  nota?: string;
  textoAtenuado?: string;
}

function clamp01(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0.5;
  return Math.max(0, Math.min(1, v));
}

function normVeredicto(s: unknown): Veredicto {
  return s === "atenuar" || s === "descartar" ? s : "soportado";
}

function buildBatchUser(batch: Claim[], chunkMap: Map<string, SearchResult>): string {
  const blocks = batch.map((c) => {
    const fuentes = c.fuentes
      .map((f) => {
        const content = chunkMap.get(f.chunkId)?.content ?? "";
        const snippet = content.slice(0, SNIPPET) + (content.length > SNIPPET ? "…" : "");
        return `- ${snippet || "(fragmento no disponible)"}`;
      })
      .join("\n");
    return `[${c.id}] AFIRMACIÓN: ${c.texto}\nFUENTES:\n${fuentes}`;
  });
  return `${blocks.join("\n\n")}\n\nJSON:`;
}

async function verifyBatch(
  batch: Claim[],
  chunkMap: Map<string, SearchResult>
): Promise<Map<string, Verdict>> {
  const out = new Map<string, Verdict>();
  const raw = await callClaudeJson<VerifyRaw>({
    model: SONNET_MODEL,
    system: VERIFY_SYSTEM,
    user: buildBatchUser(batch, chunkMap),
    maxTokens: 4000,
    validate: (p) => p as VerifyRaw,
  });
  for (const v of raw.verificaciones ?? []) {
    if (!v.id) continue;
    out.set(v.id, {
      veredicto: normVeredicto(v.veredicto),
      confianza: clamp01(v.confianza),
      nota: typeof v.nota === "string" ? v.nota : undefined,
      textoAtenuado: typeof v.textoAtenuado === "string" ? v.textoAtenuado : undefined,
    });
  }
  return out;
}

export async function verificar(
  claims: Claim[],
  chunkMap: Map<string, SearchResult>
): Promise<VerifiedDossier> {
  if (claims.length === 0) return { claims: [], descartados: 0, atenuados: 0 };

  const batches: Claim[][] = [];
  for (let i = 0; i < claims.length; i += BATCH_SIZE) {
    batches.push(claims.slice(i, i + BATCH_SIZE));
  }

  const settled = await Promise.allSettled(batches.map((b) => verifyBatch(b, chunkMap)));
  const verdicts = new Map<string, Verdict>();
  for (const s of settled) {
    if (s.status === "fulfilled") for (const [id, v] of s.value) verdicts.set(id, v);
  }

  const verified: VerifiedClaim[] = [];
  let descartados = 0;
  let atenuados = 0;

  for (const claim of claims) {
    const v = verdicts.get(claim.id);
    // Si el verificador no se pronunció (lote fallido), conservar con confianza media.
    if (!v) {
      verified.push({ ...claim, veredicto: "soportado", confianza: 0.5 });
      continue;
    }

    const docsDistintos = new Set(claim.fuentes.map((f) => f.documentId)).size;
    let veredicto = v.veredicto;
    const confianza = v.confianza;

    // Salvaguarda de corroboración: la confirmación multi-fuente pesa. Un claim con
    // ≥2 documentos distintos y confianza ≥0.5 no se descarta; a lo sumo se atenúa.
    if (veredicto === "descartar" && docsDistintos >= 2 && confianza >= 0.5) {
      veredicto = "atenuar";
    }

    if (veredicto === "descartar") {
      descartados++;
      continue;
    }
    if (veredicto === "atenuar") {
      if (confianza < 0.35) {
        descartados++;
        continue;
      }
      atenuados++;
      verified.push({
        ...claim,
        texto: v.textoAtenuado?.trim() || claim.texto,
        veredicto: "atenuar",
        confianza,
        notaAdversarial: v.nota,
      });
      continue;
    }
    verified.push({ ...claim, veredicto: "soportado", confianza, notaAdversarial: v.nota });
  }

  return { claims: verified, descartados, atenuados };
}
