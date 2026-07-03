import { PublicShell } from "@/components/public/public-shell";
import { EntityBrowser } from "@/components/public/entity-index";
import { getEntityUniverse, ENTITY_TYPE_META } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Personas",
    metaDescription:
      "Las figuras de la historia de Colombia que aparecen en las piezas publicadas — dónde aparecen y con quién se relacionan.",
    keywords: ["personajes históricos", "biografías", "historia de Colombia"],
  },
  path: "/personas",
  type: "website",
});

export default async function PersonasPage() {
  const entities = await getEntityUniverse("persona");
  const m = ENTITY_TYPE_META.persona;
  return (
    <PublicShell>
      <EntityBrowser
        entities={entities}
        kicker="Quién hizo la historia"
        title="Personas"
        intro="Las figuras que habitan estas piezas — con dónde aparecen y con quién se relacionan."
        emptyNote="Aún no hay personas. Aparecerán a medida que se publiquen piezas desde el taller."
        typeLabel={m.singular}
        color={m.color}
      />
    </PublicShell>
  );
}
