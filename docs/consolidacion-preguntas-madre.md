# Consolidación de Preguntas → Preguntas-Madre

**Autor:** Alejandro Gutiérrez
**Fecha:** 2026-06-05
**Estado:** v1.0 — CERRADO. Código construido. Capa-madre generada como **drafts locales** (read-only).
La **escritura a la RDS de producción está pendiente de aprobación explícita** (regla: prod = solo lectura).

> **Implementación (en repo):**
> - Esquema: `prisma/schema.prisma` (modelos `MasterQuestion`, `QuestionMasterLink`, `ConsolidationRun`).
> - Migración idempotente: `scripts/apply-migrations.js` (corre en deploy; **no aplicada manualmente**).
> - Lib canónica: `src/lib/master-consolidation.ts` (tipos, rúbrica, prompts, dial, persistencia).
> - Dump read-only: `scripts/consolidate-dump.mts` → `tmp/blocks/` + `manifest.json`.
> - Ejecución bulk (drafts): workflow `consolidacion-preguntas-madre` → `tmp/masters/*.json`.
> - Carga a BD (bloqueada): `scripts/consolidate-apply.mts` (requiere `CONSOLIDATE_APPLY=I_APPROVE`).

---

## 0. Resumen en una línea

Construir una **capa de "preguntas-madre"** por encima de las ~15k preguntas (y subiendo ~3–4k/día): cada madre sintetiza, **a través de varios libros**, las preguntas-hija que interrogan el mismo problema histórico — sosteniendo sus tesis en tensión. Pasas de operar sobre ~15k a operar sobre **~2.200** (≤300/período), sin borrar nada y de forma reversible.

---

## 1. Qué resuelve — y qué NO (atado a la data)

Lo medimos antes de diseñar:

- **No hay duplicados** (vecino más cercano intra-período: mediana ~0.40 coseno; <0.15 ≈ 0). → El problema **no es deduplicar**.
- **La redundancia es temática y cross-libro** (~12–18% con prima <0.30 en períodos calientes, ~100% en otro libro). → La unidad de consolidación es el **problema histórico compartido entre libros**, no la pregunta repetida.
- **`clusterTematico` es ciego ahí** (intra-libro, 74% singletons). → Necesitamos agrupación cross-libro nueva.
- **Las fronteras de subcategoría NO siguen la semántica** (vecino en *otra* subcat 0.41 < *misma* subcat 0.45). → El grano de consolidación es **período × categoría**, dejando que los clusters crucen subcategorías.

**Qué NO hace:** no llena vacíos historiográficos (organiza la cobertura que existe), no valida la calidad de las preguntas individuales (hoy 1 de ~15k respondida), no reemplaza el juicio del historiador (las madres se **curan**).

---

## 2. Principios de diseño (no negociables)

1. **No-destructivo.** Nunca se borra ni se muta `questions`. Tablas nuevas + mapeo. Toda madre es reversible (re-explota a sus hijas; `supersededById` deshace fusiones).
2. **Grano = período × categoría.** La subcategoría queda como metadato de la hija, no como muro. (Validado: §1.)
3. **Muchos-a-muchos.** Una hija puede colgar de ≥1 madre (una `isPrimary` para vistas/conteos por defecto).
4. **Dial, no número mágico.** Un parámetro `c` por (período) controla cuántas madres. Default "medio" (~2.200). Regla principista: *tantas madres como el material sostenga con ≥~4–5 hijas/madre, tope 300.*
5. **Compuerta anti-embotamiento.** Rúbrica de 5 tests (validada calibrada + a ciegas) como paso explícito; las "paraguas" se rechazan o se parten.
6. **Incremental.** Las preguntas nuevas se rutean a madres existentes o engendran nuevas; sin re-correr todo.
7. **Local + resumable.** Corre como `process-questions-loop` (local, apunta a la misma RDS), con `STOP_FILE` y reanudable (batería/sleep no lo deben corromper).

---

## 3. Esquema de datos

### 3.1 Prisma (`prisma/schema.prisma`)

