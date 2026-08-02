import { notFound } from "next/navigation";
import { HechoDetail } from "@/components/public/hechos/hecho-detail";
import { JsonLd } from "@/components/public/json-ld";
import {
  getTypologyDetail,
  getTypologyList,
  getEntityLinker,
  resolveEntityChips,
  type MapPoint,
} from "@/lib/public-data";
import { buildMetadata, detailJsonLd } from "@/lib/seo";
import { typologyPath } from "@/lib/typology-schemas";
import { TrackView } from "@/components/analytics/track-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getTypologyDetail("hecho", slug);
  if (!d) return { title: "Hecho" };
  return buildMetadata({
    seo: d.seo,
    path: typologyPath(d.structured),
    imageUrl: d.imageUrl,
    publishedTime: d.publishedAt,
    modifiedTime: d.updatedAt,
    type: "article",
  });
}

export default async function HechoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [detail, facts, periods, linker] = await Promise.all([
    getTypologyDetail("hecho", slug),
    getTypologyList("hecho", 1000),
    getTypologyList("epoca", 100),
    getEntityLinker(),
  ]);
  if (!detail) notFound();
  const s = detail.structured;
  if (s.typology !== "hecho") notFound();

  const current = facts.find((fact) => fact.id === detail.id) ?? null;
  const periodFacts = facts.filter((fact) => fact.periodCode === s.periodoCode);
  const currentIndex = periodFacts.findIndex((fact) => fact.id === detail.id);
  const previous = currentIndex > 0 ? periodFacts[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < periodFacts.length - 1
    ? periodFacts[currentIndex + 1]
    : null;
  const timelineStart = Math.max(0, Math.min(currentIndex - 2, periodFacts.length - 5));
  const timelineFacts = periodFacts.slice(timelineStart, timelineStart + 5);
  const periodCard = periods.find((period) => period.periodCode === s.periodoCode) ?? null;

  // El gate canónico decide qué nombres pueden enlazarse. Los demás siguen
  // visibles como texto, sin crear rutas públicas vacías.
  const [protagonistas, lugares, ideas] = await Promise.all([
    resolveEntityChips(s.protagonistas, "persona"),
    resolveEntityChips(s.lugares, "lugar"),
    resolveEntityChips(current?.entidades.ideas ?? [], "idea"),
  ]);
  const mapPoint: MapPoint | null =
    s.lat != null && s.lng != null
      ? {
          id: detail.id,
          href: current?.href ?? `/hechos/${s.slug}`,
          titulo: s.titulo,
          resumen: s.resumen,
          kind: "hecho",
          label: "Hecho",
          lat: s.lat,
          lng: s.lng,
          lugar: s.lugarPrincipal,
          periodCode: s.periodoCode,
          periodoOrden: current?.periodoOrden ?? 99,
          anio: s.anioInicio,
          yearLabel: s.fecha,
          imageUrl: detail.imageUrl,
        }
      : null;
  return (
    <>
      <JsonLd data={detailJsonLd(detail)} />
      <TrackView
        contentType={detail.structured.typology}
        itemId={detail.structured.slug}
        itemName={detail.structured.titulo}
      />
      <HechoDetail
        detail={detail}
        linker={linker}
        entities={{ protagonistas, lugares, ideas }}
        periodCard={periodCard}
        periodFacts={timelineFacts}
        previous={previous}
        next={next}
        mapPoint={mapPoint}
      />
    </>
  );
}
