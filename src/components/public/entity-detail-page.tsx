/**
 * Página de detalle de una entidad, compartida por /personas · /lugares · /ideas.
 * Antes vivía solo en /entidades/[slug]; ahora cada tipo tiene su ruta (una persona
 * no es una "entidad" genérica en la taxonomía del sitio). Si hay ficha curada
 * publicada, se muestra completa + las conexiones automáticas; si no, el nodo wiki
 * ligero (cabecera + dónde aparece + relacionadas). Gate: sin presencia publicada
 * → notFound().
 */
import { notFound, redirect } from "next/navigation";
import { TypologyArticle } from "@/components/public/typology-detail";
import { PersonaDetailArticle } from "@/components/public/personas/persona-detail";
import { PlaceDetailArticle, PlaceNodeArticle } from "@/components/public/places/place-detail";
import { EntityConnections, EntityNodeArticle } from "@/components/public/entity-node";
import { JsonLd } from "@/components/public/json-ld";
import {
  getEntityNode,
  getTypologyDetail,
  getEntityLinker,
  entityPath,
  ENTITY_TYPE_META,
  type EntityType,
} from "@/lib/public-data";
import { entityKey } from "@/lib/entities-registry";
import { buildMetadata, detailJsonLd, entityNodeJsonLd, entityNodeSeo } from "@/lib/seo";
import { TrackView } from "@/components/analytics/track-view";

export async function entityDetailMetadata(slug: string, type: EntityType) {
  const node = await getEntityNode(slug, type);
  const meta = ENTITY_TYPE_META[type];
  if (!node) return { title: meta.singular };

  // Si hay ficha curada publicada, el <head> debe salir de ELLA: el SEO que
  // redactó el Taller (metaTitle/description/keywords propios) y su portada como
  // og:image. Antes se construía siempre desde el nodo del registro, así que las
  // fichas publicadas perdían su SEO y quedaban con la imagen genérica.
  if (node.hasFicha) {
    const detail = await getTypologyDetail("entidad", node.slug, type);
    if (detail) {
      return buildMetadata({
        seo: detail.seo,
        path: entityPath(type, node.slug),
        imageUrl: detail.imageUrl,
        publishedTime: detail.publishedAt,
        modifiedTime: detail.updatedAt,
        type: "article",
      });
    }
  }

  const description =
    node.resumen ??
    `${node.name}: ${meta.singular.toLowerCase()} en la historia de Colombia. Dónde aparece y con qué otras figuras se relaciona.`;
  return buildMetadata({
    seo: entityNodeSeo({ name: node.name, description, typeLabel: meta.singular }),
    path: entityPath(type, node.slug),
    type: "article",
  });
}

export async function EntityDetailPage({ slug, type }: { slug: string; type: EntityType }) {
  const node = await getEntityNode(slug, type);
  if (!node) notFound();
  if (slug !== node.slug) redirect(entityPath(type, node.slug));

  const meta = ENTITY_TYPE_META[type];
  const crumb = { href: meta.index, label: meta.plural };
  const linker = await getEntityLinker();
  const selfKey = entityKey(type, node.slug);

  // Si hay ficha curada, se muestra completa + las conexiones automáticas.
  if (node.hasFicha) {
    const detail = await getTypologyDetail("entidad", node.slug, type);
    if (detail) {
      const article = type === "persona" ? (
        <PersonaDetailArticle
          detail={detail}
          node={node}
          linker={linker}
          selfKey={selfKey}
        />
      ) : type === "lugar" ? (
        <PlaceDetailArticle
          detail={detail}
          node={node}
          linker={linker}
          selfKey={selfKey}
        />
      ) : (
        <TypologyArticle
          detail={detail}
          crumb={crumb}
          linker={linker}
          selfKey={selfKey}
          extra={
            <EntityConnections pieces={node.pieces} related={node.related} selfHref={node.href} />
          }
        />
      );
      return (
        <>
          <JsonLd data={detailJsonLd(detail)} />
          <TrackView contentType="entidad" itemId={slug} itemName={node.name} />
          {article}
        </>
      );
    }
  }

  // Sin ficha: nodo wiki ligero (cabecera + conexiones).
  return (
    <>
      <JsonLd
        data={entityNodeJsonLd({
          type,
          path: node.href,
          name: node.name,
          description:
            node.resumen ??
            `${node.name}: ${meta.singular.toLowerCase()} en la historia de Colombia.`,
          imageUrl: node.imageUrl,
          indexPath: crumb.href,
          indexLabel: crumb.label,
        })}
      />
      <TrackView contentType="entidad" itemId={slug} itemName={node.name} />
      {type === "lugar" ? (
        <PlaceNodeArticle node={node} />
      ) : (
        <EntityNodeArticle node={node} crumb={crumb} />
      )}
    </>
  );
}
