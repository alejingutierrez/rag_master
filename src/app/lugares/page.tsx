import { PublicShell } from "@/components/public/public-shell";
import { EntityBrowser } from "@/components/public/entity-index";
import { getConnectedEntityDirectory, ENTITY_TYPE_META } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Lugares",
    metaDescription:
      "Los territorios, regiones y ciudades de la historia de Colombia con artículo propio publicado — y las piezas del archivo que los atraviesan.",
    keywords: ["geografía histórica", "territorios", "regiones", "historia de Colombia"],
  },
  path: "/lugares",
  type: "website",
});

/**
 * Índice de lugares. A diferencia de personas e ideas, NO se organiza por época:
 * un lugar no pertenece a un período —Bogotá atraviesa el archivo entero— y
 * filtrarlo por época obligaba a elegir una pertenencia falsa. El orden es
 * alfabético, con filtro por inicial y búsqueda.
 */
export default async function LugaresPage() {
  const entities = await getConnectedEntityDirectory("lugar");
  const m = ENTITY_TYPE_META.lugar;
  return (
    <PublicShell>
      <EntityBrowser
        entities={entities}
        showPeriodFilter={false}
        kicker="Dónde ocurrió"
        title="Lugares"
        intro="Territorios, regiones y ciudades con historia propia en el archivo — en orden alfabético, porque ninguno pertenece a una sola época."
        emptyNote="Aún no hay lugares con historia propia publicada."
        typeLabel={m.singular}
        color={m.color}
      />
    </PublicShell>
  );
}
