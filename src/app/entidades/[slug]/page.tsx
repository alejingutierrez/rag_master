import { notFound } from "next/navigation";
import { TypologyArticle } from "@/components/public/typology-detail";
import { EntityConnections, EntityNodeArticle } from "@/components/public/entity-node";
import { JsonLd } from "@/components/public/json-ld";
import { getEntityNode, getTypologyDetail, ENTITY_TYPE_META } from "@/lib/public-data";
import { buildMetadata, detailJsonLd } from "@/lib/seo";
import { TrackView } from "@/components/analytics/track-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const node = await getEntityNode(slug);
  if (!node) return { title: "Entidad" };
  const meta = ENTITY_TYPE_META[node.type];
  return buildMetadata({
    seo: {
      metaTitle: node.name,
      metaDescription:
        node.resumen ??
        `${node.name}: ${meta.singular.toLowerCase()} en la historia de Colombia. Dónde aparece y con qué otras figuras se relaciona.`,
      keywords: [node.name, meta.singular, "historia de Colombia"],
    },
    path: `/entidades/${slug}`,
    type: "article",
  });
}

export default async function EntidadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const node = await getEntityNode(slug);
  if (!node) notFound();

  const meta = ENTITY_TYPE_META[node.type];
  const crumb = { href: meta.index, label: meta.plural };

  // Si hay ficha curada, se muestra completa + las conexiones automáticas.
  if (node.hasFicha) {
    const detail = await getTypologyDetail("entidad", slug);
    if (detail) {
      return (
        <>
          <JsonLd data={detailJsonLd(detail)} />
          <TrackView contentType="entidad" itemId={slug} itemName={node.name} />
          <TypologyArticle
            detail={detail}
            crumb={crumb}
            extra={<EntityConnections pieces={node.pieces} related={node.related} />}
          />
        </>
      );
    }
  }

  // Sin ficha: nodo wiki ligero (cabecera + conexiones).
  return (
    <>
      <TrackView contentType="entidad" itemId={slug} itemName={node.name} />
      <EntityNodeArticle node={node} crumb={crumb} />
    </>
  );
}
