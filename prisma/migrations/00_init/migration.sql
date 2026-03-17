-- Habilitar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Crear enums
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');
CREATE TYPE "ChunkStrategy" AS ENUM ('FIXED', 'PARAGRAPH', 'SENTENCE');

-- Tabla de documentos
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "s3Url" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- Tabla de chunks con campo vector
CREATE TABLE "chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkSize" INTEGER NOT NULL,
    "overlap" INTEGER NOT NULL,
    "strategy" "ChunkStrategy" NOT NULL,
    "embedding" vector(1024),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- Tabla de configuraciones
CREATE TABLE "configurations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "chunkSize" INTEGER NOT NULL DEFAULT 1024,
    "chunkOverlap" INTEGER NOT NULL DEFAULT 128,
    "chunkStrategy" "ChunkStrategy" NOT NULL DEFAULT 'FIXED',
    "embeddingModel" TEXT NOT NULL DEFAULT 'amazon.titan-embed-text-v2:0',
    "topK" INTEGER NOT NULL DEFAULT 5,
    "similarityThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "configurations_pkey" PRIMARY KEY ("id")
);

-- Tabla de conversaciones
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "chunksUsed" JSONB NOT NULL DEFAULT '[]',
    "configurationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- Índices
CREATE INDEX "chunks_documentId_idx" ON "chunks"("documentId");

-- Índice vectorial para búsqueda por cosine similarity
CREATE INDEX "chunks_embedding_idx" ON "chunks" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- Foreign keys
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_configurationId_fkey"
    FOREIGN KEY ("configurationId") REFERENCES "configurations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insertar configuración por defecto
INSERT INTO "configurations" ("id", "name", "chunkSize", "chunkOverlap", "chunkStrategy", "embeddingModel", "topK", "similarityThreshold", "maxTokens", "createdAt", "updatedAt")
VALUES ('default', 'default', 1024, 128, 'FIXED', 'amazon.titan-embed-text-v2:0', 5, 0.7, 4096, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