```prisma
enum MasterStatus {
  DRAFT      // generada por el pipeline, sin curar
  REVIEW     // marcada para auditoría (borderline / gate 3-4)
  APPROVED   // curada — entra a navegación y producción
  REJECTED   // descartada (las hijas quedan libres / reasignables)
  MERGED     // fusionada en otra (ver supersededById)
}

model MasterQuestion {
  id                 String   @id @default(cuid())
  periodoCode        String
  periodoOrden       Int      @default(15)
  categoriaCode      String

  // Núcleo sintetizado
  pregunta           String   @db.Text   // la pregunta-madre contrastada
  problemaSubyacente String   @db.Text   // el problema histórico que agrupa a las hijas
  tesisEnTension     Json     @default("[]") // [{tesis, questionId, libro}] — el contraste
  tipoPregunta       String?
  escalaGeografica   String?

  // Compuerta (§5)
  gateScore          Int      @default(0)     // 0..5
  gateReasons        Json     @default("{}")  // {G1:bool, G2:bool, ... , razon:string}
  cohesion           Float?                   // dist. coseno media intra-cluster (prior de G5)

  // Estado y curación
  status             MasterStatus @default(DRAFT)
  reviewedBy         String?
  reviewedAt         DateTime?
  humanEdited        Boolean  @default(false)
  supersededById     String?                  // reversibilidad de fusiones

  // Denormalizado para UI sin joins
  childCount         Int      @default(0)
  bookCount          Int      @default(0)

  runId              String?                  // trazabilidad (ConsolidationRun)
  // embedding vector(1536) vive en BD vía SQL manual (pgvector); Prisma no lo soporta.

  links              QuestionMasterLink[]
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([periodoCode, categoriaCode])
  @@index([periodoOrden])
  @@index([status])
  @@map("master_questions")
}

model QuestionMasterLink {
  id          String   @id @default(cuid())
  questionId  String                        // FK lógica a questions.id (substrato congelado)
  question    Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  masterId    String
  master      MasterQuestion @relation(fields: [masterId], references: [id], onDelete: Cascade)
  isPrimary   Boolean  @default(false)      // 1 madre primaria por hija (vistas/conteos default)
  confidence  Float    @default(1)          // 1 - distancia de asignación
  rationale   String?  @db.Text             // por qué esta hija cuelga de esta madre
  createdAt   DateTime @default(now())

  @@unique([questionId, masterId])
  @@index([questionId])
  @@index([masterId, isPrimary])
  @@map("question_master_links")
}

model ConsolidationRun {
  id            String   @id @default(cuid())
  periodoCode   String
  categoriaCode String
  mode          String   @default("preview") // preview | full | incremental
  params        Json     // {grain:"categoria", c:1.15, tau_link:0.35, ...}
  stats         Json     @default("{}")      // {nIn, nMasters, nOrphans, gateFails, ...}
  createdAt     DateTime @default(now())

  @@index([periodoCode, categoriaCode])
  @@map("consolidation_runs")
}
```

> En `Question` se agrega solo la relación virtual `masterLinks QuestionMasterLink[]` — **no añade columna ni toca datos** de `questions` (la FK vive en `question_master_links`). El substrato sigue congelado.

### 3.2 SQL manual (`scripts/apply-migrations.js`, idempotente)

```sql
-- pgvector en master_questions (Prisma no soporta el tipo)
ALTER TABLE master_questions ADD COLUMN IF NOT EXISTS embedding vector(1536);
CREATE INDEX IF NOT EXISTS master_questions_embedding_hnsw
  ON master_questions USING hnsw (embedding vector_cosine_ops);
-- (opcional) FK dura del mapeo al substrato
-- ya cubierta por la relación Prisma; el índice por questionId lo crea Prisma.
```

---

## 4. El pipeline (por bloque `período × categoría`)

Corre **local**, resumable, idempotente. Un "bloque" = todas las preguntas de un (`periodoCode`, `categoriaCode`).

```
Fase 0  SCOPE        Lee (read-only) el bloque: hijas + embedding + metadatos.
Fase 1  CLUSTER      Agrupa por embedding (coseno), CRUZANDO subcategorías.
                     k objetivo ≈ masters(n, c) del dial. Salida: vecindarios + sueltos.
Fase 2  SÍNTESIS LLM Por vecindario, redacta la madre: pregunta + problemaSubyacente
                     + tesisEnTension (citando hijas/libros). Puede partir un grupo con
                     2 objetos o expulsar hijas que no encajan → huérfanas.
Fase 3  COMPUERTA    Puntúa cada madre (G1..G5, §5). <4/5 o G1=0 → re-partir o degradar.
Fase 4  DEDUP        Fusiona madres casi idénticas por similitud de embedding (ligero;
                     el grueso ya lo hizo Fase 1 al grano categoría).
Fase 5  PERSIST      Escribe MasterQuestion (status=DRAFT) + QuestionMasterLink (m:n,
                     marca isPrimary = mínima distancia). Calcula embedding de la madre.
Fase 6  AUDITORÍA    UI: aprobar / editar / rechazar / partir / fusionar.
                     Solo APPROVED entra a navegación y producción. Borderline primero.
```

- **Preview / dry-run** = Fases 0–3 **sin** persistir: devuelve conteos proyectados + muestra de madres. **Esto ES el dial con preview** — mueves `c`, ves el efecto, no escribe nada.
- **Huérfanas y singletons** son ciudadanos de primera clase: una madre de 1 hija es válida (pregunta que va sola). No se fuerzan.
- **QA gratis:** una hija que no encaja en ninguna madre de su bloque es huérfana *o está mal clasificada* (ej. detectamos una de "patronato regio" archivada en Prehispánico). El pipeline las lista.

---

## 5. La compuerta (rúbrica validada)

Cada madre pasa si **≥4/5 y G1=1**:

