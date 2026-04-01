-- Add status and updatedAt columns to conversations (non-destructive, default preserves existing records)
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'COMPLETE';
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
