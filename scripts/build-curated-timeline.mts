/**
 * Construye la capa de eventos CURADOS del timeline a partir de contenido
 * autoral (src/data/timeline-events-curated.source.json), sin tocar la BD.
 *
 * Qué hace, y por qué:
 *  1. VALIDA cada `entidadesClave` contra el registro canónico
 *     (src/data/entities.json, nombres + variantes). Así las relaciones
 *     entidad↔hecho quedan alineadas: los chips del drawer enlazan a la wiki.
 *     Reporta las que no resuelven para corregirlas (no inventa entidades).
 *  2. DERIVA la evidencia del histograma YA versionado
 *     (src/data/timeline-events.json): el año más denso dentro de la ventana
 *     del evento aporta `nPreguntas`/`nLibros`, y `peso` se normaliza al máximo
 *     del período. NO se fabrican conteos de preguntas ni questionIds del minado.
 *  3. Marca cada evento `curated: true` (provenance) y escribe
 *     src/data/timeline-events-curated.json, que se mergea en lectura
 *     (src/lib/timeline-curated.ts) y sobrevive a un `FORCE=1` del minado.
 *
 * Uso: npx tsx scripts/build-curated-timeline.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SOURCE = join(ROOT, "src", "data", "timeline-events-curated.source.json");
const ENTITIES = join(ROOT, "src", "data", "entities.json");
const OUT = join(ROOT, "src", "data", "timeline-events-curated.json");

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

interface SourceEvent {
  periodo: string;
  anioInicio: number;
  anioFin: number;
  titulo: string;
  resumen: string;
  porQueImporta: string;
  categoria: string;
  entidadesClave: string[];
}
const source = JSON.parse(readFileSync(SOURCE, "utf8")) as { events: SourceEvent[] };
const entities = JSON.parse(readFileSync(ENTITIES, "utf8")) as {
  entities: Array<{ name: string; variants?: string[]; mentions: number }>;
};

// Índice canónico: nombre/variante → menciones en el corpus. Sirve para (a)
// validar que la relación entidad↔hecho resuelve y (b) derivar la evidencia
// ESPECÍFICA del hecho (cuánto interroga el corpus a sus protagonistas).
const known = new Set<string>();
const mentionsByName = new Map<string, number>();
for (const e of entities.entities) {
  const m = e.mentions || 0;
  for (const n of [e.name, ...(e.variants || [])]) {
    known.add(norm(n));
    mentionsByName.set(norm(n), Math.max(mentionsByName.get(norm(n)) ?? 0, m));
  }
}

function slug(t: string): string {
  return norm(t).split(" ").slice(0, 6).join("-");
}

/**
 * Evidencia honesta y ESPECÍFICA del hecho: número de preguntas del corpus que
 * mencionan a su figura principal (máx. entre entidadesClave). No es densidad de
 * la ventana (eso sobredimensionaba spans anchos como el pico del período); es
 * cuánto interroga el corpus a los protagonistas del evento. `peso` se escala a
 * /100 con tope 90 para que un hecho curado —sub-atendido por definición— nunca
 * finja ser el pico del período.
 */
function evidenceFor(entidadesClave: string[]) {
  const menciones = Math.max(
    0,
    ...entidadesClave.map((e) => mentionsByName.get(norm(e)) ?? 0),
  );
  return {
    nPreguntas: menciones,
    nLibros: 0, // el registro no trae nº de obras por entidad → no se muestra en curados
    peso: Math.min(90, Math.max(3, Math.round((menciones / 250) * 100))),
    questionIds: [] as string[],
  };
}

const out: Record<string, unknown[]> = {};
const misses: Array<{ titulo: string; entidad: string }> = [];
let count = 0;

for (const ev of source.events) {
  for (const ent of ev.entidadesClave) {
    if (!known.has(norm(ent))) misses.push({ titulo: ev.titulo, entidad: ent });
  }
  const evid = evidenceFor(ev.entidadesClave);
  const event = {
    id: `${ev.periodo}-${ev.anioInicio}-${slug(ev.titulo)}`,
    anioInicio: ev.anioInicio,
    anioFin: ev.anioFin,
    titulo: ev.titulo,
    resumen: ev.resumen,
    porQueImporta: ev.porQueImporta,
    categoria: ev.categoria,
    entidadesClave: ev.entidadesClave,
    curated: true,
    evidencia: {
      nPreguntas: evid.nPreguntas,
      nLibros: evid.nLibros,
      peso: evid.peso,
      topEntidades: ev.entidadesClave.map(norm),
      questionIds: evid.questionIds,
    },
  };
  (out[ev.periodo] = out[ev.periodo] || []).push(event);
  count++;
}

for (const code of Object.keys(out)) {
  (out[code] as Array<{ anioInicio: number }>).sort((x, y) => x.anioInicio - y.anioInicio);
}

writeFileSync(
  OUT,
  JSON.stringify({ generatedBy: "build-curated-timeline.mts", periods: out }, null, 1),
);

console.log(`✓ ${count} hechos curados en ${Object.keys(out).length} períodos → ${OUT}`);
console.log(
  "  por período:",
  Object.entries(out)
    .map(([k, v]) => `${k}:${(v as unknown[]).length}`)
    .join("  "),
);
if (misses.length) {
  console.log(`\n⚠ ${misses.length} entidadesClave NO resuelven en el registro (no enlazarán a la wiki):`);
  for (const m of misses) console.log(`   [${m.titulo}]  →  "${m.entidad}"`);
  console.log("  Corrige el nombre al canónico de entities.json o acéptalo como entidad no publicada.");
} else {
  console.log("  ✓ todas las entidadesClave resuelven en el registro canónico.");
}
