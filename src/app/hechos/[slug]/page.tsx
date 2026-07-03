import { notFound } from "next/navigation";
import { TypologyArticle } from "@/components/public/typology-detail";
import { getTypologyDetail } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getTypologyDetail("hecho", slug);
  if (!d) return { title: "Hecho · Historia Colombiana" };
  return {
    title: `${d.structured.titulo} · Historia Colombiana`,
    description: d.structured.resumen || undefined,
  };
}

export default async function HechoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await getTypologyDetail("hecho", slug);
  if (!detail) notFound();
  return <TypologyArticle detail={detail} />;
}
