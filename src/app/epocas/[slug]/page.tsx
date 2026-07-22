import { notFound } from "next/navigation";
import { TypologyArticle } from "@/components/public/typology-detail";
import { PeriodHubSections } from "@/components/public/period-hub";
import { JsonLd } from "@/components/public/json-ld";
import {
  getTypologyDetail,
  getPeriodHub,
  getEntityLinker,
  resolveEntityChips,
} from "@/lib/public-data";
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
  const [hub, linker, actores] = await Promise.all([
    getPeriodHub(s.periodoCode ?? ""),
    getEntityLinker(),
    resolveEntityChips(s.typology === "epoca" ? s.actores : [], "persona"),
  ]);
  return (
    <>
      <JsonLd data={detailJsonLd(detail)} />
      <TrackView
        contentType={detail.structured.typology}
        itemId={detail.structured.slug}
        itemName={detail.structured.titulo}
      />
      <TypologyArticle
        detail={detail}
        linker={linker}
        chips={{ actores }}
        extra={<PeriodHubSections hub={hub} periodCode={detail.structured.periodoCode} />}
      />
    </>
  );
}
