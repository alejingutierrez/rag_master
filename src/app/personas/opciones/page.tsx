import type { Metadata } from "next";
import { PublicShell } from "@/components/public/public-shell";
import { PersonasConcepts } from "@/components/public/personas/personas-concepts";
import { getConnectedEntityDirectory } from "@/lib/public-data";
import "@/components/public/home/home-redesign.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Opciones de rediseño — Personas",
  robots: { index: false, follow: false },
};

function validOption(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 1;
}

export default async function PersonasOptionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ opcion?: string | string[] }>;
}) {
  const entities = await getConnectedEntityDirectory("persona");
  const sp = (await searchParams) ?? {};

  return (
    <PublicShell>
      <PersonasConcepts entities={entities} initialOption={validOption(sp.opcion)} />
    </PublicShell>
  );
}
