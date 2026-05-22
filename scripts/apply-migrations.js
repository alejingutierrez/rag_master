'use strict';
// Runs on container startup (before node server.js).
// Applies any pending schema changes using raw SQL — safe to re-run (IF NOT EXISTS).
// Uses @prisma/client (already in the production image) so no Prisma CLI needed.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MIGRATIONS = [
  // 2026-03-31: add status + updatedAt to conversations (legacy — kept for idempotency)
  `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'COMPLETE'`,
  `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  // 2026-04-01: add templateId to conversations (was in schema but missing from DB)
  `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "templateId" TEXT`,
  // 2026-04-06: add fileHash to documents for duplicate detection
  `ALTER TABLE documents ADD COLUMN IF NOT EXISTS "fileHash" TEXT`,
  `CREATE INDEX IF NOT EXISTS "documents_fileHash_idx" ON documents ("fileHash")`,
  // 2026-04-06: ordering fields for intelligent question ordering
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS "ordenPeriodo" INTEGER`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS "ordenCategoria" INTEGER`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS "ordenSubcategoria" INTEGER`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS "temaPeriodo" TEXT`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS "temaCategoria" TEXT`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS "temaSubcategoria" TEXT`,
  `CREATE INDEX IF NOT EXISTS "questions_periodoCode_ordenPeriodo_idx" ON questions ("periodoCode", "ordenPeriodo")`,
  `CREATE INDEX IF NOT EXISTS "questions_categoriaCode_ordenCategoria_idx" ON questions ("categoriaCode", "ordenCategoria")`,
  `CREATE INDEX IF NOT EXISTS "questions_subcategoriaCode_ordenSubcategoria_idx" ON questions ("subcategoriaCode", "ordenSubcategoria")`,

  // 2026-05-21: BM25 (FTS español) — chunks.content_fts + GIN index + trigger
  // Esto habilita la búsqueda híbrida vector + BM25 con websearch_to_tsquery.
  `ALTER TABLE chunks ADD COLUMN IF NOT EXISTS content_fts tsvector`,
  // Trigger para mantener content_fts actualizado en INSERT y UPDATE de content
  `CREATE OR REPLACE FUNCTION chunks_content_fts_trigger() RETURNS trigger AS $$
   BEGIN
     NEW.content_fts := to_tsvector('spanish', NEW.content);
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS chunks_fts_trigger ON chunks`,
  `CREATE TRIGGER chunks_fts_trigger
   BEFORE INSERT OR UPDATE OF content ON chunks
   FOR EACH ROW EXECUTE FUNCTION chunks_content_fts_trigger()`,
  // GIN index para queries BM25 rápidas
  `CREATE INDEX IF NOT EXISTS chunks_fts_idx ON chunks USING gin(content_fts)`,

  // 2026-05-21: chunks_v2 (parent-child) — por ahora solo crear la tabla;
  // el re-procesamiento se hace bajo demanda con scripts/reprocess-v2.mts
  `CREATE TABLE IF NOT EXISTS chunks_v2 (
     id           TEXT PRIMARY KEY,
     "documentId" TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
     content      TEXT NOT NULL,
     "contextualContent" TEXT,
     "pageNumber" INTEGER NOT NULL,
     "chunkIndex" INTEGER NOT NULL,
     "parentIndex" INTEGER NOT NULL,
     "chapterTitle" TEXT,
     "isParent"   BOOLEAN NOT NULL DEFAULT false,
     embedding    vector(1536),
     metadata     JSONB NOT NULL DEFAULT '{}',
     "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS chunks_v2_documentId_idx ON chunks_v2("documentId")`,
  `CREATE INDEX IF NOT EXISTS chunks_v2_parent_idx ON chunks_v2("documentId", "parentIndex") WHERE "isParent" = true`,
  `ALTER TABLE chunks_v2 ADD COLUMN IF NOT EXISTS content_fts tsvector
   GENERATED ALWAYS AS (to_tsvector('spanish', coalesce("contextualContent", content))) STORED`,
  `CREATE INDEX IF NOT EXISTS chunks_v2_fts_idx ON chunks_v2 USING gin(content_fts)`,

  // 2026-05-21: HNSW index para chunks (reemplaza IVFFLAT). Idempotente — si ya existe HNSW
  // por construcción manual previa, este IF NOT EXISTS es no-op. Si solo existe IVFFLAT,
  // este CREATE crea HNSW; el IVFFLAT viejo NO se elimina aquí (hacerlo requiere DROP manual).
  // NOTA: build de HNSW sobre 250k+ vectores tarda ~10 min y necesita ≥1GB maintenance_work_mem.
  // No corre en cada deploy: solo la PRIMERA vez que no existe.
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'chunks_embedding_hnsw_idx') THEN
       PERFORM set_config('maintenance_work_mem', '1500MB', false);
       EXECUTE 'CREATE INDEX chunks_embedding_hnsw_idx ON chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)';
     END IF;
   END $$`,

  // 2026-05-22: Deliverable acepta chat libre (sin Question del batch).
  // Hacemos questionId opcional y añadimos userQuestion + source para distinguir el origen.
  `ALTER TABLE deliverables ALTER COLUMN "questionId" DROP NOT NULL`,
  `ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS "userQuestion" TEXT`,
  `ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'batch'`,
  `CREATE INDEX IF NOT EXISTS deliverables_source_idx ON deliverables("source")`,
  `CREATE INDEX IF NOT EXISTS deliverables_createdAt_idx ON deliverables("createdAt" DESC)`,

  // 2026-05-21: Question.targetCount + denormalizado de trazabilidad de respuestas.
  // - targetCount: N de preguntas pedido a Claude en este batch (40 por default, configurable).
  // - deliverableCount / completedTemplateIds / lastDeliveredAt: cache de "qué entregables
  //   tiene esta pregunta", para badges y filtros en /questions sin joins caros.
  //   Se mantiene desde el código en src/lib/question-stats-sync.ts.
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS "targetCount" INTEGER NOT NULL DEFAULT 40`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS "deliverableCount" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS "completedTemplateIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS "lastDeliveredAt" TIMESTAMP(3)`,
  `CREATE INDEX IF NOT EXISTS questions_documentId_deliverableCount_idx ON questions ("documentId", "deliverableCount")`,
  // Backfill: contar entregables COMPLETE existentes y poblar las nuevas columnas.
  // Solo corre la primera vez (idempotente porque WHERE q.deliverableCount = 0 limita el alcance,
  // pero también es seguro repetirlo: recomputa lo mismo).
  `UPDATE questions q SET
     "deliverableCount" = sub.cnt,
     "completedTemplateIds" = sub.templates,
     "lastDeliveredAt" = sub.last_at
   FROM (
     SELECT "questionId" AS qid,
            COUNT(*)::int AS cnt,
            ARRAY_AGG(DISTINCT "templateId") AS templates,
            MAX("updatedAt") AS last_at
     FROM deliverables
     WHERE "questionId" IS NOT NULL AND status = 'COMPLETE'
     GROUP BY "questionId"
   ) sub
   WHERE q.id = sub.qid`,

  // 2026-05-22: orden cronológico + narrativo.
  // - periodoOrden: índice cronológico (PRE=0, CON=1, ..., POS=14, TRANS=15).
  //   Necesario porque ORDER BY periodoCode es alfabético (C91 < CON < PRE),
  //   no cronológico (PRE < CON < ... < POS).
  // - embedding: vector(1536) Cohere v4 para greedy chain narrativa dentro
  //   de cada período. Prisma no soporta pgvector → se accede vía $queryRaw.
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS "periodoOrden" INTEGER NOT NULL DEFAULT 15`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS embedding vector(1536)`,
  `CREATE INDEX IF NOT EXISTS questions_periodoOrden_ordenPeriodo_idx ON questions ("periodoOrden", "ordenPeriodo")`,
  `CREATE INDEX IF NOT EXISTS questions_documentId_periodoOrden_idx ON questions ("documentId", "periodoOrden", "ordenPeriodo")`,
  // Backfill periodoOrden: mapeo cronológico de PERIOD_OPTIONS.
  `UPDATE questions SET "periodoOrden" = CASE "periodoCode"
     WHEN 'PRE' THEN 0
     WHEN 'CON' THEN 1
     WHEN 'COL' THEN 2
     WHEN 'PRE_IND' THEN 3
     WHEN 'IND' THEN 4
     WHEN 'NGR' THEN 5
     WHEN 'EUC' THEN 6
     WHEN 'REG' THEN 7
     WHEN 'REP_LIB' THEN 8
     WHEN 'VIO' THEN 9
     WHEN 'FN' THEN 10
     WHEN 'CNA' THEN 11
     WHEN 'C91' THEN 12
     WHEN 'SDE' THEN 13
     WHEN 'POS' THEN 14
     WHEN 'TRANS' THEN 15
     ELSE 15
   END
   WHERE "periodoOrden" = 15 OR "periodoOrden" IS NULL`,
];

async function main() {
  console.log('[migrate] Applying schema migrations...');
  for (const sql of MIGRATIONS) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('[migrate] OK:', sql.slice(0, 60));
    } catch (e) {
      // Most likely "already exists" — not a fatal error
      console.warn('[migrate] Skipped (may already exist):', e.message);
    }
  }
  console.log('[migrate] Done.');
}

main()
  .catch((e) => {
    // Never crash on migration failure — the server must still start
    console.error('[migrate] Error (server will still start):', e.message);
  })
  .finally(() => prisma.$disconnect());
