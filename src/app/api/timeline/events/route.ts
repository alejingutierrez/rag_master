import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { mergeCuratedEvents } from "@/lib/timeline-curated";
import type { TimelineEventData } from "@/components/timeline/TimelineEventDrawer";

// Eventos minados del corpus (scripts/mine-timeline-events.mts).
// Artefacto versionado en el repo — no requiere BD. Se lee de disco (no import
// estático) para que el bundle del cliente no cargue los 15 períodos completos.
// force-dynamic: con force-static Next cachearía una sola respuesta ignorando
// el query string ?periodo=.

export const dynamic = "force-dynamic";

interface TimelineEventsFile {
  generatedAt: string;
  model: string;
  periods: Record<string, unknown>;
}

let cache: TimelineEventsFile | null = null;

export async function GET(request: NextRequest) {
  if (!cache) {
    try {
      const raw = await readFile(
        join(process.cwd(), "src", "data", "timeline-events.json"),
        "utf8"
      );
      cache = JSON.parse(raw) as TimelineEventsFile;
      mergeCuratedEvents(
        cache.periods as Record<string, { events: TimelineEventData[] }>,
      );
    } catch {
      return NextResponse.json(
        { error: "Eventos no generados aún. Corre scripts/mine-timeline-events.mts" },
        { status: 404 }
      );
    }
  }

  const periodo = request.nextUrl.searchParams.get("periodo");
  if (periodo) {
    const slice = cache.periods[periodo];
    if (!slice) {
      return NextResponse.json({ error: `Período desconocido: ${periodo}` }, { status: 404 });
    }
    return NextResponse.json({
      generatedAt: cache.generatedAt,
      periodo,
      ...(slice as object),
    });
  }

  return NextResponse.json(cache);
}
