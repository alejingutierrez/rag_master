-- Migración: añadir BM25 (PostgreSQL FTS español) + tabla chunks_v2 para parent-child
-- Aplicar manualmente o vía scripts/apply-migrations.js

-- 1. Configurar diccionario español para FTS si no existe (es el default en muchas instancias)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'spanish') THEN
    RAISE NOTICE 'spanish ts_config no existe — usar simple como fallback';
  END IF;
END $$;

-- 2. Crear tabla chunks_v2 (parent-child)
CREATE TABLE IF NOT EXISTS chunks_v2 (
  id           TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  "contextualContent" TEXT,  -- contenido + título doc + capítulo (lo que se embede)
  "pageNumber" INTEGER NOT NULL,
  "chunkIndex" INTEGER NOT NULL,  -- índice global del child en el doc
  "parentIndex" INTEGER NOT NULL, -- a qué parent pertenece
  "chapterTitle" TEXT,
  "isParent"   BOOLEAN NOT NULL DEFAULT false, -- si true, es un parent chunk; si false, es child
  embedding    vector(1536),   -- solo children tienen embedding
  metadata     JSONB NOT NULL DEFAULT '{}',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS chunks_v2_documentId_idx ON chunks_v2("documentId");
CREATE INDEX IF NOT EXISTS chunks_v2_parent_idx ON chunks_v2("documentId", "parentIndex") WHERE "isParent" = true;

-- 3. Columna tsvector para BM25 (sobre contextualContent que tiene más señal)
ALTER TABLE chunks_v2
  ADD COLUMN IF NOT EXISTS content_fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('spanish', coalesce("contextualContent", content))
  ) STORED;

CREATE INDEX IF NOT EXISTS chunks_v2_fts_idx ON chunks_v2 USING gin(content_fts);

-- 4. También añadir FTS a la tabla `chunks` legacy para permitir BM25 inmediato
ALTER TABLE chunks
  ADD COLUMN IF NOT EXISTS content_fts tsvector
  GENERATED ALWAYS AS (to_tsvector('spanish', content)) STORED;

CREATE INDEX IF NOT EXISTS chunks_fts_idx ON chunks USING gin(content_fts);

-- 5. Índice HNSW para chunks_v2 (se crea recién cuando hay datos)
-- Se hace en scripts/migrate-to-hnsw.mts después de embedder
