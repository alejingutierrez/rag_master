/**
 * Lector server-side de los eventos minados del timeline.
 *
 * El artefacto `src/data/timeline-events.json` (generado por
 * scripts/mine-timeline-events.mts) ya trae, por período, el `yearHistogram`
 * (preguntas por año) y los `events` con su `evidencia` calibrada. Es TODO lo
 * que la línea de tiempo pública necesita → cero BD, cero llamadas a APIs
 * protegidas (las rutas `/api/timeline*` exigen auth). Se lee de disco una vez.
 */
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { TimelineEventData } from "@/components/timeline/TimelineEventDrawer";

export interface TimelinePeriodSlice {
  yearHistogram: Array<{ y: number; n: number; b: number }>;
  events: TimelineEventData[];
}

export interface TimelineFile {
  generatedAt: string;
  model: string;
  periods: Record<string, TimelinePeriodSlice>;
}

let cache: TimelineFile | null = null;

/** Carga (y cachea) el artefacto de eventos. Lanza si el archivo no existe. */
export async function loadTimeline(): Promise<TimelineFile> {
  if (!cache) {
    const raw = await readFile(
      join(process.cwd(), "src", "data", "timeline-events.json"),
      "utf8",
    );
    cache = JSON.parse(raw) as TimelineFile;
  }
  return cache;
}
