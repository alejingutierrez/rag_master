-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETE', 'ERROR');

-- CreateTable
CREATE TABLE "deliverables" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "DeliverableStatus" NOT NULL DEFAULT 'PENDING',
    "answer" TEXT NOT NULL DEFAULT '',
    "modelUsed" TEXT NOT NULL DEFAULT '',
    "chunksUsed" JSONB NOT NULL DEFAULT '[]',
    "batchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deliverables_questionId_idx" ON "deliverables"("questionId");
CREATE INDEX "deliverables_templateId_idx" ON "deliverables"("templateId");
CREATE INDEX "deliverables_batchId_idx" ON "deliverables"("batchId");
CREATE INDEX "deliverables_questionId_templateId_idx" ON "deliverables"("questionId", "templateId");

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