| | Test | Nítida | Paraguas |
|---|---|---|---|
| G1 | objeto vs postura | hijas comparten un **objeto** (ley, proceso, actor) | solo una postura/dominio |
| G2 | pregunta vs rótulo | tesis disputable | etiqueta ("el impacto de X") |
| G3 | contraste real | ≥2 tesis **rivales** | todas dicen lo mismo |
| G4 | acotada | se responde con las hijas | exige "toda la historia de X" |
| G5 | cohesión | hijas cercanas (embedding) | las une solo una etiqueta |

`cohesion` (dist. coseno media intra-cluster) se precomputa como **prior de G5** — barata, pero **no decide** (medimos que una madre nítida por tesis compartida puede estar dispersa). El LLM adjudica.

**Prompt (estructurado, devuelve JSON):**
```
Eres un evaluador historiográfico. Dada una pregunta-madre y sus preguntas-hija,
califica 0/1 cada test: G1 (objeto, no postura), G2 (pregunta, no rótulo),
G3 (≥2 tesis rivales entre las hijas), G4 (respondible con las hijas, no un tratado),
G5 (cohesión temática). Devuelve {G1,G2,G3,G4,G5, score, veredicto:"PASA|BORDERLINE|PARAGUAS", razon}.
Si PARAGUAS, propone cómo partirla en madres más nítidas.
```

---

## 6. Modo incremental (las ~3–4k/día)

Daemon local (patrón `process-questions-loop`), por bloque:

1. Para cada pregunta **nueva** (ya trae embedding del orderer): busca la madre **APPROVED** más cercana en su (período, categoría) por coseno.
2. `dist < τ_link` (≈0.35) → crea `QuestionMasterLink` (isPrimary si es la más cercana). Ruteo puro embedding, sin LLM.
3. Si ninguna madre dentro de τ → va a un **pool pendiente** del bloque.
4. Cuando el pool ≥ N (≈30) → corre Fases 1–5 sobre el pool (engendra madres DRAFT) → auditoría.

Así la capa-madre se mantiene viva sin re-correr todo. El ruteo es barato; la síntesis solo para lo realmente nuevo.

---

## 7. Reversibilidad y seguridad

- `questions` **no se muta** (solo relación virtual). Re-explotar una madre = leer sus links.
- `status` controla visibilidad; rechazar/fusionar **nunca borra hijas**.
- `supersededById` deshace fusiones.
- **Producción = solo lectura.** La migración (§3.2) se aplica vía el workflow establecido (`apply-migrations.js` en `StartCommand`) y **solo con aprobación explícita**.
- Todo cambio destructivo (cambiar el default de vista a madres) es el **último** paso y reversible.

---

## 8. Producción vía El Taller

Una madre **APPROVED** es la unidad de producción en masa:

1. Reúne los chunks fuente de **todas** sus hijas (vía `documentId` de cada hija → sus chunks).
2. Llama `runRagPipeline` (el único retrieval bueno) con `pregunta` + `tesisEnTension` como brief.
3. El Taller (6 fases) produce el entregable, **obligado a sostener el contraste** entre las tesis rivales.

Resultado: respondes ~200 grandes preguntas contrastadas por período en vez de miles delgadas — y cada respuesta sintetiza decenas de libros.

---

## 9. Costos / operación

- **Pase inicial:** ~2.200 síntesis (Fase 2) + ~2.200 compuerta (Fase 3) — una vez, por lotes, local y resumable.
- **Incremental:** ruteo = embedding (gratis); síntesis solo para pools pendientes.
- Corre local apuntando a la RDS compartida (como el loop de preguntas). `STOP_FILE` + reanudable; en batería/sleep no debe corromper estado (escribe por bloque, transaccional).

---

## 10. Plan de construcción por fases

| v | Entrega | Escribe en prod? |
|---|---|---|
| **v0** | Migración (tablas + pgvector) **+ preview/dry-run** (Fases 0–3) sobre 1 bloque | Solo tablas vacías (con aprobación). Dry-run = read-only |
| **v1** | Persistir DRAFT + UI mínima de auditoría para **1 período** | Sí (master_questions / links) |
| **v2** | Roll en todos los períodos a "medio" (~2.200) | Sí |
| **v3** | Daemon incremental + integración El Taller | Sí |

El default de navegación/producción **no** cambia a madres hasta que v2 esté curado.

---

## Apéndice — Parámetros

- **Dial `c`** (madres ≈ `n / (1 + c·ln n)` por bloque, tope 300/período):
  `c=1.5` compacto (~1.799) · **`c=1.15` medio (~2.203, default)** · `c=0.85` rico (~2.655).
  Ajustable por período (gentil donde la síntesis es fuerte; más firme donde caería bajo ~4 hijas/madre).
- **τ_link** (ruteo incremental): ≈0.35 coseno.
- **Gate**: PASA ≥4/5 ∧ G1=1; BORDERLINE 3/5 (a revisión); PARAGUAS <3/5 o G1=0 (re-partir).
- **Pool pendiente** (incremental): ≈30 antes de sintetizar.

> Harness de validación ya existente (read-only, reutilizable como base del preview):
> `tmp/q-stats.mts`, `q-dup-probe.mts`, `q-crosssub.mts`, `q-cohesion.mts`, `q-dial.mts`, `q-project*.mts`.
