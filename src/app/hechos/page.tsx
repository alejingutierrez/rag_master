import { HechosIndex } from "@/components/public/hechos/hechos-index";
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
  const [facts, periods] = await Promise.all([
    getTypologyList("hecho", 1000),
    getTypologyList("epoca", 100),
  ]);
  return <HechosIndex facts={facts} periods={periods} />;
}
