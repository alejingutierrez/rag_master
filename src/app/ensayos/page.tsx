import { TypologyIndex } from "@/components/public/typology-index";
import { getEssaysIndex } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Ensayos",
    metaDescription:
      "Ensayos sobre la historia de Colombia — crónicas, reportajes y preguntas con respuesta razonada, ordenados por época y con las fuentes a la vista.",
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
      title="Ensayos"
      intro="Crónicas, reportajes y preguntas con respuesta razonada — ordenados por época, con las fuentes a la vista."
      cards={cards}
      emptyNote="Aún no hay ensayos publicados. Aparecerán aquí a medida que se publiquen desde el taller."
    />
  );
}
