import { PublicShell } from "@/components/public/public-shell";
import { EntityBrowser } from "@/components/public/entity-index";
import { getConnectedEntityDirectory, getPeriodEntityUniverse, ENTITY_TYPE_META } from "@/lib/public-data";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Personas",
    metaDescription:
      "Las figuras de la historia de Colombia con biografía propia publicada: su semblanza, sus fuentes y los hechos donde intervienen.",
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
  const entities = periodo
    ? await getPeriodEntityUniverse("persona", periodo)
    : await getConnectedEntityDirectory("persona");
  const m = ENTITY_TYPE_META.persona;
  return (
    <PublicShell>
      <EntityBrowser
        entities={entities}
        kicker="Quién hizo la historia"
        title="Personas"
        intro="Las figuras que tienen su propia biografía en el archivo: cada una con su semblanza, sus fuentes y los hechos donde interviene."
        emptyNote="Todavía no hay biografías publicadas."
        typeLabel={m.singular}
        color={m.color}
      />
    </PublicShell>
  );
}
