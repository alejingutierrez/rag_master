import { TypologyIndex } from "@/components/public/typology-index";
import { getTypologyList } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({
  seo: {
    metaTitle: "Entidades",
    metaDescription:
      "Las personas, los lugares y los conceptos que habitan esta historia — con su cronología, sus roles y sus relaciones.",
    keywords: ["personajes históricos", "lugares", "conceptos", "historia de Colombia"],
  },
  path: "/entidades",
  type: "website",
});

export default async function EntidadesPage() {
  const cards = await getTypologyList("entidad");
  return (
    <TypologyIndex
      kicker="Actores, lugares e ideas"
      title="Entidades"
      intro="Las personas, los lugares y los conceptos que habitan esta historia — con su cronología, sus roles y sus relaciones."
      cards={cards}
      emptyNote="Aún no hay entidades publicadas. Aparecerán aquí a medida que se publiquen desde el taller."
    />
  );
}
