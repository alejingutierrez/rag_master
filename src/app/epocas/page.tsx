import { TypologyIndex } from "@/components/public/typology-index";
import { getTypologyList } from "@/lib/public-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Épocas · Historia Colombiana" };

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
