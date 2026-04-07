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
