import { PublicShell } from "@/components/public/public-shell";
import { IdeasExplorer } from "@/components/public/ideas/ideas-explorer";
import { getConnectedEntityDirectory } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Ideas",
    metaDescription:
      "Los procesos, ideologías e instituciones que estructuran la historia de Colombia con artículo propio publicado — y las piezas que los trabajan.",
    keywords: ["conceptos históricos", "procesos", "ideologías", "instituciones", "historia de Colombia"],
  },
  path: "/ideas",
  type: "website",
});

export default async function IdeasPage() {
  const ideas = await getConnectedEntityDirectory("idea");
  return (
    <PublicShell>
      <IdeasExplorer ideas={ideas} />
    </PublicShell>
  );
}
