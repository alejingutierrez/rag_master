/**
 * Test e2e del Taller (modelo POST→polling). Aserciones DURAS sobre el
 * entregable: cuerpo limpio (sin citas inline ni andamiaje), índice de confianza,
 * diversidad de fuentes y aparato crítico sin refs colgantes.
 *
 *   npx tsx scripts/test-prod-atelier.mts
 *   ATELIER_URL=http://localhost:3000 FORMAT=cronica npx tsx scripts/test-prod-atelier.mts
 */

const URL = process.env.ATELIER_URL || process.env.PROD_URL || "http://localhost:3000";
const INTENT =
  process.env.INTENT ||
  "Cuéntame la toma y la retoma del Palacio de Justicia en noviembre de 1985 desde la mirada de las víctimas.";
const FORMAT = process.env.FORMAT || "cronica";
const QUESTION_ID = process.env.QUESTION_ID || undefined;
const MIN_DOCS = Number(process.env.MIN_DOCS || "3");
const MAX_WAIT = Number(process.env.TIMEOUT || String(15 * 60)) * 1000;

const t0 = Date.now();
const elapsed = () => ((Date.now() - t0) / 1000).toFixed(0) + "s";

// Frases de andamiaje historiográfico que NUNCA deben aparecer en el cuerpo.
const SCAFFOLDING = [
  "[#",
  "según el corpus",
  "el corpus disponible",
  "el corpus no permite",
  "el corpus no responde",
  "no se puede saber",
  "los documentos disponibles",
  "las fuentes indican",
  "las fuentes señalan",
  "las fuentes coinciden",
  "las fuentes disponibles",
];

interface Phase {
  key: string;
  status: string;
  metric?: string;
}
interface AtelierMeta {
  stage?: string;
  message?: string;
  phases?: Phase[];
  wordCount?: number;
  confidenceIndex?: {
    score: number;
    label: string;
    documentosUnicos?: number;
  };
  criticalApparatus?: {
    fuentesPorSeccion?: { seccion: string; sourceRefs: { chunkId: string }[] }[];
  };
  taxonomy?: {
    periodoCode?: string;
    categoriaCode?: string;
    entidadesPersonas?: string[];
    entidadesLugares?: string[];
    entidadesConceptos?: string[];
  };
  degraded?: string[];
}
interface Data {
  id: string;
  status: string;
  answer: string;
  chunksUsed: Array<{ id: string; documentFilename?: string }>;
  metadata: { atelier?: AtelierMeta } | null;
}

function fail(msg: string): never {
  console.error(`\n✗ FAIL: ${msg}`);
  process.exit(1);
}
function ok(msg: string): void {
  console.log(`  ✓ ${msg}`);
}

