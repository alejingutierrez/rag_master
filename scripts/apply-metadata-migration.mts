// Aplica solo la migración nueva: deliverables.metadata
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SQL = `ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb`;

console.log("Aplicando:", SQL);
try {
  await prisma.$executeRawUnsafe(SQL);
  console.log("✓ Aplicado");

  // Verificar
  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string }>>(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'deliverables' AND column_name = 'metadata'`
  );
  console.log("Verificación:", cols);
} catch (e) {
  console.error("ERROR:", e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
