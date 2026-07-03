import { TypologyIndex } from "@/components/public/typology-index";
import { getTypologyList } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({
  seo: {
    metaTitle: "Épocas",
    metaDescription:
      "De lo prehispánico al posconflicto: el panorama, los hitos y los actores de cada gran período de la historia colombiana.",
    keywords: ["épocas", "períodos históricos", "historia de Colombia", "cronología"],
  },
  path: "/epocas",
  type: "website",
});

export default async function EpocasPage() {
  const cards = await getTypologyList("epoca");
  return (
    <TypologyIndex
      kicker="Los grandes períodos"
      title="Épocas"
      intro="De lo prehispánico al posconflicto: el panorama, los hitos y los actores de cada gran período de la historia colombiana."
      cards={cards}
      emptyNote="Aún no hay épocas publicadas. Aparecerán aquí a medida que se publiquen desde el taller."
    />
  );
}
