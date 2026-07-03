import { notFound } from "next/navigation";
import { TypologyArticle } from "@/components/public/typology-detail";
import { JsonLd } from "@/components/public/json-ld";
import { getTypologyDetail } from "@/lib/public-data";
import { buildMetadata, detailJsonLd } from "@/lib/seo";
import { typologyPath } from "@/lib/typology-schemas";

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
  return (
    <>
      <JsonLd data={detailJsonLd(detail)} />
      <TypologyArticle detail={detail} />
    </>
  );
}
