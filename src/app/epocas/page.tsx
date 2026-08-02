import { EpocasExplorer } from "@/components/public/epocas/epocas-explorer";
import { PublicShell } from "@/components/public/public-shell";
import { HISTORICAL_PERIODS, type PeriodCode } from "@/lib/design-tokens";
import { getEpochExplorerPage } from "@/lib/public-data";
import { buildMetadata } from "@/lib/seo";
import "@/components/public/home/home-redesign.css";
import "@/components/public/epocas/epocas-explorer.css";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({
  seo: {
    metaTitle: "Épocas",
    metaDescription:
      "De lo prehispánico al posconflicto: el panorama, los hitos y los actores de cada gran período de la historia colombiana.",
    keywords: ["épocas", "períodos históricos", "historia de Colombia", "cronología"],
  },
  path: "/epocas",
  type: "website",
});

function validPeriod(raw: string | string[] | undefined): PeriodCode {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && HISTORICAL_PERIODS.includes(value as PeriodCode)
    ? (value as PeriodCode)
    : "IND";
}

export default async function EpocasPage({
  searchParams,
}: {
  searchParams?: Promise<{ epoca?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const data = await getEpochExplorerPage(validPeriod(params.epoca));

  return (
    <PublicShell>
      <EpocasExplorer data={data} />
    </PublicShell>
  );
}
