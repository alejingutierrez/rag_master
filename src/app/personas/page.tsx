import { PublicShell } from "@/components/public/public-shell";
import { PersonasByPeriod } from "@/components/public/personas/personas-concepts";
import { getConnectedEntityDirectory } from "@/lib/public-data";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import { buildMetadata } from "@/lib/seo";
import "@/components/public/home/home-redesign.css";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  seo: {
    metaTitle: "Personajes",
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
  const entities = await getConnectedEntityDirectory("persona");

  return (
    <PublicShell>
      <PersonasByPeriod entities={entities} initialPeriod={periodo} />
    </PublicShell>
  );
}
