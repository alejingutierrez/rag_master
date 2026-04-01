'use strict';
// Runs on container startup (before node server.js).
// Applies any pending schema changes using raw SQL — safe to re-run (IF NOT EXISTS).
// Uses @prisma/client (already in the production image) so no Prisma CLI needed.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MIGRATIONS = [
  // 2026-03-31: add status + updatedAt to conversations for polling architecture
  `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'COMPLETE'`,
  `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
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
