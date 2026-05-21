/**
 * Script para procesar documentos atascados en PROCESSING directamente.
 * Uso: npx tsx scripts/process-pending.ts
 */
import { processAllPendingDocuments, processAllEmbeddings } from "../src/lib/embedding-processor";

async function main() {
  console.log("🔍 Buscando documentos atascados en PROCESSING...\n");
  const { triggered, alreadyReady } = await processAllPendingDocuments();

  if (alreadyReady.length > 0) {
    console.log(`✅ ${alreadyReady.length} documentos ya estaban listos (marcados como READY)`);
  }

  if (triggered.length === 0) {
    console.log("✅ No hay documentos pendientes de procesamiento.");
    process.exit(0);
  }

  console.log(`📋 ${triggered.length} documentos por procesar:\n`);

  for (let i = 0; i < triggered.length; i++) {
    const docId = triggered[i];
    console.log(`\n[${i + 1}/${triggered.length}] Procesando ${docId}...`);
    const start = Date.now();
    await processAllEmbeddings(docId);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`   ✅ Completado en ${elapsed}s`);
  }

  console.log(`\n🎉 Todos los documentos han sido procesados!`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
