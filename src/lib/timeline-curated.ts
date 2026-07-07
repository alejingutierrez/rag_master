/**
 * Capa de hechos CURADOS del timeline, mezclada en tiempo de lectura.
 *
 * Los eventos minados (src/data/timeline-events.json) los reescribe entero
 * scripts/mine-timeline-events.mts, así que los hechos curados viven en un
 * artefacto aparte (src/data/timeline-events-curated.json, generado por
 * scripts/build-curated-timeline.mts) y se inyectan aquí. Así SOBREVIVEN a un
 * `FORCE=1` del minado y aparecen en las dos superficies (pública y admin).
 */
import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TimelineEventData } from "@/components/timeline/TimelineEventDrawer";

interface CuratedFile {
  periods: Record<string, TimelineEventData[]>;
}

let cache: CuratedFile | null = null;
let loaded = false;

function loadCurated(): CuratedFile | null {
  if (loaded) return cache;
  loaded = true;
  try {
    const raw = readFileSync(
      join(process.cwd(), "src", "data", "timeline-events-curated.json"),
      "utf8",
    );
    cache = JSON.parse(raw) as CuratedFile;
  } catch {
    cache = null; // sin capa curada → no-op
  }
  return cache;
}

/**
 * Inyecta los hechos curados en cada período y reordena cronológicamente.
 * Muta `periods` in situ. Idempotente: no duplica si ya se inyectaron (por id).
 */
export function mergeCuratedEvents(
  periods: Record<string, { events: TimelineEventData[] }>,
): void {
  const curated = loadCurated();
  if (!curated) return;
  for (const [code, events] of Object.entries(curated.periods)) {
    const slice = periods[code];
    if (!slice || !Array.isArray(slice.events)) continue;
    const have = new Set(slice.events.map((e) => e.id));
    for (const ev of events) if (!have.has(ev.id)) slice.events.push(ev);
    slice.events.sort((a, b) => a.anioInicio - b.anioInicio);
  }
}
