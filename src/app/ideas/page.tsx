import { PublicShell } from "@/components/public/public-shell";
import { EntityBrowser } from "@/components/public/entity-index";
import { getEntityUniverse, ENTITY_TYPE_META } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Ideas",
    metaDescription:
      "Los procesos, ideologías, instituciones y nociones que estructuran la historia de Colombia — con las piezas que las trabajan y sus relaciones.",
    keywords: ["conceptos históricos", "procesos", "ideologías", "instituciones", "historia de Colombia"],
  },
  path: "/ideas",
  type: "website",
});

export default async function IdeasPage() {
  const entities = await getEntityUniverse("idea");
  const m = ENTITY_TYPE_META.idea;
  return (
    <PublicShell>
      <EntityBrowser
        entities={entities}
        kicker="Qué estaba en juego"
        title="Ideas"
        intro="Los procesos, las ideologías y las instituciones que estructuran esta historia — y las piezas que las piensan."
        emptyNote="Aún no hay ideas. Aparecerán a medida que se publiquen piezas desde el taller."
        typeLabel={m.singular}
        color={m.color}
      />
    </PublicShell>
  );
}
