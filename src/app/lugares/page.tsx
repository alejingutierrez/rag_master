import { PublicShell } from "@/components/public/public-shell";
import { EntityBrowser } from "@/components/public/entity-index";
import { getEntityUniverse, ENTITY_TYPE_META } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Lugares",
    metaDescription:
      "Los territorios, regiones y ciudades donde transcurre la historia de Colombia — con las piezas que los tocan y sus relaciones.",
    keywords: ["geografía histórica", "territorios", "regiones", "historia de Colombia"],
  },
  path: "/lugares",
  type: "website",
});

export default async function LugaresPage() {
  const entities = await getEntityUniverse("lugar");
  const m = ENTITY_TYPE_META.lugar;
  return (
    <PublicShell>
      <EntityBrowser
        entities={entities}
        kicker="Dónde ocurrió"
        title="Lugares"
        intro="Los territorios, regiones y ciudades donde transcurre esta historia — y las piezas que los cruzan."
        emptyNote="Aún no hay lugares. Aparecerán a medida que se publiquen piezas desde el taller."
        typeLabel={m.singular}
        color={m.color}
      />
    </PublicShell>
  );
}
