import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsConfig } from "./aws-config";
import { PERIOD_CODES, CATEGORY_CODES } from "./taxonomy";
import type { EnrichmentMetadata } from "./enrichment-types";

const bedrock = new BedrockRuntimeClient(awsConfig);

const CLAUDE_MODEL =
  process.env.BEDROCK_CLAUDE_MODEL_ID ||
  "us.anthropic.claude-opus-4-6-20250610-v1:0";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ChunkForEnrichment {
  content: string;
  pageNumber: number;
  chunkIndex: number;
}

// ─── Prompt del sistema ──────────────────────────────────────────────────────

const ENRICHMENT_SYSTEM_PROMPT = `Eres un analista bibliográfico experto. Tu tarea es extraer metadata estructurada de fragmentos de un libro o documento académico.

## INSTRUCCIONES

1. Analiza los fragmentos proporcionados (generalmente del inicio del libro: portada, página de créditos, índice, introducción).
2. Extrae la mayor cantidad de información bibliográfica posible.
3. Si un campo NO puede determinarse con certeza a partir del texto, devuélvelo como null. NO inventes datos.
4. El resumen debe ser de aproximadamente 100 palabras, capturando la tesis central y el alcance del documento.
5. Para los períodos históricos, identifica el período principal que abarca el documento y opcionalmente un período secundario.
6. Para las categorías, identifica la categoría principal del documento y opcionalmente una secundaria.

## CAMPOS A EXTRAER

- **bookTitle**: Título completo del libro o documento (sin subtítulos editoriales)
- **author**: Autor(es) principal(es), separados por coma si son varios
- **isbn**: Código ISBN si aparece en la página de créditos
- **pageCount**: Número total de páginas si se menciona
- **summary**: Resumen en ~100 palabras del contenido y tesis central
- **primaryPeriod**: Código del período histórico principal (ver taxonomía)
- **secondaryPeriod**: Código del período histórico secundario (puede ser null)
- **primaryCategory**: Código de la categoría principal (ver taxonomía)
- **secondaryCategory**: Código de la categoría secundaria (puede ser null)
- **publisher**: Editorial o casa publicadora
- **publicationYear**: Año de publicación (número entero)
- **edition**: Edición (ej: "Primera edición", "2a edición revisada")
- **keywords**: Array de 5-10 palabras clave temáticas relevantes

## TAXONOMÍA DE PERÍODOS HISTÓRICOS (códigos válidos)

- PRE — Período Prehispánico (antes de 1499)
- CON — Conquista y Colonia Temprana (1499–1599)
- COL — Colonia Madura (1600–1780)
- PRE_IND — Crisis Colonial y Pre-Independencia (1780–1809)
- IND — Independencia y Gran Colombia (1810–1831)
- NGR — Nueva Granada y Reformas Liberales (1831–1862)
- EUC — Estados Unidos de Colombia y Radicalismo (1863–1885)
- REG — Regeneración y Hegemonía Conservadora (1886–1929)
- REP_LIB — República Liberal (1930–1946)
- VIO — La Violencia y Dictadura (1946–1957)
- FN — Frente Nacional (1958–1974)
- CNA — Crisis, Narcotráfico y Apertura (1974–1990)
- C91 — Constitución del 91 y Escalamiento del Conflicto (1991–2002)
- SDE — Seguridad Democrática y Proceso de Paz (2002–2016)
- POS — Posconflicto y Colombia Contemporánea (2016–presente)
- TRANS — Transversal / Larga Duración (abarca 3+ períodos)

## TAXONOMÍA DE CATEGORÍAS (códigos válidos)

- POL — Política y Estado
- ECO — Economía y Desarrollo
- CON — Conflicto Armado y Violencia
- SOC — Sociedad y Estructura Social
- CUL — Cultura, Ideología y Producción Intelectual
- REL — Relaciones Internacionales y Geopolítica
- TER — Territorio, Región y Medio Ambiente
- MOV — Movimientos Sociales y Acción Colectiva
- INS — Instituciones, Derecho y Justicia
- HIS — Historiografía y Metodología Histórica`;

// ─── Selección de chunks iniciales ───────────────────────────────────────────

const MAX_CHARS_PER_CHUNK = 1500;
const MAX_TOTAL_CHARS = 50_000;
const MAX_CHUNKS = 30;

function selectFirstChunks(chunks: ChunkForEnrichment[]): ChunkForEnrichment[] {
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  return sorted.slice(0, MAX_CHUNKS);
}

// ─── Tool use schema ─────────────────────────────────────────────────────────

const ENRICH_TOOL_NAME = "extract_book_metadata";

