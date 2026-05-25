/**
 * Procesa preguntas para todos los docs pendientes corriendo desde local.
 * Bypassa el endpoint /api/questions/generate-batch que depende de `after()`
 * de Next.js (inestable en App Runner — los procesos huérfanos se mueren).
 *
 * Como local apunta al mismo DATABASE_URL de prod (RDS), las preguntas que
 * se generen quedan en la BD compartida y producción las refleja al instante.
 *
 * Uso: npx tsx scripts/process-questions-loop.mts
 *
 * Variables opcionales:
 *   MAX_DOCS=999  cap total de docs a procesar en esta corrida
 *   STOP_FILE=/tmp/stop-batch  si existe, sale limpio entre lotes
 */
import { processQuestionsBatch } from "../src/lib/questions-batch-processor";
import { prisma } from "../src/lib/prisma";
import { existsSync } from "node:fs";

const MAX_DOCS = parseInt(process.env.MAX_DOCS || "999", 10);
const STOP_FILE = process.env.STOP_FILE || "/tmp/stop-batch";

async function main() {
  const start = Date.now();
  let cumulativeGenerated = 0;
  let cumulativeFailed = 0;
  let iter = 0;

  while (cumulativeGenerated + cumulativeFailed < MAX_DOCS) {
    if (existsSync(STOP_FILE)) {
      console.log(`[process-loop] STOP_FILE detected at ${STOP_FILE} — exiting cleanly`);
      break;
    }

    const pending = await prisma.document.count({
      where: { status: "READY", questions: { none: {} } },
    });
    if (pending === 0) {
      console.log(`[process-loop] ✅ No pending docs left.`);
      break;
    }

    iter++;
    console.log(
      `[process-loop] iter=${iter} pending=${pending} cumulative=gen${cumulativeGenerated}/fail${cumulativeFailed}`
    );

    const result = await processQuestionsBatch();
    cumulativeGenerated += result.generated;
    cumulativeFailed += result.failed;

    const elapsed = ((Date.now() - start) / 60000).toFixed(1);
    console.log(
      `[process-loop] iter=${iter} batch done: gen=${result.generated} fail=${result.failed} remaining=${result.remaining} (cumulative gen=${cumulativeGenerated} fail=${cumulativeFailed} elapsed=${elapsed}min)`
    );

    // Si esta corrida no procesó nada, cortar para evitar loop infinito en caso
    // de fallos sistemáticos.
    if (result.generated === 0 && result.failed === 0) {
      console.log(`[process-loop] iter sin progreso — saliendo para evitar loop`);
      break;
    }
  }

  await prisma.$disconnect();
  console.log(
    `[process-loop] 🏁 Terminado: gen=${cumulativeGenerated} fail=${cumulativeFailed} iter=${iter}`
  );
}

main().catch(async (e) => {
  console.error("[process-loop] ❌ fatal:", e);
  await prisma.$disconnect();
  process.exit(1);
});
