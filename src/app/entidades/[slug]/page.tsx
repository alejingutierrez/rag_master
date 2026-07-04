/**
 * Ruta LEGADA. Las entidades ya no viven bajo /entidades: cada tipo tiene su ruta
 * (/personas · /lugares · /ideas). Esta ruta se conserva solo para no romper URLs
 * viejas — redirige (301) al nodo tipado correcto. Sin presencia publicada → 404.
 */
import { notFound, redirect } from "next/navigation";
import { getEntityNode, entityPath } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export default async function EntidadRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const node = await getEntityNode(slug);
  if (!node) notFound();
  redirect(entityPath(node.type, node.slug));
}
