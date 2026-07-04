import { EntityDetailPage, entityDetailMetadata } from "@/components/public/entity-detail-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return entityDetailMetadata(slug, "idea");
}

export default async function IdeaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <EntityDetailPage slug={slug} type="idea" />;
}
