import { notFound } from "next/navigation";
import { EpochArticle } from "@/components/public/epocas/epoch-article";
import { JsonLd } from "@/components/public/json-ld";
import {
  getEpochExplorerPage,
  getTypologyDetail,
  getEntityLinker,
  resolveEntityChips,
} from "@/lib/public-data";
import { HISTORICAL_PERIODS, type PeriodCode } from "@/lib/design-tokens";
import { buildMetadata, detailJsonLd } from "@/lib/seo";
import { typologyPath } from "@/lib/typology-schemas";
import { TrackView } from "@/components/analytics/track-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getTypologyDetail("epoca", slug);
  if (!d) return { title: "Época" };
  return buildMetadata({
    seo: d.seo,
    path: typologyPath(d.structured),
    imageUrl: d.imageUrl,
    publishedTime: d.publishedAt,
    modifiedTime: d.updatedAt,
    type: "article",
  });
}

export default async function EpocaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await getTypologyDetail("epoca", slug);
  if (!detail) notFound();
  const s = detail.structured;
  if (s.typology !== "epoca") notFound();
  const periodCode = s.periodoCode && HISTORICAL_PERIODS.includes(s.periodoCode as PeriodCode)
    ? (s.periodoCode as PeriodCode)
    : null;
  if (!periodCode) notFound();

  const [data, linker, actores] = await Promise.all([
    getEpochExplorerPage(periodCode),
    getEntityLinker(),
    resolveEntityChips(s.actores, "persona"),
  ]);
  return (
    <>
      <JsonLd data={detailJsonLd(detail)} />
      <TrackView
        contentType={detail.structured.typology}
        itemId={detail.structured.slug}
        itemName={detail.structured.titulo}
      />
      <EpochArticle
        detail={detail}
        data={data}
        linker={linker}
        actors={actores}
        periodCode={periodCode}
      />
    </>
  );
}
