import { PublicShell } from "@/components/public/public-shell";
import { EntityBrowser } from "@/components/public/entity-index";
import { getConnectedEntityDirectory, getPeriodEntityUniverse, getConnectedEntityCounts, ENTITY_TYPE_META } from "@/lib/public-data";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
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

function validPeriod(raw: string | string[] | undefined): PeriodCode | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value in PERIODS ? (value as PeriodCode) : null;
}

export default async function PersonasPage({
  searchParams,
}: {
  searchParams?: Promise<{ periodo?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const periodo = validPeriod(sp.periodo);
  const [entities, counts] = await Promise.all([
    periodo ? getPeriodEntityUniverse("persona", periodo) : getConnectedEntityDirectory("persona"),
    getConnectedEntityCounts(),
  ]);
  const m = ENTITY_TYPE_META.persona;
  return (
    <PublicShell>
      <EntityBrowser
        entities={entities}
        total={counts.persona}
        kicker="Quién hizo la historia"
        title="Personas"
        intro="Figuras presentes en las piezas publicadas. Algunas tienen biografía propia; las demás abren el tejido de historias donde aparecen."
        emptyNote="Aún no hay personas conectadas a piezas publicadas."
        typeLabel={m.singular}
        color={m.color}
      />
    </PublicShell>
  );
}
