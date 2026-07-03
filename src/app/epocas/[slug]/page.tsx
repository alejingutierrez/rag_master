import { notFound } from "next/navigation";
import { TypologyArticle } from "@/components/public/typology-detail";
import { getTypologyDetail } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getTypologyDetail("epoca", slug);
  if (!d) return { title: "Época · Historia Colombiana" };
  return {
    title: `${d.structured.titulo} · Historia Colombiana`,
    description: d.structured.resumen || undefined,
  };
}

export default async function EpocaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await getTypologyDetail("epoca", slug);
  if (!detail) notFound();
  return <TypologyArticle detail={detail} />;
}
