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
import { prisma } from "./prisma";
import { slugify } from "./typology-schemas";

/**
 * Top-N entidades canónicas del corpus (el mismo registro que alimenta las
 * páginas públicas): las más mencionadas en las preguntas, por tipo. Se le pasan
 * al clasificador para que el LLM REUSE nombres existentes (relación 1-a-1) en
 * vez de inventar variantes. No caben miles en el prompt → solo las prominentes.
 */
async function loadTopCanonicalEntities(
  perType = 120,
): Promise<{ personas: string[]; lugares: string[]; conceptos: string[] }> {
  const questions = await prisma.question.findMany({
    select: { entidadesPersonas: true, entidadesLugares: true, entidadesConceptos: true },
  });
  const top = (pick: (q: (typeof questions)[number]) => string[]): string[] => {
    const m = new Map<string, { variants: Map<string, number>; count: number }>();
    for (const q of questions) {
      const seen = new Set<string>();
      for (const raw of pick(q)) {
        const name = raw.trim();
        if (!name) continue;
        const slug = slugify(name);
        if (!slug) continue;
        let e = m.get(slug);
        if (!e) {
          e = { variants: new Map(), count: 0 };
          m.set(slug, e);
        }
        e.variants.set(name, (e.variants.get(name) ?? 0) + 1);
        if (!seen.has(slug)) {
          e.count++;
          seen.add(slug);
        }
      }
    }
    return [...m.values()]
      .filter((e) => e.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, perType)
      .map((e) => {
        let best = "";
        let n = -1;
        for (const [v, c] of e.variants) if (c > n) { best = v; n = c; }
        return best;
      });
  };
  return {
    personas: top((q) => q.entidadesPersonas),
    lugares: top((q) => q.entidadesLugares),
    conceptos: top((q) => q.entidadesConceptos),
  };
}

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
- entidades: las personas, lugares y conceptos más relevantes de la pieza. Si una coincide con el REGISTRO que se te da abajo, usa EXACTAMENTE ese nombre (misma grafía); solo acuña un nombre nuevo si de verdad no está en el registro. No dupliques variantes de un mismo nombre.
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

  // Registro canónico (top del corpus) → el LLM reusa nombres existentes (B).
  let registryTxt = "";
  try {
    const reg = await loadTopCanonicalEntities();
    registryTxt = `\n\nREGISTRO DE ENTIDADES YA EXISTENTES (reusa el nombre EXACTO si la entidad de la pieza es una de estas):\nPersonas: ${reg.personas.join(", ")}\nLugares: ${reg.lugares.join(", ")}\nConceptos: ${reg.conceptos.join(", ")}`;
  } catch (e) {
    console.warn(`[classify] no se pudo cargar el registro de entidades: ${(e as Error).message}`);
  }

  const user = `${args.intent ? `ENCARGO: ${args.intent}\n\n` : ""}PIEZA (extracto):\n${extracto}${hint}${registryTxt}\n\nJSON:`;

  const raw = await callClaudeJson<Record<string, unknown>>({
    model: SONNET_MODEL,
    system: CLASSIFY_SYSTEM,
    user,
    maxTokens: 1500,
    validate: (p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}),
  });

  return normalizeTaxonomy(raw);
}
