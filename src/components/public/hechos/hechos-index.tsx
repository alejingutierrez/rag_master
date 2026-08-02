import { PublicShell } from "@/components/public/public-shell";
import type { TypologyCard } from "@/lib/public-data";
import { HechosExplorer } from "./hechos-explorer";
import "./hechos.css";

export function HechosIndex({
  facts,
  periods,
}: {
  facts: TypologyCard[];
  periods: TypologyCard[];
}) {
  return (
    <PublicShell>
      <HechosExplorer facts={facts} periods={periods} />
    </PublicShell>
  );
}
