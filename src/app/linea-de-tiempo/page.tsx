import { PublicShell } from "@/components/public/public-shell";
import { ComingSoon } from "@/components/public/coming-soon";
import { PublicTimeline } from "@/components/timeline/PublicTimeline";
import { loadTimeline, type TimelineFile } from "@/lib/timeline-data";
import { getTimelineLinks, type TimelineLinks } from "@/lib/public-data";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Línea de tiempo",
    metaDescription:
      "Cinco siglos de historia de Colombia en una línea de tiempo calibrada por relevancia: los momentos que el corpus más interroga pesan más.",
    keywords: ["línea de tiempo", "cronología", "historia de Colombia", "períodos"],
  },
  path: "/linea-de-tiempo",
  type: "website",
});

export default async function LineaDeTiempoPage({
  searchParams,
}: {
  searchParams?: Promise<{ p?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const initial = sp.p && sp.p in PERIODS ? (sp.p as PeriodCode) : "REG";

  let timeline: TimelineFile | null = null;
  let links: TimelineLinks = {};
  try {
    [timeline, links] = await Promise.all([loadTimeline(), getTimelineLinks()]);
  } catch (err) {
    console.error("[linea-de-tiempo] no se pudo cargar el timeline:", err);
  }

  if (!timeline) {
    return (
      <ComingSoon
        label="Línea de tiempo"
        title="Cinco siglos, pronto"
        note="La línea de tiempo está temporalmente fuera de servicio. Vuelve pronto."
      />
    );
  }

  return (
    <PublicShell>
      <PublicTimeline timeline={timeline} links={links} initialPeriod={initial} />
    </PublicShell>
  );
}
