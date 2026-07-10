import { PublicShell } from "@/components/public/public-shell";
import { EntityBrowser } from "@/components/public/entity-index";
import { getConnectedEntityDirectory, getPeriodEntityUniverse, getConnectedEntityCounts, ENTITY_TYPE_META } from "@/lib/public-data";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
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

function validPeriod(raw: string | string[] | undefined): PeriodCode | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value in PERIODS ? (value as PeriodCode) : null;
}

export default async function IdeasPage({
  searchParams,
}: {
  searchParams?: Promise<{ periodo?: string | string[] }>;
}) {
  const sp = (await searchParams) ?? {};
  const periodo = validPeriod(sp.periodo);
  const [entities, counts] = await Promise.all([
    periodo ? getPeriodEntityUniverse("idea", periodo) : getConnectedEntityDirectory("idea"),
    getConnectedEntityCounts(),
  ]);
  const m = ENTITY_TYPE_META.idea;
  return (
    <PublicShell>
      <EntityBrowser
        entities={entities}
        total={counts.idea}
        kicker="Qué estaba en juego"
        title="Ideas"
        intro="Procesos, ideologías e instituciones presentes en las piezas publicadas — y las historias que permiten pensarlas."
        emptyNote="Aún no hay ideas conectadas a piezas publicadas."
        typeLabel={m.singular}
        color={m.color}
      />
    </PublicShell>
  );
}