async function main(): Promise<void> {
  console.log(`[${elapsed()}] POST ${URL}/api/atelier · formato=${FORMAT}`);
  console.log(`[${elapsed()}] Intención: ${INTENT}\n`);

  const res = await fetch(`${URL}/api/atelier`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent: INTENT, formatId: FORMAT, questionId: QUESTION_ID }),
  });
  if (!res.ok) fail(`POST HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  const { deliverableId } = (await res.json()) as { deliverableId?: string };
  if (!deliverableId) fail("POST no devolvió deliverableId");
  console.log(`[${elapsed()}] deliverableId: ${deliverableId}\nPolling cada 5s…\n`);

  let lastStage = "";
  let lastWords = -1;
  while (Date.now() - t0 < MAX_WAIT) {
    await new Promise((r) => setTimeout(r, 5000));
    const r = await fetch(`${URL}/api/deliverables/${deliverableId}`);
    if (!r.ok) {
      console.log(`[${elapsed()}] GET HTTP ${r.status} — reintentando`);
      continue;
    }
    const d = (await r.json()) as Data;
    const m = d.metadata?.atelier;
    if (m?.stage && m.stage !== lastStage) {
      console.log(`[${elapsed()}] FASE: ${m.stage} — ${m.message ?? ""}`);
      lastStage = m.stage;
    }
    if (m?.wordCount && m.wordCount !== lastWords) {
      console.log(`[${elapsed()}] Composición: ${m.wordCount} palabras`);
      lastWords = m.wordCount;
    }

    if (d.status === "COMPLETE" || d.status === "ERROR") {
      console.log(`\n=== ${d.status} (${elapsed()}) ===\n`);
      if (d.status === "ERROR") fail(`Entregable en ERROR: ${d.answer}`);

      const answer = d.answer ?? "";
      const meta = d.metadata?.atelier;

      // 1. Cuerpo limpio: sin citas inline.
      if (/\[#?\d+\]/.test(answer)) fail("el cuerpo contiene citas inline [N]");
      ok("sin citas inline en el cuerpo");

      // 2. Sin andamiaje historiográfico.
      const low = answer.toLowerCase();
      const hit = SCAFFOLDING.find((s) => low.includes(s.toLowerCase()));
      if (hit) fail(`el cuerpo contiene andamiaje: "${hit}"`);
      ok("sin andamiaje historiográfico");

      // 3. Longitud razonable.
      const words = answer.trim().split(/\s+/).filter(Boolean).length;
      if (words < 300) fail(`cuerpo demasiado corto (${words} palabras)`);
      ok(`extensión: ${words} palabras`);

      // 4. Índice de confianza válido.
      const ci = meta?.confidenceIndex;
      if (!ci) fail("falta metadata.atelier.confidenceIndex");
      if (typeof ci.score !== "number" || ci.score < 0 || ci.score > 100)
        fail(`confidenceIndex.score inválido: ${ci.score}`);
      if (!["alta", "media", "baja"].includes(ci.label))
        fail(`confidenceIndex.label inválido: ${ci.label}`);
      ok(`índice de confianza: ${ci.score} (${ci.label})`);

      // 5. Diversidad de fuentes.
      const docs = new Set(
        (d.chunksUsed ?? []).map((c) => c.documentFilename ?? c.id)
      );
      if (docs.size < MIN_DOCS)
        fail(`solo ${docs.size} documentos distintos (mínimo ${MIN_DOCS})`);
      ok(`${docs.size} documentos distintos citados`);

      // 6. Aparato crítico sin refs colgantes.
      const secciones = meta?.criticalApparatus?.fuentesPorSeccion ?? [];
      if (secciones.length === 0) fail("aparato crítico sin secciones");
      const chunkIds = new Set((d.chunksUsed ?? []).map((c) => c.id));
      for (const s of secciones)
        for (const ref of s.sourceRefs)
          if (!chunkIds.has(ref.chunkId)) fail(`ref colgante en aparato: ${ref.chunkId}`);
      ok(`aparato crítico: ${secciones.length} secciones, sin refs colgantes`);

      // 7. Metadata analítica construida.
      const tax = meta?.taxonomy;
      if (!tax) fail("falta metadata.atelier.taxonomy");
      if (!tax.periodoCode) fail("taxonomy sin periodoCode");
      const numEnt =
        (tax.entidadesPersonas?.length ?? 0) +
        (tax.entidadesLugares?.length ?? 0) +
        (tax.entidadesConceptos?.length ?? 0);
      if (numEnt === 0) fail("taxonomy sin entidades construidas");
      ok(`metadata analítica: período ${tax.periodoCode}/${tax.categoriaCode ?? "?"}, ${numEnt} entidades`);

      if (meta?.degraded?.length) {
        console.log(`\n  ⚠ degradaciones: ${meta.degraded.join("; ")}`);
      }
      console.log(`\n✓ TODAS LAS ASERCIONES PASARON (${elapsed()})`);
      console.log(`Detalle: ${URL}/producciones/${d.id}`);
      process.exit(0);
    }
  }
  fail(`TIMEOUT tras ${elapsed()} (último stage=${lastStage})`);
}

main().catch((e) => fail((e as Error).message));
