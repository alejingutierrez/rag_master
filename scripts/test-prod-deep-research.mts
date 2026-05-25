// Test deep-research v2 en producción (modelo POST→polling)
// El POST devuelve {deliverableId} en <1s, después se hace polling.

const PROD = process.env.PROD_URL || "https://fbrwkqtydz.us-east-1.awsapprunner.com";
const QUESTION =
  process.env.QUESTION ||
  "¿Cómo se consolidó el poder de la Iglesia Católica durante la Regeneración en Colombia?";

const t0 = Date.now();
const elapsed = () => ((Date.now() - t0) / 1000).toFixed(0) + "s";

console.log(`[${elapsed()}] POST ${PROD}/api/deep-research`);
console.log(`[${elapsed()}] Pregunta: ${QUESTION}\n`);

const res = await fetch(`${PROD}/api/deep-research`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question: QUESTION }),
});

if (!res.ok) {
  const err = await res.text();
  console.error(`POST falló: HTTP ${res.status} — ${err}`);
  process.exit(1);
}

const { deliverableId } = (await res.json()) as { deliverableId: string };
console.log(`[${elapsed()}] deliverableId: ${deliverableId}`);
console.log(`[${elapsed()}] Polling cada 5s hasta COMPLETE (timeout 15 min)...\n`);

const MAX_WAIT = 15 * 60 * 1000; // 15 min
let lastStage = "";
let lastSubqProgress = "";
let lastPaperWords = -1;

interface Subquery {
  query: string;
  status: string;
  foundChunks?: number;
  error?: string;
}
interface Metadata {
  stage?: string;
  message?: string;
  plan?: { subqueries: string[]; scope?: string; entities?: Record<string, unknown> };
  subqueriesProgress?: Subquery[];
  paperWords?: number;
}
interface Data {
  id: string;
  status: string;
  userQuestion: string;
  answer: string;
  chunksUsed: Array<{ documentFilename?: string; pageNumber?: number; content?: string }>;
  metadata: Metadata;
}

while (Date.now() - t0 < MAX_WAIT) {
  const r = await fetch(`${PROD}/api/deep-research?id=${deliverableId}`);
  if (!r.ok) {
    console.error(`GET falló: HTTP ${r.status}`);
    process.exit(1);
  }
  const d = (await r.json()) as Data;
  const stage = d.metadata?.stage ?? "?";
  const message = d.metadata?.message ?? "";

  if (stage !== lastStage) {
    console.log(`[${elapsed()}] STAGE: ${stage} — ${message}`);
    lastStage = stage;
    if (stage === "executing" && d.metadata?.plan) {
      console.log(`         Plan: ${d.metadata.plan.subqueries.length} subqueries`);
      d.metadata.plan.subqueries.forEach((q, i) => console.log(`         #${i + 1}: ${q.slice(0, 100)}`));
    }
  }

  if (d.metadata?.subqueriesProgress) {
    const summary = d.metadata.subqueriesProgress
      .map((s, i) => `${i + 1}:${s.status[0]}${s.foundChunks ?? ""}`)
      .join(" ");
    if (summary !== lastSubqProgress) {
      console.log(`[${elapsed()}] Subqueries: ${summary}`);
      lastSubqProgress = summary;
    }
  }

  if (d.metadata?.paperWords && d.metadata.paperWords !== lastPaperWords) {
    console.log(`[${elapsed()}] Paper en curso: ${d.metadata.paperWords} palabras`);
    lastPaperWords = d.metadata.paperWords;
  }

  if (d.status === "COMPLETE" || d.status === "ERROR") {
    console.log(`\n=== ${d.status} ===`);
    if (d.status === "ERROR") {
      console.log(`Error: ${d.answer}`);
      process.exit(1);
    }

    const answer = d.answer;
    const words = answer.split(/\s+/).length;
    const citations = (answer.match(/\[#\d+(?:\s*,\s*\d+)*\]/g) ?? []).length;
    const biblioCount = (answer.match(/^##\s+(Referencias|Bibliograf[íi]a|Fuentes)/gm) ?? []).length;
    const hasSections = {
      "El problema": /^##\s+El problema/m.test(answer),
      "Sobre las fuentes": /^##\s+Sobre las fuentes/m.test(answer),
      "Tensiones y matices": /^##\s+Tensiones/m.test(answer),
      "Vacíos paper": /^##\s+Lo que las fuentes/m.test(answer),
      "Conclusión": /^##\s+Conclusión/m.test(answer),
      "Cronología (anexo)": /^##\s+Cronolog[íi]a/m.test(answer),
      "Actores principales (anexo)": /^##\s+Actores principales/m.test(answer),
      "Lo que el corpus no responde (anexo)": /^##\s+Lo que el corpus no responde/m.test(answer),
      "Referencias": /^##\s+Referencias/m.test(answer),
    };

    console.log(`Tiempo total: ${elapsed()}`);
    console.log(`Palabras: ${words}`);
    console.log(`Citas inline: ${citations}`);
    console.log(`Bibliografías (debe ser 1): ${biblioCount}`);
    console.log(`Chunks guardados: ${d.chunksUsed?.length ?? 0}`);
    console.log(`Sub-preguntas: ${d.metadata?.subqueriesProgress?.length ?? 0}`);
    console.log("\nSecciones:");
    for (const [k, v] of Object.entries(hasSections)) console.log(`  ${v ? "✓" : "✗"} ${k}`);

    console.log(`\nDetalle: ${PROD}/producciones/${d.id}`);
    console.log(`Deep-research UI: ${PROD}/deep-research?id=${d.id}`);
    process.exit(0);
  }

  await new Promise((r) => setTimeout(r, 5000));
}

console.error(`TIMEOUT después de ${elapsed()}`);
process.exit(1);
