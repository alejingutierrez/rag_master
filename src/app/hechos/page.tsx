import { TypologyIndex } from "@/components/public/typology-index";
import { getTypologyList } from "@/lib/public-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hechos · Historia Colombiana" };

export default async function HechosPage() {
  const cards = await getTypologyList("hecho");
  return (
    <TypologyIndex
      kicker="Acontecimientos"
      title="Hechos"
      intro="Los acontecimientos que marcaron a Colombia: qué pasó, cuándo, por qué importa y con las fuentes a la vista."
      cards={cards}
      emptyNote="Aún no hay hechos publicados. Aparecerán aquí a medida que se publiquen desde el taller."
    />
  );
}
