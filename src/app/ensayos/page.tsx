import { TypologyIndex } from "@/components/public/typology-index";
import { getEssaysIndex } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Lecturas",
    metaDescription:
      "Lecturas sobre la historia de Colombia — preguntas con respuesta razonada y sus fuentes a la vista.",
    keywords: ["ensayos", "historia de Colombia", "crónicas", "reportajes", "preguntas históricas"],
  },
  path: "/ensayos",
  type: "website",
});

export default async function EnsayosPage() {
  const cards = await getEssaysIndex();
  return (
    <TypologyIndex
      kicker="Lecturas"
      title="Lecturas"
      intro="Preguntas con respuesta razonada — ordenadas por época y con las fuentes siempre a la vista."
      cards={cards}
      emptyNote="Aún no hay lecturas publicadas. Aparecerán aquí a medida que se publiquen desde el taller."
    />
  );
}
