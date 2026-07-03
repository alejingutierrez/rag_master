import { TypologyIndex } from "@/components/public/typology-index";
import { getTypologyList } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({
  seo: {
    metaTitle: "Preguntas",
    metaDescription:
      "Preguntas históricas con respuesta razonada, su tesis, el debate que abren y la evidencia que las sostiene.",
    keywords: ["preguntas históricas", "debate", "tesis", "historia de Colombia"],
  },
  path: "/preguntas",
  type: "website",
});

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
