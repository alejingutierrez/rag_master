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
| POST | `/api/documents` | Parsear PDF, chunkear y guardar (con deteccion de duplicados via fileHash) |
| POST | `/api/documents/presign` | Generar presigned URL para upload directo a S3 |
| POST | `/api/documents/check-duplicate` | Verificar si un documento ya existe por SHA-256 hash |
| GET | `/api/documents/[id]` | Detalle de documento con chunks |
| DELETE | `/api/documents/[id]` | Eliminar documento, chunks y archivo S3 |
| GET | `/api/documents/[id]/process` | Consultar progreso de embeddings |
| POST | `/api/documents/[id]/process` | Disparar/continuar procesamiento de embeddings en background |
| POST | `/api/documents/[id]/reprocess` | Re-chunkear y re-embedder |
| POST | `/api/documents/process-pending` | Recuperar documentos atascados en PROCESSING |
| PATCH | `/api/documents/[id]/enrich` | Actualizar metadata |
| PATCH | `/api/chunks/[id]` | Editar chunk (regenera embedding) |
| POST | `/api/search` | Busqueda semantica vectorial |
| POST | `/api/chat` | Pipeline RAG completo (streaming SSE) |
| GET | `/api/chat/history` | Historial de conversaciones |
| GET | `/api/questions` | Listar preguntas (filtros: documentId, periodo, categoria, subcategoria, search, sortBy) |
| GET | `/api/questions/[id]` | Detalle de pregunta |
| POST | `/api/documents/[id]/questions/generate` | Generar preguntas con Claude (SSE streaming) |
| POST | `/api/deliverables/generate` | Generar respuestas para preguntas con templates |
| GET/PUT | `/api/config` | Configuracion global |

## Modelos de Datos

### Document
- id, filename, s3Key, s3Url, fileSize, fileHash (SHA-256, para duplicados), pageCount, status (PENDING/PROCESSING/READY/ERROR), metadata (JSON), enriched, error

### Chunk
- id, documentId (FK), content, pageNumber, chunkIndex, embedding (vector(1024)), chunkSize, overlap, strategy

### Configuration
- chunkSize, chunkOverlap, chunkStrategy, embeddingModel, topK, similarityThreshold, maxTokens

### Question
- id, documentId (FK), questionNumber, pregunta, periodoCode, periodoNombre, periodoRango, categoriaCode, categoriaNombre, subcategoriaCode, subcategoriaNombre, periodosRelacionados[], categoriasRelacionadas[], justificacion, batchId
- **Ordenamiento inteligente** (asignados por `scripts/order-questions.mts`): ordenPeriodo, ordenCategoria, ordenSubcategoria, temaPeriodo, temaCategoria, temaSubcategoria

### Deliverable
- id, questionId (FK), templateId, status (PENDING/GENERATING/COMPLETE/ERROR), answer, modelUsed, chunksUsed, batchId

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

## Scripts

| Script | Comando | Descripcion |
|--------|---------|-------------|
| apply-migrations.js | `node scripts/apply-migrations.js` | Migraciones SQL idempotentes (corre al iniciar container) |
| reprocess-all.mts | `npx tsx scripts/reprocess-all.mts` | Re-procesa PDFs (chunks + embeddings) |
| order-questions.mts | `npx tsx scripts/order-questions.mts` | Asigna orden logico a preguntas por periodo, categoria y subcategoria |

### order-questions.mts

Usa Claude Opus 4.6 via Bedrock para analizar preguntas y asignar un orden logico y un tema descriptivo dentro de cada grupo (periodo, categoria, subcategoria). Es idempotente — puede re-ejecutarse despues de agregar nuevas preguntas.

```bash
npx tsx scripts/order-questions.mts                          # todas las dimensiones
npx tsx scripts/order-questions.mts --dimension periodo      # solo periodos
npx tsx scripts/order-questions.mts --dimension categoria    # solo categorias
npx tsx scripts/order-questions.mts --dimension subcategoria # solo subcategorias
npx tsx scripts/order-questions.mts --dry-run                # muestra grupos sin llamar a Claude
```

Campos que actualiza: `ordenPeriodo`, `ordenCategoria`, `ordenSubcategoria`, `temaPeriodo`, `temaCategoria`, `temaSubcategoria`.

## Deploy a Produccion (AWS App Runner)

El deploy es **automatico** al hacer push a `main`. El pipeline esta en `.github/workflows/deploy.yml`.

### Flujo completo

```bash
git add <archivos>
git commit -m "descripcion del cambio"
git push origin main
```

Esto dispara el workflow de GitHub Actions que:
1. Construye la imagen Docker (`Dockerfile`, plataforma `linux/amd64`)
2. La sube a Amazon ECR (`rag-master`)
3. Espera a que App Runner este listo (no hay deploys en curso)
4. Actualiza el servicio App Runner con la nueva imagen
5. Espera a que App Runner confirme estado `RUNNING`

### Monitorear deploy

