import { PublicShell } from "@/components/public/public-shell";
import { MapExplorer } from "@/components/public/map-explorer";
import { getMapPoints, getMapCoverage } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Mapa",
    metaDescription:
      "Recorra Colombia a través de su historia: cada punto del mapa es una pieza publicada, anclada en el lugar donde ocurre.",
    keywords: ["mapa histórico", "geografía de Colombia", "historia de Colombia", "lugares"],
  },
  path: "/mapa",
  type: "website",
});

export default async function MapaPage() {
  const [points, coverage] = await Promise.all([getMapPoints(), getMapCoverage()]);
  return (
    <PublicShell>
      <MapExplorer points={points} total={coverage.total} />
    </PublicShell>
  );
}
