import { notFound } from "next/navigation";
import { TypologyArticle } from "@/components/public/typology-detail";
import { JsonLd } from "@/components/public/json-ld";
import { getTypologyDetail, getEntityLinker, resolveEntityChips } from "@/lib/public-data";
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
  const detail = await getTypologyDetail("hecho", slug);
  if (!detail) notFound();
  const s = detail.structured;
  // Protagonistas y lugares del hecho, resueltos a enlace + retrato cuando ya
  // tienen su propia pieza publicada: es la conexión hecho → personaje.
  const [linker, protagonistas, lugares] = await Promise.all([
    getEntityLinker(),
    resolveEntityChips(s.typology === "hecho" ? s.protagonistas : [], "persona"),
    resolveEntityChips(s.typology === "hecho" ? s.lugares : [], "lugar"),
  ]);
  return (
    <>
      <JsonLd data={detailJsonLd(detail)} />
      <TrackView
        contentType={detail.structured.typology}
        itemId={detail.structured.slug}
        itemName={detail.structured.titulo}
      />
      <TypologyArticle detail={detail} linker={linker} chips={{ protagonistas, lugares }} />
    </>
  );
}
