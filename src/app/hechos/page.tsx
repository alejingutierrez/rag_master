import { TypologyIndex } from "@/components/public/typology-index";
import { getTypologyList } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({
  seo: {
    metaTitle: "Hechos",
    metaDescription:
      "Los acontecimientos que marcaron a Colombia: qué pasó, cuándo, por qué importa y con las fuentes a la vista.",
    keywords: ["hechos históricos", "historia de Colombia", "acontecimientos", "cronología"],
  },
  path: "/hechos",
  type: "website",
});

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
