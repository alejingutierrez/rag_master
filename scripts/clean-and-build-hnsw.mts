import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🧹 Limpiando índices HNSW previos inválidos...");
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS chunks_embedding_hnsw_idx`);
  console.log("   ✓ chunks_embedding_hnsw_idx eliminado");

  console.log("\n🔧 Configurando memoria para HNSW build (RDS t4g.medium 4GB)...");
  try {
    await prisma.$executeRawUnsafe(`SET maintenance_work_mem = '1500MB'`);
    await prisma.$executeRawUnsafe(`SET max_parallel_maintenance_workers = 2`);
    const r = await prisma.$queryRawUnsafe<Array<{ name: string; setting: string }>>(
      `SELECT name, setting FROM pg_settings WHERE name IN ('maintenance_work_mem', 'max_parallel_maintenance_workers')`
    );
    for (const x of r) console.log(`   ${x.name}: ${x.setting}`);
  } catch (e) {
    console.warn("   ! ", (e as Error).message);
  }

  console.log("\n🔨 Creando HNSW (m=16, ef_construction=64) sobre 250k vectores...");
  console.log("   ⏰ Esperado: 20-90 min");
  const t0 = Date.now();

  await prisma.$executeRawUnsafe(`
    CREATE INDEX chunks_embedding_hnsw_idx
    ON chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
  `);

  const min = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n✓ HNSW construido en ${min} min`);

  // Verificar validez
  const v = await prisma.$queryRawUnsafe<Array<{ indisvalid: boolean }>>(
    `SELECT indisvalid FROM pg_index x
     JOIN pg_class c ON c.oid = x.indexrelid
     WHERE c.relname = 'chunks_embedding_hnsw_idx'`
  );
  if (!v[0]?.indisvalid) {
    console.error("❌ Índice INVALID");
    process.exit(1);
  }
  console.log("   ✓ Índice válido");

  console.log("\n🗑️  Eliminando IVFFLAT antiguo...");
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS chunks_embedding_idx`);
  console.log("   ✓ IVFFLAT eliminado");

  // Estado final
  const idx = await prisma.$queryRawUnsafe<Array<{ indexname: string; indexdef: string }>>(
    `SELECT indexname, indexdef FROM pg_indexes
     WHERE tablename = 'chunks' AND indexname LIKE '%embedding%'`
  );
  console.log("\n📦 Índices finales:");
  for (const i of idx) console.log(`   - ${i.indexname}: ${i.indexdef.substring(0, 120)}`);

  console.log("\n✅ HNSW listo.");
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
