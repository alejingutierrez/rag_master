# AGENTS.md - Guia para Agentes de IA

## Descripcion del Proyecto

RAG Manager es una aplicacion web Next.js 14 (App Router) para gestion de Retrieval-Augmented Generation (RAG). Permite subir PDFs, chunkeizarlos, vectorizarlos con Amazon Bedrock, y hacer preguntas respondidas por Claude Opus 4.6 usando los fragmentos mas relevantes.

## Stack Tecnologico

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS 4 + componentes UI custom (estilo shadcn)
- **Backend**: Next.js API Routes (server-side)
- **Base de datos**: PostgreSQL + pgvector (Amazon RDS)
- **ORM**: Prisma v6
- **Almacenamiento**: AWS S3
- **Embeddings**: Amazon Bedrock - Titan Embeddings v2 (1024 dimensiones)
- **LLM**: Claude Opus 4.6 via AWS Bedrock (Converse API con streaming)
- **Idioma UI**: Espanol

## Estructura del Proyecto

```
rag_master/
├── prisma/
│   ├── schema.prisma                # Modelos de datos (Document, Chunk, Configuration, Conversation)
│   └── migrations/00_init/          # SQL de inicializacion con pgvector
├── src/
│   ├── lib/                         # Servicios core
│   │   ├── prisma.ts                # Singleton Prisma client
│   │   ├── s3.ts                    # Operaciones S3 (upload, download, delete)
│   │   ├── pdf-parser.ts            # Extraccion de texto de PDFs (pdf-parse)
│   │   ├── chunking.ts              # 3 estrategias: FIXED, PARAGRAPH, SENTENCE
│   │   ├── bedrock.ts               # Generacion de embeddings (Titan v2)
│   │   ├── vector-search.ts         # Busqueda cosine similarity con pgvector
│   │   ├── claude.ts                # Claude via Bedrock Converse API (streaming)
│   │   └── utils.ts                 # Utilidades (cn, formatBytes, formatDate)
│   ├── components/                  # Componentes React
│   │   ├── ui/                      # Componentes base (Button, Card, Badge, etc.)
│   │   ├── layout/sidebar.tsx       # Navegacion lateral
│   │   ├── upload/                  # Dropzone + ConfigForm
│   │   ├── documents/               # DocumentTable + ChunkViewer
│   │   ├── enrich/                  # MetadataEditor + ChunkEditor
│   │   └── chat/                    # ChatInterface + ChunkCitations + SearchConfig
│   └── app/
│       ├── layout.tsx               # Layout global con Sidebar
│       ├── page.tsx                 # Redirect a /upload
│       ├── upload/page.tsx          # Pagina de carga de PDFs
│       ├── documents/page.tsx       # Lista de documentos
│       ├── documents/[id]/page.tsx  # Detalle de documento + chunks
│       ├── enrich/page.tsx          # Enriquecimiento de documentos
│       ├── chat/page.tsx            # Interfaz de preguntas con streaming
│       └── api/                     # API Routes (ver seccion API)
```

## API Routes

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/documents` | Listar documentos (paginado) |
| POST | `/api/documents` | Subir PDF (FormData: file, chunkSize, chunkOverlap, strategy) |
| GET | `/api/documents/[id]` | Detalle de documento con chunks |
| DELETE | `/api/documents/[id]` | Eliminar documento, chunks y archivo S3 |
| POST | `/api/documents/[id]/reprocess` | Re-chunkear y re-embedder |
| PATCH | `/api/documents/[id]/enrich` | Actualizar metadata |
| PATCH | `/api/chunks/[id]` | Editar chunk (regenera embedding) |
| POST | `/api/search` | Busqueda semantica vectorial |
| POST | `/api/chat` | Pipeline RAG completo (streaming SSE) |
| GET | `/api/chat/history` | Historial de conversaciones |
| GET/PUT | `/api/config` | Configuracion global |

## Modelos de Datos

### Document
- id, filename, s3Key, s3Url, fileSize, pageCount, status (PENDING/PROCESSING/READY/ERROR), metadata (JSON), error

### Chunk
- id, documentId (FK), content, pageNumber, chunkIndex, embedding (vector(1024)), chunkSize, overlap, strategy

### Configuration
- chunkSize, chunkOverlap, chunkStrategy, embeddingModel, topK, similarityThreshold, maxTokens

### Conversation
- question, answer, modelUsed, chunksUsed (JSON), configurationId (FK)

## Flujo Principal

1. **Upload**: PDF -> S3 -> pdf-parse -> chunking -> Bedrock embeddings -> pgvector
2. **Query**: Pregunta -> Bedrock embedding -> pgvector cosine search -> top-k chunks -> Claude streaming -> respuesta

## Convenciones

- Todos los componentes de pagina son `"use client"` excepto layout.tsx y page.tsx raiz
- Los API routes usan NextRequest/NextResponse
- SQL raw para operaciones con pgvector (Prisma no soporta tipos vector nativamente)
- Streaming via Server-Sent Events (SSE) en el endpoint de chat
- Procesamiento de PDFs es asincrono (no bloquea la respuesta de upload)
- Auto-refresh en la UI cuando hay documentos en estado PROCESSING

## Comandos Utiles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de produccion
npx prisma generate  # Regenerar Prisma client
npx prisma db push   # Sincronizar schema con DB
```

## Variables de Entorno Requeridas

Ver `.env` - requiere: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, DATABASE_URL, S3_BUCKET_NAME, BEDROCK_CLAUDE_MODEL_ID, BEDROCK_EMBEDDING_MODEL_ID
