import { PublicShell } from "@/components/public/public-shell";
import { EntityBrowser } from "@/components/public/entity-index";
import { getConnectedEntityDirectory, getPeriodEntityUniverse, getConnectedEntityCounts, ENTITY_TYPE_META } from "@/lib/public-data";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
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

function validPeriod(raw: string | string[] | undefined): PeriodCode | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value in PERIODS ? (value as PeriodCode) : null;
}

export default async function LugaresPage({
  searchParams,
}: {
  searchParams?: Promise<{ periodo?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const periodo = validPeriod(sp.periodo);
  const [entities, counts] = await Promise.all([
    periodo ? getPeriodEntityUniverse("lugar", periodo) : getConnectedEntityDirectory("lugar"),
    getConnectedEntityCounts(),
  ]);
  const m = ENTITY_TYPE_META.lugar;
  return (
    <PublicShell>
      <EntityBrowser
        entities={entities}
        total={counts.lugar}
        kicker="Dónde ocurrió"
        title="Lugares"
        intro="Territorios, regiones y ciudades mencionados en piezas publicadas — cada entrada conduce a las historias que la sostienen."
        emptyNote="Aún no hay lugares conectados a piezas publicadas."
        typeLabel={m.singular}
        color={m.color}
      />
    </PublicShell>
  );
}
