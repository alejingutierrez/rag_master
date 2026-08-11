import { EssaysExplorer } from "@/components/public/essays/essays-explorer";
import { PublicShell } from "@/components/public/public-shell";
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
    <PublicShell>
      <EssaysExplorer cards={cards} />
    </PublicShell>
  );
}