const ENRICH_TOOL_SPEC = {
  name: ENRICH_TOOL_NAME,
  description:
    "Extrae metadata bibliográfica estructurada de un libro o documento académico, incluyendo título, autor, ISBN, resumen, clasificación por período histórico y categoría temática.",
  inputSchema: {
    json: {
      type: "object",
      properties: {
        bookTitle: {
          type: ["string", "null"],
          description: "Título completo del libro",
        },
        author: {
          type: ["string", "null"],
          description: "Autor(es) del libro",
        },
        isbn: {
          type: ["string", "null"],
          description: "Código ISBN",
        },
        pageCount: {
          type: ["integer", "null"],
          description: "Número total de páginas",
        },
        summary: {
          type: ["string", "null"],
          description: "Resumen del contenido en ~100 palabras",
        },
        primaryPeriod: {
          type: ["string", "null"],
          description: "Código del período histórico principal",
          enum: [...PERIOD_CODES, null],
        },
        secondaryPeriod: {
          type: ["string", "null"],
          description: "Código del período histórico secundario",
          enum: [...PERIOD_CODES, null],
        },
        primaryCategory: {
          type: ["string", "null"],
          description: "Código de la categoría principal",
          enum: [...CATEGORY_CODES, null],
        },
        secondaryCategory: {
          type: ["string", "null"],
          description: "Código de la categoría secundaria",
          enum: [...CATEGORY_CODES, null],
        },
        publisher: {
          type: ["string", "null"],
          description: "Editorial o casa publicadora",
        },
        publicationYear: {
          type: ["integer", "null"],
          description: "Año de publicación",
        },
        edition: {
          type: ["string", "null"],
          description: "Edición del libro",
        },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Palabras clave temáticas (5-10)",
        },
      },
      required: [
        "bookTitle",
        "author",
        "isbn",
        "pageCount",
        "summary",
        "primaryPeriod",
        "secondaryPeriod",
        "primaryCategory",
        "secondaryCategory",
        "publisher",
        "publicationYear",
        "edition",
        "keywords",
      ],
    },
  },
};

// ─── Normalización ───────────────────────────────────────────────────────────

function normalizeEnrichment(raw: Record<string, unknown>): EnrichmentMetadata {
  const result: EnrichmentMetadata = {};

  if (raw.bookTitle && typeof raw.bookTitle === "string") {
    result.bookTitle = raw.bookTitle.trim();
  }
  if (raw.author && typeof raw.author === "string") {
    result.author = raw.author.trim();
  }
  if (raw.isbn && typeof raw.isbn === "string") {
    result.isbn = raw.isbn.trim();
  }
  if (raw.pageCount && typeof raw.pageCount === "number") {
    result.pageCount = raw.pageCount;
  }
  if (raw.summary && typeof raw.summary === "string") {
    result.summary = raw.summary.trim();
  }
  if (raw.primaryPeriod && typeof raw.primaryPeriod === "string" && PERIOD_CODES.includes(raw.primaryPeriod)) {
    result.primaryPeriod = raw.primaryPeriod;
  }
  if (raw.secondaryPeriod && typeof raw.secondaryPeriod === "string" && PERIOD_CODES.includes(raw.secondaryPeriod)) {
    result.secondaryPeriod = raw.secondaryPeriod;
  }
  if (raw.primaryCategory && typeof raw.primaryCategory === "string" && CATEGORY_CODES.includes(raw.primaryCategory)) {
    result.primaryCategory = raw.primaryCategory;
  }
  if (raw.secondaryCategory && typeof raw.secondaryCategory === "string" && CATEGORY_CODES.includes(raw.secondaryCategory)) {
    result.secondaryCategory = raw.secondaryCategory;
  }
  if (raw.publisher && typeof raw.publisher === "string") {
    result.publisher = raw.publisher.trim();
  }
  if (raw.publicationYear && typeof raw.publicationYear === "number") {
    result.publicationYear = raw.publicationYear;
  }
  if (raw.edition && typeof raw.edition === "string") {
    result.edition = raw.edition.trim();
  }
  if (Array.isArray(raw.keywords)) {
    result.keywords = raw.keywords
      .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
      .map((k) => k.trim());
  }

  return result;
}

// ─── Función principal ───────────────────────────────────────────────────────

export async function enrichDocument(
  chunks: ChunkForEnrichment[],
  filename: string
): Promise<EnrichmentMetadata> {
  const selected = selectFirstChunks(chunks);

  // Construir contexto con límite de chars
  let totalChars = 0;
  const parts: string[] = [];

  for (const chunk of selected) {
    const content =
      chunk.content.length > MAX_CHARS_PER_CHUNK
        ? chunk.content.slice(0, MAX_CHARS_PER_CHUNK) + "..."
        : chunk.content;
    const part = `--- Fragmento (pág. ${chunk.pageNumber}, chunk #${chunk.chunkIndex}) ---\n${content}`;

    if (totalChars + part.length > MAX_TOTAL_CHARS) break;
    parts.push(part);
    totalChars += part.length;
  }

  const context = parts.join("\n\n");

  const userMessage = `Analiza los siguientes fragmentos del inicio del documento "${filename}" y extrae toda la metadata bibliográfica que puedas identificar. Si un campo no puede determinarse, devuélvelo como null.

${context}`;

  const command = new ConverseCommand({
    modelId: CLAUDE_MODEL,
    system: [{ text: ENRICHMENT_SYSTEM_PROMPT }],
    messages: [
      {
        role: "user",
        content: [{ text: userMessage }],
      },
    ],
    toolConfig: {
      tools: [{ toolSpec: ENRICH_TOOL_SPEC }],
      toolChoice: { tool: { name: ENRICH_TOOL_NAME } },
    },
    inferenceConfig: {
      maxTokens: 4000,
      temperature: 0.3,
    },
  });

  const response = await bedrock.send(command);

  const toolUseBlock = response.output?.message?.content?.find(
    (block) => block.toolUse?.name === ENRICH_TOOL_NAME
  );

  if (!toolUseBlock?.toolUse?.input) {
    throw new Error("Claude no retornó el tool use con la metadata");
  }

  const input = toolUseBlock.toolUse.input as Record<string, unknown>;
  return normalizeEnrichment(input);
}
