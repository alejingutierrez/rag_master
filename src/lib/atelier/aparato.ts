/**
 * Aparato crítico (lateral) + índice de confianza. Funciones PURAS, derivadas
 * del dossier verificado, sin LLM → testeables sin red. Lo que se guarda en
 * metadata; el cuerpo del entregable queda solo prosa.
 */
import { buildReferencesSection } from "../apa-citations";
import type {
  ConfidenceIndex,
  CriticalApparatus,
  SeccionFuentes,
  SourceRef,
  VerifiedClaim,
} from "./types";

function docsOf(claim: VerifiedClaim): Set<string> {
  return new Set(claim.fuentes.map((f) => f.documentId));
}

/** Índice de confianza a partir de los claims verificados. */
export function deriveConfidenceIndex(claims: VerifiedClaim[]): ConfidenceIndex {
  const claimsTotales = claims.length;
  const claimsBienSoportados = claims.filter((c) => docsOf(c).size >= 2).length;
  const pct = claimsTotales ? claimsBienSoportados / claimsTotales : 0;
  const contradiccionesResueltas = claims.filter((c) => c.contradiccion).length;
  const documentosUnicos = new Set(
    claims.flatMap((c) => c.fuentes.map((f) => f.documentId))
  ).size;
  const confianzaPromedio = claimsTotales
    ? claims.reduce((a, c) => a + c.confianza, 0) / claimsTotales
    : 0;

  const contradictionRate = claimsTotales ? contradiccionesResueltas / claimsTotales : 0;

  // Factores 0..1
  const fDiversidad = Math.min(1, documentosUnicos / 8); // 8+ documentos = pleno
  const fCorroboracion = pct;
  const fConfianza = confianzaPromedio;
  const fConvergencia = 1 - 0.5 * contradictionRate; // menos disputa = más alto

  const factors = [
    { name: "Diversidad de fuentes", value: fDiversidad },
    { name: "Corroboración (≥2 fuentes)", value: fCorroboracion },
    { name: "Confianza verificada", value: fConfianza },
    { name: "Convergencia entre fuentes", value: fConvergencia },
  ];

  let score = Math.round(
    100 * (0.3 * fDiversidad + 0.3 * fCorroboracion + 0.25 * fConfianza + 0.15 * fConvergencia)
  );
  score = Math.max(0, Math.min(100, score));
  const label = score >= 70 ? "alta" : score >= 45 ? "media" : "baja";

  const rationale = `${claimsBienSoportados}/${claimsTotales} afirmaciones con ≥2 fuentes; ${documentosUnicos} documentos distintos; ${contradiccionesResueltas} contradicciones resueltas.`;

  return {
    score,
    label,
    rationale,
    factors,
    claimsTotales,
    claimsBienSoportados,
    pctClaimsBienSoportados: Math.round(pct * 100),
    contradiccionesResueltas,
    documentosUnicos,
    confianzaPromedio: Math.round(confianzaPromedio * 100) / 100,
  };
}

/**
 * Aparato crítico: agrupa las fuentes por núcleo temático (sección). Determinista.
 * Cada sourceRef proviene de las fuentes de un claim → nunca hay refs colgantes.
 */
export function buildCriticalApparatus(claims: VerifiedClaim[]): CriticalApparatus {
  const byNucleo = new Map<string, VerifiedClaim[]>();
  for (const c of claims) {
    const arr = byNucleo.get(c.nucleo);
    if (arr) arr.push(c);
    else byNucleo.set(c.nucleo, [c]);
  }

  const fuentesPorSeccion: SeccionFuentes[] = [];
  for (const [seccion, group] of byNucleo) {
    const seen = new Set<string>();
    const sourceRefs: SourceRef[] = [];
    for (const claim of group) {
      for (const f of claim.fuentes) {
        if (seen.has(f.chunkId)) continue;
        seen.add(f.chunkId);
        sourceRefs.push({
          chunkId: f.chunkId,
          documentFilename: f.documentFilename,
          pageNumber: f.pageNumber,
        });
      }
    }
    fuentesPorSeccion.push({
      seccion,
      sourceRefs,
      claimIds: group.map((c) => c.id),
    });
  }

  // Bibliografía APA de todas las fuentes citadas por claims verificados.
  const allSources = claims.flatMap((c) =>
    c.fuentes.map((f) => ({ documentFilename: f.documentFilename, pageNumber: f.pageNumber }))
  );
  const bibliografia = buildReferencesSection(allSources);

  return { fuentesPorSeccion, bibliografia };
}

/**
 * Red de seguridad determinista para el cuerpo: elimina cualquier cita inline
 * (\`[#N]\`, \`[N]\`, \`(p. 23)\`) que se haya colado y purga una sección de
 * referencias/bibliografía si el modelo la añadió pese a las instrucciones.
 * Garantiza la aserción dura "el cuerpo no contiene [#…]".
 */
export function stripScaffolding(body: string): string {
  let s = body;
  // Citas inline tipo [#15] / [15] / [#3, #22]
  s = s.replace(/\[#?\d+(?:\s*,\s*#?\d+)*\]/g, "");
  // Páginas tipo (p. 23) / (pp. 12-14)
  s = s.replace(/\(p{1,2}\.?\s*\d+(?:\s*[-–]\s*\d+)?\)/gi, "");
  // Sección de referencias/bibliografía al final (el aparato va aparte)
  s = s.replace(
    /\n+#{1,3}\s+(Referencias|Bibliograf[íi]a|Fuentes|References|Bibliography)\s*[\s\S]*$/i,
    "\n"
  );
  // Limpiar dobles espacios y espacios antes de puntuación que dejan las eliminaciones
  s = s.replace(/[ \t]{2,}/g, " ").replace(/ +([.,;:])/g, "$1");
  // Colapsar líneas en blanco triples
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim() + "\n";
}
