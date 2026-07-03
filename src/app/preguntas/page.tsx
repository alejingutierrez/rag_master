import { TypologyIndex } from "@/components/public/typology-index";
import { getTypologyList } from "@/lib/public-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Preguntas · Historia Colombiana" };

export default async function PreguntasPage() {
  const cards = await getTypologyList("pregunta");
  return (
    <TypologyIndex
      kicker="Dudas con respuesta"
      title="Preguntas"
      intro="Preguntas históricas con respuesta razonada, su tesis, el debate que abren y la evidencia que las sostiene."
      cards={cards}
      emptyNote="Aún no hay preguntas publicadas. Aparecerán aquí a medida que se publiquen desde el taller."
    />
  );
}