```bash
# Requiere GITHUB_TOKEN del .env
export GH_TOKEN=$(grep GITHUB_TOKEN .env | cut -d= -f2)

# Ver estado del ultimo deploy
gh run list --limit 1 --repo alejingutierrez/rag_master

# Seguir deploy en tiempo real
gh run watch <RUN_ID> --repo alejingutierrez/rag_master --exit-status
```

### Migraciones de BD

Las migraciones SQL se aplican **automaticamente** al iniciar el contenedor via `scripts/apply-migrations.js`. Todas usan `IF NOT EXISTS` para ser idempotentes. Para agregar una nueva migracion:
1. Agregar el SQL al array `MIGRATIONS` en `scripts/apply-migrations.js`
2. Actualizar `prisma/schema.prisma` con el cambio correspondiente
3. Ejecutar `npx prisma generate` localmente

### Infraestructura

| Componente | Servicio |
|-----------|----------|
| App | AWS App Runner (us-east-1) |
| Contenedor | Amazon ECR (`rag-master`) |
| Base de datos | Amazon RDS PostgreSQL + pgvector |
| Almacenamiento | Amazon S3 |
| LLM/Embeddings | Amazon Bedrock (Claude + Titan) |
| CI/CD | GitHub Actions |

### Variables de entorno (produccion)

Configuradas como secrets de GitHub y se inyectan como env vars de App Runner en el workflow. Ver `.github/workflows/deploy.yml` para la lista completa.

#### Variables opcionales para tuning

- `BEDROCK_QUESTIONS_MODEL_ID` — Modelo para el batch de generación de preguntas. Default en código: `us.anthropic.claude-sonnet-4-6`. Override solo si quieres forzar otro modelo (Haiku para más velocidad y menos calidad, Opus para máxima calidad y menos velocidad).

## Tuning del batch de generación de preguntas

El batch (`POST /api/questions/generate-batch` → `processQuestionsBatch()` vía `after()`) está tuneado para procesar **60 docs por invocación**, con **3 concurrentes**, usando **Sonnet 4.6**. Razón histórica: hasta el deploy anterior caía a Opus (vía `BEDROCK_CLAUDE_MODEL_ID`), se serializaba con `/api/chat` por el semáforo, y procesaba 20 docs en serie con 2s de pausa — ~30-60s/doc.

### Configuración actual (post-tuning)

| Parámetro | Valor | Archivo |
|---|---|---|
| Modelo | Sonnet 4.6 (default) | [src/lib/questions-generator.ts:13](src/lib/questions-generator.ts:13) |
| `maxTokens` | 8000 (era 16000) | [src/lib/questions-generator.ts:329](src/lib/questions-generator.ts:329) |
| `INTER_DOC_PAUSE_MS` | 500 (era 2000) | [src/lib/questions-batch-processor.ts:13](src/lib/questions-batch-processor.ts:13) |
| `MAX_DOCS_PER_RUN` | 60 (era 20) | [src/lib/questions-batch-processor.ts:14](src/lib/questions-batch-processor.ts:14) |
| `CONCURRENCY` | 3 (nuevo, antes secuencial) | [src/lib/questions-batch-processor.ts:15](src/lib/questions-batch-processor.ts:15) |
| `maxDuration` | 900s (era 300s) | [src/app/api/questions/generate-batch/route.ts:8](src/app/api/questions/generate-batch/route.ts:8) |
| Semáforo Bedrock | OFF (modelo ≠ chat) | [src/lib/questions-generator.ts:19](src/lib/questions-generator.ts:19) |

Con esto se espera ~10-15s/doc procesando 3 en paralelo → ~60 docs en 3-5 min por invocación en lugar de los ~20-40 min anteriores.

### Cuándo desplegar este cambio

**Importante**: el deploy reinicia el contenedor de App Runner y mata cualquier `after()` en curso. Si hay un batch corriendo (revisar logs de CloudWatch), espera a que termine antes de hacer push.

```bash
# Ver si hay un batch activo en CloudWatch
aws logs tail /aws/apprunner/rag-master/<service-id>/application --since 5m \
  --filter-pattern "questions-batch" --follow
```

Si ves líneas `[questions-batch] ✅ ... [N/M]` recientes, espera al `Batch complete`. Si no ves nada, está libre.

### Después del deploy

Trigger el siguiente lote con:

```bash
curl -X POST https://fbrwkqtydz.us-east-1.awsapprunner.com/api/questions/generate-batch
```

Repetir hasta que `GET /api/questions/generate-batch` reporte `pendingCount: 0`.

### Rollback

Si la calidad de Sonnet no es suficiente, añadir a App Runner el env var:

```
BEDROCK_QUESTIONS_MODEL_ID=us.anthropic.claude-opus-4-6-v1
```

Eso reactiva Opus + el semáforo automáticamente (USES_SHARED_MODEL pasa a true porque coincide con `BEDROCK_CLAUDE_MODEL_ID`). Bajar también `CONCURRENCY` a 1 para Opus.

## Variables de Entorno Requeridas

Ver `.env` - requiere: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, DATABASE_URL, S3_BUCKET_NAME, BEDROCK_CLAUDE_MODEL_ID, BEDROCK_EMBEDDING_MODEL_ID, GITHUB_TOKEN
