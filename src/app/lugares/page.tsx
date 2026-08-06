import { PublicShell } from "@/components/public/public-shell";
import { PlacesExplorer } from "@/components/public/places/places-explorer";
import { getPlacesDirectory } from "@/lib/public-data";
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
 * Atlas editorial de lugares. Conserva el universo canónico publicado y combina
 * dos escalas de lectura: tres entradas destacadas y un explorador mapa/directorio.
 */
export default async function LugaresPage() {
  const places = await getPlacesDirectory();
  return (
    <PublicShell>
      <PlacesExplorer places={places} />
    </PublicShell>
  );
}
