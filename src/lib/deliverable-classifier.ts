/**
 * Clasificador de entregables: construye la metadata analítica (período,
 * categoría, subcategoría, años, entidades, tipo, escala) de una pieza ya escrita
 * cuando NO hereda de una pregunta. Una llamada Sonnet + normalización pura.
 * Reusa la taxonomía y los enums compartidos.
 */
import { callClaudeJson, SONNET_MODEL } from "./atelier/bedrock-json";
import {
  PERIOD_OPTIONS,
  CATEGORY_OPTIONS,
  normalizeTaxonomy,
  type DeliverableTaxonomy,
} from "./taxonomy";
import { TIPOS_PREGUNTA, ESCALAS_GEOGRAFICAS } from "./questions-config";

const PERIODOS_TXT = PERIOD_OPTIONS.map((p) => `${p.code} = ${p.nombre} (${p.rango})`).join("\n");
const CATEGORIAS_TXT = CATEGORY_OPTIONS.map((c) => `${c.code} = ${c.nombre}`).join("\n");

const CLASSIFY_SYSTEM = `Eres un archivista que clasifica una pieza de historia de Colombia y América Latina dentro de una taxonomía. Lees la pieza y devuelves su metadata analítica.

PERÍODOS — elige el código de la ÉPOCA EN QUE OCURREN los hechos narrados (no cuándo se escribió):
${PERIODOS_TXT}

CATEGORÍAS:
${CATEGORIAS_TXT}

tipoPregunta ∈ {${TIPOS_PREGUNTA.join(", ")}}
escalaGeografica ∈ {${ESCALAS_GEOGRAFICAS.join(", ")}}

Devuelve JSON puro (sin markdown):
{
  "periodoCode": "REG",
  "categoriaCode": "POL",
  "subcategoriaCode": "POL.FOR",
  "subcategoriaNombre": "Formación del Estado",
  "yearPrincipal": 1925,
  "yearsSecondary": [1886, 1930],
  "periodosRelacionados": ["EUC"],
  "entidades": { "personas": ["..."], "lugares": ["..."], "conceptos": ["..."] },
  "tipoPregunta": "causal",
  "clusterTematico": "frase de 5-8 palabras que agrupa el tema",
  "escalaGeografica": "nacional"
}

Reglas:
- periodoCode y categoriaCode deben ser de las listas. Si los hechos abarcan 3+ períodos, usa "TRANS".
- yearPrincipal: el año central de los hechos (entero). yearsSecondary: otros hitos.
- subcategoriaCode: un código "CATEGORIA.XXX" coherente con la categoría (puedes acuñarlo).
- entidades: las personas, lugares y conceptos más relevantes de la pieza (no inventes).
- NO escribas nada fuera del JSON.`;

export async function classifyDeliverable(args: {
  texto: string;
  intent?: string;
  entitiesHint?: {
    personas?: string[];
    lugares?: string[];
    conceptos?: string[];
    temporalidad?: string;
  };
}): Promise<DeliverableTaxonomy> {
  const extracto = args.texto.slice(0, 4000);
  const h = args.entitiesHint;
  const hint = h
    ? `\n\nPISTAS DEL ENCUADRE — personas: ${(h.personas ?? []).join(", ")} · lugares: ${(h.lugares ?? []).join(", ")} · temporalidad: ${h.temporalidad ?? ""}`
    : "";
  const user = `${args.intent ? `ENCARGO: ${args.intent}\n\n` : ""}PIEZA (extracto):\n${extracto}${hint}\n\nJSON:`;

  const raw = await callClaudeJson<Record<string, unknown>>({
    model: SONNET_MODEL,
    system: CLASSIFY_SYSTEM,
    user,
    maxTokens: 1500,
    validate: (p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}),
  });

  return normalizeTaxonomy(raw);
}
