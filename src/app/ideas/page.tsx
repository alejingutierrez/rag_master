import { PublicShell } from "@/components/public/public-shell";
import { EntityBrowser } from "@/components/public/entity-index";
import { getEntityUniverse, getEntityCounts, ENTITY_TYPE_META } from "@/lib/public-data";
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
  const [entities, counts] = await Promise.all([getEntityUniverse("idea"), getEntityCounts()]);
  const m = ENTITY_TYPE_META.idea;
  return (
    <PublicShell>
      <EntityBrowser
        entities={entities}
        total={counts.idea}
        kicker="Qué estaba en juego"
        title="Ideas"
        intro="Los procesos, las ideologías y las instituciones del corpus — y las piezas que las piensan."
        emptyNote="Aún no hay ideas en el corpus."
        typeLabel={m.singular}
        color={m.color}
      />
    </PublicShell>
  );
}
